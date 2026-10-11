/**
 * ============================================================================
 * Transcoder Orchestrator Lambda Function (Dual-Track Router)
 * ============================================================================
 * Architecture Pattern: Event-Driven Dual-Track Serverless Orchestrator.
 *
 * Enterprise Decision Rationale:
 * Track 1 (Upload -> Review Intake): Small AI uploads are analyzed in Lambda; larger
 *   AI uploads use a low-compute Fargate task. Manual uploads generate a thumbnail
 *   before advancing to review.
 * Track 2 (Publish -> HLS Transcode): Heavy 4-vCPU Fargate tasks are launched strictly
 *   post-approval when an operator or user clicks "Publish to Vault".
 */

const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const ffmpegPath = require("ffmpeg-static");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pipeline } = require("stream/promises");

const ecsClient = new ECSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const bedrock = new BedrockRuntimeClient({});
const MAX_LAMBDA_VIDEO_BYTES = 256 * 1024 * 1024;

// Store readable UTC timestamps while retaining numeric values for retry checks.
const createTimestamp = () => {
    const epochMs = Date.now();
    return { iso: new Date(epochMs).toISOString(), epochMs };
};

/**
 * Sanitizes raw filenames into URL-safe, lowercase video identifiers.
 */
function sanitizeId(filename) {
    return path.parse(filename).name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '');
}

async function getObjectInfo(bucket, key) {
    const result = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (!Number.isSafeInteger(result.ContentLength) || result.ContentLength < 0) {
        throw new Error(`Could not determine size of s3://${bucket}/${key}.`);
    }
    return { size: result.ContentLength, eTag: result.ETag };
}

async function downloadVideo(bucket, key, eTag, inputPath) {
    const input = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(eTag ? { IfMatch: eTag } : {})
    }));
    if (!input.Body) throw new Error(`S3 returned no video body for s3://${bucket}/${key}.`);
    await pipeline(input.Body, fs.createWriteStream(inputPath));
}

function extractThumbnail(inputPath, thumbnailPath) {
    if (!ffmpegPath) throw new Error("The Lambda FFmpeg binary is unavailable for this runtime.");
    const thumbnail = spawnSync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-ss", "00:00:02", "-i", inputPath,
        "-frames:v", "1", "-q:v", "2", "-update", "1", thumbnailPath
    ], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
    if (thumbnail.status !== 0 || !fs.existsSync(thumbnailPath) || fs.statSync(thumbnailPath).size === 0) {
        const fallbackThumbnail = spawnSync(ffmpegPath, [
            "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
            "-frames:v", "1", "-q:v", "2", "-update", "1", thumbnailPath
        ], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
        if (fallbackThumbnail.status !== 0 || !fs.existsSync(thumbnailPath) || fs.statSync(thumbnailPath).size === 0) {
            throw new Error(`FFmpeg could not extract a thumbnail from the uploaded video: ${fallbackThumbnail.stderr || thumbnail.stderr || "unknown FFmpeg error"}`);
        }
    }
}

async function generateThumbnailInLambda({ bucket, key, eTag, tenantId, familyId, videoId, dbKey }) {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "video-thumbnail-"));
    const inputPath = path.join(workDir, `${videoId}.mp4`);
    const thumbnailPath = path.join(workDir, "thumbnail.jpg");

    try {
        await downloadVideo(bucket, key, eTag, inputPath);
        extractThumbnail(inputPath, thumbnailPath);
        const thumbnailKey = `${tenantId}/${familyId}/${videoId}/thumbnail.jpg`;
        await s3.send(new PutObjectCommand({
            Bucket: process.env.THUMBNAIL_BUCKET,
            Key: thumbnailKey,
            Body: fs.readFileSync(thumbnailPath),
            ContentType: "image/jpeg"
        }));
        const timestamp = createTimestamp();
        await ddb.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: dbKey,
            UpdateExpression: "SET thumbnailKey = :thumbnail, transcodeStatus = :status, lastUpdated = :updated, lastUpdatedEpochMs = :epoch REMOVE processingMode",
            ExpressionAttributeValues: {
                ":thumbnail": thumbnailKey,
                ":status": "REVIEW_PENDING",
                ":updated": timestamp.iso,
                ":epoch": timestamp.epochMs
            }
        }));
    } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
}

