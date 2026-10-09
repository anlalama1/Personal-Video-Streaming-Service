const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

const s3 = new S3Client({});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockRuntimeClient({});

const SOURCE_BUCKET = process.env.SOURCE_BUCKET;
const THUMBNAIL_BUCKET = process.env.THUMBNAIL_BUCKET;
const DEST_BUCKET = process.env.DEST_BUCKET;
const TABLE_NAME = process.env.TABLE_NAME;
const INPUT_KEY = process.env.INPUT_KEY;
const TENANT_ID = process.env.TENANT_ID;
const FAMILY_ID = process.env.FAMILY_ID;
const VIDEO_ID = process.env.VIDEO_ID;
const CONTAINER_MODE = process.env.CONTAINER_MODE || "TRANSCODE_HLS";
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID;

async function getApprovedGenres() {
    try {
        const result = await db.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": "GENRES_REGISTRY",
                ":sk": "GENRE#"
            }
        }));

        const dbGenres = (result.Items || [])
            .map(item => (item.genreName || "").trim())
            .filter(Boolean);

        if (dbGenres.length > 0) {
            console.log(`Loaded ${dbGenres.length} configured genres from DynamoDB registry.`);
            return dbGenres;
        }
    } catch (err) {
        console.warn("Failed to query genres from DynamoDB registry:", err.message);
    }

    return [];
}

async function run() {
    if (!TENANT_ID || !FAMILY_ID || !VIDEO_ID) {
        console.error("CRITICAL ERROR: Multi-tenant context missing from environment.");
        process.exit(1);
    }

    console.log(`Starting Fargate Worker in Mode: ${CONTAINER_MODE}`);
    console.log(`Context - Tenant: ${TENANT_ID}, Family: ${FAMILY_ID}, Video: ${VIDEO_ID}`);

    const localInput = `/tmp/input_${VIDEO_ID}${path.extname(INPUT_KEY)}`;
    const dbKey = {
        PK: `TENANT#${TENANT_ID}`,
        SK: `FAMILY#${FAMILY_ID}#VIDEO#${VIDEO_ID}`
    };

    try {
        console.log("Downloading source MP4 from S3...");
        const response = await s3.send(new GetObjectCommand({
            Bucket: SOURCE_BUCKET,
            Key: INPUT_KEY
        }));
        await pipeline(response.Body, fs.createWriteStream(localInput));

        if (CONTAINER_MODE === "METADATA_EXTRACT") {
            await handleMetadataExtract(localInput, dbKey);
        } else if (CONTAINER_MODE === "THUMBNAIL_ONLY") {
            await handleThumbnailOnly(localInput, dbKey);
        } else {
            await handleHlsTranscode(localInput, dbKey);
        }

        console.log(`Fargate Worker task (${CONTAINER_MODE}) completed successfully!`);
    } catch (err) {
        console.error("Fargate Worker task failed:", err);
        try {
            await db.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: dbKey,
                UpdateExpression: "SET transcodeStatus = :s, lastUpdated = :t REMOVE processingMode",
                ExpressionAttributeValues: { ":s": "FAILED", ":t": Date.now() }
            }));
        } catch (dbErr) {
            console.error("Failed to update status to FAILED in DynamoDB:", dbErr);
        }
        process.exit(1);
    }
}

async function handleThumbnailOnly(localInput, dbKey) {
    const thumbnailPath = "/tmp/thumbnail.jpg";
    console.log("Extracting thumbnail via FFmpeg...");
    const thumbnail = spawnSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y", "-ss", "00:00:02", "-i", localInput,
        "-frames:v", "1", "-q:v", "2", "-update", "1", thumbnailPath
    ], { encoding: "utf8" });
    if (thumbnail.status !== 0 || !fs.existsSync(thumbnailPath) || fs.statSync(thumbnailPath).size === 0) {
        const fallbackThumbnail = spawnSync("ffmpeg", [
            "-hide_banner", "-loglevel", "error", "-y", "-i", localInput,
            "-frames:v", "1", "-q:v", "2", "-update", "1", thumbnailPath
        ], { encoding: "utf8" });
        if (fallbackThumbnail.status !== 0 || !fs.existsSync(thumbnailPath) || fs.statSync(thumbnailPath).size === 0) {
            throw new Error(`FFmpeg could not extract a thumbnail: ${fallbackThumbnail.stderr || thumbnail.stderr || "unknown FFmpeg error"}`);
        }
    }

    const thumbnailKey = `${TENANT_ID}/${FAMILY_ID}/${VIDEO_ID}/thumbnail.jpg`;
    await s3.send(new PutObjectCommand({
        Bucket: THUMBNAIL_BUCKET,
        Key: thumbnailKey,
        Body: fs.readFileSync(thumbnailPath),
        ContentType: "image/jpeg"
    }));
    await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: dbKey,
        UpdateExpression: "SET thumbnailKey = :thumbnail, transcodeStatus = :status, lastUpdated = :updated REMOVE processingMode",
        ExpressionAttributeValues: {
            ":thumbnail": thumbnailKey,
            ":status": "REVIEW_PENDING",
            ":updated": Date.now()
        }
    }));
}

