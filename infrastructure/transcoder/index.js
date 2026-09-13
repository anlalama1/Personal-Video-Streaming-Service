const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

const s3 = new S3Client({});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockRuntimeClient({});

const SOURCE_BUCKET = process.env.SOURCE_BUCKET;
const DEST_BUCKET = process.env.DEST_BUCKET;
const TABLE_NAME = process.env.TABLE_NAME;
const INPUT_KEY = process.env.INPUT_KEY;
const TENANT_ID = process.env.TENANT_ID;
const FAMILY_ID = process.env.FAMILY_ID;
const VIDEO_ID = process.env.VIDEO_ID;
const CONTAINER_MODE = process.env.CONTAINER_MODE || "TRANSCODE_HLS";

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
                UpdateExpression: "SET transcodeStatus = :s, lastUpdated = :t",
                ExpressionAttributeValues: { ":s": "FAILED", ":t": Date.now() }
            }));
        } catch (dbErr) {
            console.error("Failed to update status to FAILED in DynamoDB:", dbErr);
        }
        process.exit(1);
    }
}

async function handleMetadataExtract(localInput, dbKey) {
    console.log("Extracting thumbnail frame via FFmpeg...");
    const thumbnailPath = "/tmp/thumbnail.jpg";
    const ffmpegThumbArgs = [
        '-ss', '00:00:02',
        '-i', localInput,
        '-vframes', '1',
        '-q:v', '2',
        thumbnailPath
    ];
    const ffmpegThumb = spawnSync('ffmpeg', ffmpegThumbArgs, { stdio: 'inherit' });
    if (ffmpegThumb.status !== 0) {
        console.warn("Thumbnail extraction at 2s failed. Retrying at 0s...");
        spawnSync('ffmpeg', ['-i', localInput, '-vframes', '1', '-q:v', '2', thumbnailPath], { stdio: 'inherit' });
    }

    let aiMetadata = { title: "Untitled Video", description: "No description generated.", tags: [] };
    if (fs.existsSync(thumbnailPath)) {
        try {
            console.log("Invoking AWS Bedrock for multimodal description...");
            const imageBuffer = fs.readFileSync(thumbnailPath);
            const base64Image = imageBuffer.toString("base64");

            const prompt = "Analyze this video keyframe thumbnail image. Return a JSON object with exactly three fields: 'title' (a short, catchy title based on the content), 'description' (a detailed, professional summary description), and 'tags' (an array of relevant keywords). Do not include any extra text, markdown formatting, or explanations outside the JSON object.";

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
                modelId: "anthropic.claude-3-haiku-20240307-v1:0",
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
        } catch (bedrockErr) {
            console.error("Bedrock metadata call failed, using fallback attributes:", bedrockErr);
        }

        console.log("Uploading thumbnail image to S3 destination...");
        const thumbnailS3Key = `${TENANT_ID}/${FAMILY_ID}/${VIDEO_ID}_hls/thumbnail.jpg`;
        await s3.send(new PutObjectCommand({
            Bucket: DEST_BUCKET,
            Key: thumbnailS3Key,
            Body: fs.readFileSync(thumbnailPath),
            ContentType: "image/jpeg"
        }));
    }

    console.log("Staging draft attributes and advancing status to REVIEW_PENDING...");
    await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: dbKey,
        UpdateExpression: "SET thumbnailKey = :tk, transcodeStatus = :s, aiTitle = :at, aiDescription = :ad, aiTags = :atg, lastUpdated = :t",
        ExpressionAttributeValues: {
            ":tk": `${VIDEO_ID}_hls/thumbnail.jpg`,
            ":s": "REVIEW_PENDING",
            ":at": aiMetadata.title || "Untitled Video",
            ":ad": aiMetadata.description || "No description generated.",
            ":atg": aiMetadata.tags || [],
            ":t": Date.now()
        }
    }));
}

async function handleHlsTranscode(localInput, dbKey) {
    const outputDir = `/tmp/${VIDEO_ID}_hls`;
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    ['stream_0', 'stream_1', 'stream_2'].forEach(dir => {
        const p = path.join(outputDir, dir);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    });

    console.log("Running FFmpeg adaptive HLS conversion ladder...");
    const filter = "[0:v]split=3[v1][v2][v3];[v1]scale=w=1920:h=1080[v1out];[v2]scale=w=1280:h=720[v2out];[v3]scale=w=854:h=480[v3out]";

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