async function analyzeVideoInLambda({ bucket, key, eTag, fileName, tenantId, familyId, videoId, dbKey }) {
    if (!ffmpegPath) throw new Error("The Lambda FFmpeg binary is unavailable for this runtime.");

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "video-metadata-"));
    const inputPath = path.join(workDir, `${videoId}.mp4`);
    const thumbnailPath = path.join(workDir, "thumbnail.jpg");
    const gridPath = path.join(workDir, "keyframe_grid.jpg");

    try {
        await downloadVideo(bucket, key, eTag, inputPath);
        extractThumbnail(inputPath, thumbnailPath);

        const probe = spawnSync(ffmpegPath, ["-hide_banner", "-i", inputPath], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
        const durationMatch = (probe.stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (!durationMatch) throw new Error(`FFmpeg could not determine video duration: ${probe.stderr || "no probe output"}`);
        const durationSeconds = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            throw new Error(`FFmpeg returned an invalid video duration: ${durationMatch[0]}`);
        }

        const grid = spawnSync(ffmpegPath, [
            "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
            "-vf", `fps=8.01/${durationSeconds}:round=up,scale=320:-1,tile=3x3:nb_frames=9`,
            "-frames:v", "1", "-q:v", "2", "-update", "1", gridPath
        ], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
        if (grid.status !== 0 || !fs.existsSync(gridPath) || fs.statSync(gridPath).size === 0) {
            throw new Error(`FFmpeg could not create the nine-frame timeline keyframe grid: ${grid.stderr || "unknown FFmpeg error"}`);
        }

        const genreResult = await ddb.send(new QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: { ":pk": "GENRES_REGISTRY", ":sk": "GENRE#" }
        }));
        const approvedGenres = (genreResult.Items || [])
            .map(item => (item.genreName || "").trim())
            .filter(Boolean);
        if (approvedGenres.length === 0) throw new Error("No genres are configured in the DynamoDB genre registry.");

        const genrePromptList = approvedGenres.map(genre => `- ${genre}`).join("\n");
        const prompt = `Inspect the attached 3-by-3 keyframe grid, which shows nine moments sampled evenly from the beginning to the end of the video in reading order. Base your response on the frames; do not infer content from the filename.
Original filename: "${path.basename(fileName)}"
Create a concise metadata draft for a human editor to review.
Write the description like a short streaming-series episode synopsis: lead with the central moment, then describe what unfolds or changes across the video. Keep it engaging, specific, and grounded in the visible action. Do not list incidental details about the room, scenery, lighting, clothing, or camera unless they matter to the story. Do not invent identities, motives, events, or context. If the frames do not reveal what is happening, say that the content is unclear rather than guessing.
Keep the description to 1 or 2 sentences, ideally under 40 words. Avoid repetition, scene-by-scene play-by-play, speculation, and flowery language.

Select EXACTLY ONE genre from this approved Heritage Genre list:
${genrePromptList}

Return a JSON object with exactly four fields: "title" (a short, specific title), "genre" (one exact string from the approved list), "description" (a concise, synopsis-style description of 1 or 2 sentences), and "tags" (an array of relevant keywords). Do not include markdown or explanations outside the JSON object.`;
        const response = await bedrock.send(new InvokeModelCommand({
            modelId: process.env.BEDROCK_MODEL_ID,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 500,
                messages: [{
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: "image/jpeg",
                                data: fs.readFileSync(gridPath).toString("base64")
                            }
                        },
                        { type: "text", text: prompt }
                    ]
                }]
            })
        }));
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const textResponse = responseBody.content?.[0]?.text?.trim();
        if (!textResponse) throw new Error("Bedrock returned an empty metadata response.");
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        const metadata = JSON.parse(jsonMatch ? jsonMatch[0] : textResponse);
        if (typeof metadata.description !== "string" || !metadata.description.trim()) {
            throw new Error("Bedrock response did not include a usable visual description.");
        }

        const thumbnailKey = `${tenantId}/${familyId}/${videoId}/thumbnail.jpg`;
        await s3.send(new PutObjectCommand({
            Bucket: process.env.THUMBNAIL_BUCKET,
            Key: thumbnailKey,
            Body: fs.readFileSync(thumbnailPath),
            ContentType: "image/jpeg"
        }));
        const genre = approvedGenres.includes(metadata.genre) ? metadata.genre : approvedGenres[0];
        const timestamp = createTimestamp();
        await ddb.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: dbKey,
            UpdateExpression: "SET thumbnailKey = :thumbnail, transcodeStatus = :status, aiTitle = :title, aiGenre = :genre, genre = :genre, aiDescription = :description, aiTags = :tags, lastUpdated = :updated, lastUpdatedEpochMs = :epoch REMOVE processingMode",
            ExpressionAttributeValues: {
                ":thumbnail": thumbnailKey,
                ":status": "REVIEW_PENDING",
                ":title": typeof metadata.title === "string" && metadata.title.trim() ? metadata.title.trim() : path.parse(fileName).name,
                ":genre": genre,
                ":description": metadata.description.trim(),
                ":tags": Array.isArray(metadata.tags) ? metadata.tags : [],
                ":updated": timestamp.iso,
                ":epoch": timestamp.epochMs
            }
        }));
    } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
}