async function handleMetadataExtract(localInput, dbKey) {
    console.log("Extracting primary thumbnail and nine-frame timeline keyframe grid via FFmpeg...");
    const thumbnailPath = "/tmp/thumbnail.jpg";
    const gridPath = "/tmp/keyframe_grid.jpg";

    // 1. Primary Thumbnail at 2s for display poster
    const ffmpegThumbArgs = [
        '-ss', '00:00:02',
        '-i', localInput,
        '-update', '1',
        '-frames:v', '1',
        '-q:v', '2',
        thumbnailPath
    ];
    const ffmpegThumb = spawnSync('ffmpeg', ffmpegThumbArgs, { stdio: 'inherit' });
    if (ffmpegThumb.status !== 0 || !fs.existsSync(thumbnailPath)) {
        console.warn("Thumbnail extraction at 2s failed. Retrying at 0s...");
        const fallbackThumb = spawnSync('ffmpeg', ['-i', localInput, '-vframes', '1', '-q:v', '2', thumbnailPath], { stdio: 'inherit' });
        if (fallbackThumb.status !== 0 || !fs.existsSync(thumbnailPath)) {
            throw new Error("FFmpeg could not extract a thumbnail from the uploaded video.");
        }
    }

    // Sample nine frames evenly across the full video duration and assemble them chronologically.
    const probe = spawnSync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        localInput
    ], { encoding: 'utf8' });
    const durationSeconds = Number(probe.stdout?.trim());
    if (probe.status !== 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error(`Could not determine uploaded video duration: ${probe.stderr || "invalid duration"}`);
    }

    const ffmpegGridArgs = [
        '-i', localInput,
        '-vf', `fps=8.01/${durationSeconds}:round=up,scale=320:-1,tile=3x3:nb_frames=9`,
        '-frames:v', '1',
        '-q:v', '2',
        gridPath
    ];
    const ffmpegGrid = spawnSync('ffmpeg', ffmpegGridArgs, { stdio: 'inherit' });
    if (ffmpegGrid.status !== 0 || !fs.existsSync(gridPath) || fs.statSync(gridPath).size === 0) {
        throw new Error("FFmpeg could not create the nine-frame timeline keyframe grid.");
    }

    let aiMetadata = { title: "Untitled Video", genre: "", description: "No description generated.", tags: [] };
    if (fs.existsSync(gridPath)) {
        const approvedGenres = await getApprovedGenres();
        if (approvedGenres.length === 0) {
            throw new Error("No genres are configured in the DynamoDB genre registry.");
        }

        aiMetadata.genre = approvedGenres[0];

        try {
            console.log("Invoking AWS Bedrock for multimodal multi-frame timeline description and genre classification...");

            const imageBuffer = fs.readFileSync(gridPath);
            const base64Image = imageBuffer.toString("base64");
            const sourceFileName = path.basename(INPUT_KEY || localInput);

            const genrePromptList = approvedGenres.map(g => `- ${g}`).join('\n');

            const prompt = `Carefully inspect the attached 3-by-3 keyframe grid. It contains nine frames sampled evenly from the beginning through the end of the video, in reading order (left to right, top to bottom). Base your description on what is visibly present in these frames, not on assumptions from the filename.
Original filename: "${sourceFileName}"
Create a concise metadata draft for a human editor to review.
Identify the visible subjects, actions, setting, and meaningful changes between the sampled moments. Be specific when details are recognizable, but do not invent identities, events, or context when they are not. If the grid is unclear or does not show enough evidence, say specifically that the visible content cannot be determined instead of inventing a generic description.
The description must be no more than 3 sentences. Focus on the most important visible details; avoid repetition, speculation, and flowery narration.

Select EXACTLY ONE genre from the following approved Heritage Genre list that best describes the event depicted in the video:
${genrePromptList}

Return a JSON object with exactly four fields: "title" (a short, specific title), "genre" (one exact string from the approved Heritage Genre list above), "description" (a concise description of no more than 3 sentences), and "tags" (an array of relevant keywords). Do not include any extra text, markdown formatting, or explanations outside the JSON object.`;

            console.log("Full prompt being sent to Bedrock:");
            console.log("-----------------------------------");
            console.log(prompt);
            console.log("-----------------------------------");

            const payload = {
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 500,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: "image/jpeg",
                                    data: base64Image
                                }
                            },
                            {
                                type: "text",
                                text: prompt
                            }
                        ]
                    }
                ]
            };

            const command = new InvokeModelCommand({
                modelId: BEDROCK_MODEL_ID,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(payload)
            });

            const bedrockResponse = await bedrock.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
            const textResponse = responseBody.content[0].text.trim();

            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                aiMetadata = JSON.parse(jsonMatch[0]);
            } else {
                aiMetadata = JSON.parse(textResponse);
            }

            if (typeof aiMetadata.description !== "string" || !aiMetadata.description.trim()) {
                throw new Error("Bedrock response did not include a usable visual description.");
            }
            if (!approvedGenres.includes(aiMetadata.genre)) {
                aiMetadata.genre = approvedGenres[0];
            }
        } catch (bedrockErr) {
            console.error("Bedrock metadata call failed:", bedrockErr);
            throw bedrockErr;
        }

        console.log("Uploading thumbnail image to dedicated S3 bucket...");
        const thumbnailS3Key = `${TENANT_ID}/${FAMILY_ID}/${VIDEO_ID}/thumbnail.jpg`;
        await s3.send(new PutObjectCommand({
            Bucket: THUMBNAIL_BUCKET,
            Key: thumbnailS3Key,
            Body: fs.readFileSync(thumbnailPath),
            ContentType: "image/jpeg"
        }));

        console.log("Staging draft attributes and advancing status to REVIEW_PENDING...");
        await db.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: dbKey,
            UpdateExpression: "SET thumbnailKey = :tk, transcodeStatus = :s, aiTitle = :at, aiGenre = :ag, genre = :g, aiDescription = :ad, aiTags = :atg, lastUpdated = :t REMOVE processingMode",
            ExpressionAttributeValues: {
                ":tk": thumbnailS3Key,
                ":s": "REVIEW_PENDING",
                ":at": aiMetadata.title || "Untitled Video",
                ":ag": aiMetadata.genre || approvedGenres[0],
                ":g": aiMetadata.genre || approvedGenres[0],
                ":ad": aiMetadata.description || "No description generated.",
                ":atg": aiMetadata.tags || [],
                ":t": Date.now()
            }
        }));
    } else {
        console.warn("FFmpeg failed to produce a thumbnail. Skipping upload phase.");
    }
}