async function launchFargateProcessingTask({ key, tenantId, familyId, videoId, mode }) {
    const taskResult = await ecsClient.send(new RunTaskCommand({
        cluster: process.env.CLUSTER_NAME,
        taskDefinition: process.env.TASK_DEFINITION,
        launchType: "FARGATE",
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: JSON.parse(process.env.SUBNETS),
                securityGroups: JSON.parse(process.env.SECURITY_GROUPS),
                assignPublicIp: "ENABLED",
            },
        },
        overrides: {
            cpu: "256",
            memory: "512",
            containerOverrides: [{
                name: process.env.CONTAINER_NAME,
                environment: [
                    { name: "INPUT_KEY", value: key },
                    { name: "TENANT_ID", value: tenantId },
                    { name: "FAMILY_ID", value: familyId },
                    { name: "VIDEO_ID", value: videoId },
                    { name: "CONTAINER_MODE", value: mode }
                ],
            }],
        },
    }));

    if (taskResult.failures?.length || !taskResult.tasks?.length) {
        throw new Error(`Fargate metadata task did not start: ${JSON.stringify(taskResult.failures || [])}`);
    }
    return taskResult.tasks[0].taskArn;
}

/**
 * Main Handler: Processes direct publish invocations or S3 upload event notifications.
 */