async function handleHlsTranscode(localInput, dbKey) {
    const outputDir = `/tmp/${VIDEO_ID}_hls`;
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    ['stream_0', 'stream_1', 'stream_2'].forEach(dir => {
        const p = path.join(outputDir, dir);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    });

    console.log("Running FFmpeg adaptive HLS conversion ladder with Aspect-Ratio preservation...");
    const filter = "[0:v]split=3[v1][v2][v3];" +
                   "[v1]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1out];" +
                   "[v2]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v2out];" +
                   "[v3]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v3out]";

    const ffmpegArgs = [
        '-i', localInput,
        '-filter_complex', filter,
        '-map', '[v1out]', '-c:v:0', 'libx264', '-preset', 'veryfast', '-b:v:0', '5000k', '-maxrate:v:0', '5350k', '-bufsize:v:0', '7500k',
        '-map', '[v2out]', '-c:v:1', 'libx264', '-preset', 'veryfast', '-b:v:1', '2800k', '-maxrate:v:1', '2996k', '-bufsize:v:1', '4200k',
        '-map', '[v3out]', '-c:v:2', 'libx264', '-preset', 'veryfast', '-b:v:2', '1400k', '-maxrate:v:2', '1498k', '-bufsize:v:2', '2100k',
        '-map', 'a:0', '-c:a', 'aac', '-b:a:0', '192k',
        '-map', 'a:0', '-c:a', 'aac', '-b:a:1', '128k',
        '-map', 'a:0', '-c:a', 'aac', '-b:a:2', '96k',
        '-f', 'hls',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', `${outputDir}/stream_%v/data%03d.ts`,
        '-master_pl_name', 'master.m3u8',
        '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2',
        `${outputDir}/stream_%v/playlist.m3u8`
    ];

    const ffmpeg = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });
    if (ffmpeg.status !== 0) {
        throw new Error(`FFmpeg adaptive transcode exited with code ${ffmpeg.status}`);
    }

    console.log("Uploading multi-bitrate HLS segments to S3 destination folder...");
    const s3Prefix = `${TENANT_ID}/${FAMILY_ID}/${VIDEO_ID}_hls`;
    await uploadFolder(outputDir, s3Prefix);

    console.log("Updating video item to COMPLETED state...");
    await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: dbKey,
        UpdateExpression: "SET hlsKey = :h, transcodeStatus = :s, lastUpdated = :t",
        ExpressionAttributeValues: {
            ":h": `${VIDEO_ID}_hls`,
            ":s": "COMPLETED",
            ":t": Date.now()
        }
    }));
}

async function uploadFolder(localPath, s3Prefix) {
    const files = getFiles(localPath);
    for (const file of files) {
        const relativePath = path.relative(localPath, file);
        const s3Key = `${s3Prefix}/${relativePath.replace(/\\/g, '/')}`;
        const body = fs.readFileSync(file);

        await s3.send(new PutObjectCommand({
            Bucket: DEST_BUCKET,
            Key: s3Key,
            Body: body,
            ContentType: getContentType(file)
        }));
    }
}

function getFiles(dir) {
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    });
    return Array.prototype.concat(...files);
}

function getContentType(file) {
    if (file.endsWith(".m3u8")) return "application/x-mpegURL";
    if (file.endsWith(".ts")) return "video/MP2T";
    return "application/octet-stream";
}

run();