exports.handler = async (event) => {
    console.log("Orchestrator triggered with event:", JSON.stringify(event));

    // Case 1: Track 2 - Direct Ingestion Trigger for full HLS transcode pass after review approval
    if (event.action === "START_TRANSCODE") {
        const { tenantId, familyId, videoId, videoKey } = event;
        console.log(`Track 2 HLS Encoding: Launching 4-vCPU Fargate Transcode for ${videoId}`);

        const dbKey = {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${familyId}#VIDEO#${videoId}`
        };

        try {
            const timestamp = createTimestamp();
            await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_NAME,
                Key: dbKey,
                UpdateExpression: "SET transcodeStatus = :s, lastUpdated = :t, lastUpdatedEpochMs = :epoch",
                ExpressionAttributeValues: {
                    ":s": "TRANSCODING",
                    ":t": timestamp.iso,
                    ":epoch": timestamp.epochMs
                }
            }));
        } catch (dbErr) {
            console.error("Failed to update status to TRANSCODING:", dbErr);
            throw dbErr;
        }

        // Configure ECS Fargate Task for 4 vCPU / 8GB RAM high-power FFmpeg encoding ladder
        const params = {
            cluster: process.env.CLUSTER_NAME,
            taskDefinition: process.env.TASK_DEFINITION,
            launchType: "FARGATE",
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: JSON.parse(process.env.SUBNETS),
                    securityGroups: JSON.parse(process.env.SECURITY_GROUPS),
                    assignPublicIp: "ENABLED",
                },
            },
            overrides: {
                cpu: "4096",
                memory: "8192",
                containerOverrides: [
                    {
                        name: process.env.CONTAINER_NAME,
                        environment: [
                            { name: "INPUT_KEY", value: videoKey },
                            { name: "TENANT_ID", value: tenantId },
                            { name: "FAMILY_ID", value: familyId },
                            { name: "VIDEO_ID", value: videoId },
                            { name: "CONTAINER_MODE", value: "TRANSCODE_HLS" }
                        ],
                    },
                ],
            },
        };

        const data = await ecsClient.send(new RunTaskCommand(params));
        console.log("Heavy Transcode Fargate Task started successfully:", data.tasks[0]?.taskArn);
        return { success: true, taskArn: data.tasks[0]?.taskArn };
    }

    // Case 2: Track 1 - S3 Object-Created Event via SQS Queue (100% Lambda Upload Intake)
    if (event.Records) {
        for (const record of event.Records) {
            const body = JSON.parse(record.body);
            let bucket, key, eventSize;

            if (body.detail && body.detail.bucket) {
                bucket = body.detail.bucket.name;
                key = decodeURIComponent(body.detail.object.key.replace(/\+/g, " "));
                eventSize = body.detail.object.size;
            } else if (body.Records && body.Records[0].s3) {
                bucket = body.Records[0].s3.bucket.name;
                key = decodeURIComponent(body.Records[0].s3.object.key.replace(/\+/g, " "));
                eventSize = body.Records[0].s3.object.size;
            }

            if (!bucket || !key) continue;

            // Parse S3 Key structure: <tenantId>/<familyId>/<filename.mp4> or <familyId>/<filename.mp4>
            const parts = key.split('/');
            let tenantId = 'PRIMARY_VAULT';
            let familyId = 'PUBLIC';
            let fileName = "";

            if (parts.length >= 3) {
                tenantId = parts[0];
                familyId = parts[1];
                fileName = parts[2];
            } else if (parts.length === 2) {
                tenantId = 'PRIMARY_VAULT';
                familyId = parts[0];
                fileName = parts[1];
            } else {
                fileName = key;
            }

            const videoId = sanitizeId(fileName);
            console.log(`Processing Track 1 Intake - Tenant: ${tenantId}, Family: ${familyId}, VideoId: ${videoId}`);

            const dbKey = {
                PK: `TENANT#${tenantId}`,
                SK: `FAMILY#${familyId}#VIDEO#${videoId}`
            };

            // Inspect item state in DynamoDB
            try {
                const itemRes = await ddb.send(new GetCommand({
                    TableName: process.env.TABLE_NAME,
                    Key: dbKey
                }));
                const existingItem = itemRes.Item;

                if (existingItem?.transcodeStatus === "REVIEW_PENDING") {
                    console.log(`Item ${videoId} is already in REVIEW_PENDING status. Skipping intake.`);
                    continue;
                }

                if (existingItem?.useAi === true) {
                    const objectInfo = await getObjectInfo(bucket, key);
                    const useLambda = objectInfo.size < MAX_LAMBDA_VIDEO_BYTES;
                    if (Number.isSafeInteger(eventSize) && eventSize !== objectInfo.size) {
                        console.warn(`Upload event size (${eventSize}) differs from current S3 object size (${objectInfo.size}) for ${key}; routing by current size.`);
                    }
                    console.log(`AI metadata route for ${videoId}: ${objectInfo.size} bytes -> ${useLambda ? "Lambda" : "Fargate"}`);
                    try {
                        const timestamp = createTimestamp();
                        await ddb.send(new UpdateCommand({
                            TableName: process.env.TABLE_NAME,
                            Key: dbKey,
                            UpdateExpression: "SET transcodeStatus = :processing, lastUpdated = :updated, lastUpdatedEpochMs = :epoch, processingMode = :mode",
                            ConditionExpression: "transcodeStatus = :uploading OR transcodeStatus = :failed OR transcodeStatus = :ingested OR (transcodeStatus = :processing AND processingMode = :lambda AND ((attribute_not_exists(lastUpdatedEpochMs) AND lastUpdated < :stale) OR lastUpdatedEpochMs < :stale))",
                            ExpressionAttributeValues: {
                                ":processing": "PROCESSING",
                                ":uploading": "UPLOADING",
                                ":failed": "FAILED",
                                ":ingested": "INGESTED",
                                ":lambda": "LAMBDA",
                                ":mode": useLambda ? "LAMBDA" : "FARGATE",
                                ":updated": timestamp.iso,
                                ":epoch": timestamp.epochMs,
                                ":stale": timestamp.epochMs - 11 * 60 * 1000
                            }
                        }));
                    } catch (stateErr) {
                        if (stateErr.name === "ConditionalCheckFailedException") {
                            console.log(`AI metadata extraction for ${videoId} is already processing. Skipping duplicate event.`);
                            continue;
                        }
                        throw stateErr;
                    }

                    try {
                        if (useLambda) {
                            if (!process.env.BEDROCK_MODEL_ID) throw new Error("BEDROCK_MODEL_ID is not configured.");
                            await analyzeVideoInLambda({ bucket, key, eTag: objectInfo.eTag, fileName, tenantId, familyId, videoId, dbKey });
                            console.log(`Completed keyframe-based AI metadata extraction in Lambda for ${videoId}.`);
                        } else {
                            const taskArn = await launchFargateProcessingTask({
                                key, tenantId, familyId, videoId, mode: "METADATA_EXTRACT"
                            });
                            console.log(`Started keyframe-based AI metadata extraction for ${videoId}: ${taskArn}`);
                        }
                    } catch (launchErr) {
                        const timestamp = createTimestamp();
                        await ddb.send(new UpdateCommand({
                            TableName: process.env.TABLE_NAME,
                            Key: dbKey,
                            UpdateExpression: "SET transcodeStatus = :failed, lastUpdated = :updated, lastUpdatedEpochMs = :epoch REMOVE processingMode",
                            ExpressionAttributeValues: {
                                ":failed": "FAILED",
                                ":updated": timestamp.iso,
                                ":epoch": timestamp.epochMs
                            }
                        }));
                        throw launchErr;
                    }

                    continue;
                }

                console.log(`Manual Track 1 ingestion: generating thumbnail for ${videoId}.`);
                const objectInfo = await getObjectInfo(bucket, key);
                const useLambda = objectInfo.size < MAX_LAMBDA_VIDEO_BYTES;
                const processingMode = useLambda ? "THUMBNAIL_LAMBDA" : "THUMBNAIL_FARGATE";

                try {
                    const timestamp = createTimestamp();
                    await ddb.send(new UpdateCommand({
                        TableName: process.env.TABLE_NAME,
                        Key: dbKey,
                        UpdateExpression: "SET transcodeStatus = :processing, lastUpdated = :updated, lastUpdatedEpochMs = :epoch, processingMode = :mode, videoKey = :videoKey, familyId = :familyId",
                        ConditionExpression: "transcodeStatus = :uploading OR transcodeStatus = :failed OR transcodeStatus = :ingested OR (transcodeStatus = :processing AND processingMode = :mode AND ((attribute_not_exists(lastUpdatedEpochMs) AND lastUpdated < :stale) OR lastUpdatedEpochMs < :stale))",
                        ExpressionAttributeValues: {
                            ":processing": "PROCESSING",
                            ":uploading": "UPLOADING",
                            ":failed": "FAILED",
                            ":ingested": "INGESTED",
                            ":mode": processingMode,
                            ":updated": timestamp.iso,
                            ":epoch": timestamp.epochMs,
                            ":videoKey": key,
                            ":familyId": familyId,
                            ":stale": timestamp.epochMs - 60 * 60 * 1000
                        }
                    }));
                } catch (stateErr) {
                    if (stateErr.name === "ConditionalCheckFailedException") {
                        console.log(`Thumbnail generation for ${videoId} is already processing. Skipping duplicate event.`);
                        continue;
                    }
                    throw stateErr;
                }

                try {
                    if (useLambda) {
                        await generateThumbnailInLambda({
                            bucket, key, eTag: objectInfo.eTag, tenantId, familyId, videoId, dbKey
                        });
                        console.log(`Generated thumbnail in Lambda for ${videoId}.`);
                    } else {
                        const taskArn = await launchFargateProcessingTask({
                            key, tenantId, familyId, videoId, mode: "THUMBNAIL_ONLY"
                        });
                        console.log(`Started Fargate thumbnail generation for ${videoId}: ${taskArn}`);
                    }
                } catch (thumbnailErr) {
                    const timestamp = createTimestamp();
                    await ddb.send(new UpdateCommand({
                        TableName: process.env.TABLE_NAME,
                        Key: dbKey,
                        UpdateExpression: "SET transcodeStatus = :failed, lastUpdated = :updated, lastUpdatedEpochMs = :epoch REMOVE processingMode",
                        ExpressionAttributeValues: {
                            ":failed": "FAILED",
                            ":updated": timestamp.iso,
                            ":epoch": timestamp.epochMs
                        }
                    }));
                    throw thumbnailErr;
                }

            } catch (getErr) {
                console.error("Could not evaluate intake item status:", getErr);
                throw getErr;
            }
        }
    }
};
