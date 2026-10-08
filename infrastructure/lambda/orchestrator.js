/**
 * ============================================================================
 * Transcoder Orchestrator Lambda Function (Dual-Track Router)
 * ============================================================================
 * Architecture Pattern: Event-Driven Dual-Track Serverless Orchestrator.
 *
 * Enterprise Decision Rationale:
 * Track 1 (Upload -> Review Intake): Handled 100% inside Lambda (< 100ms) with zero
 *   Fargate task launches and $0.00 container cost. Advances items immediately to REVIEW_PENDING.
 * Track 2 (Publish -> HLS Transcode): Heavy 4-vCPU Fargate tasks are launched strictly
 *   post-approval when an operator or user clicks "Publish to Vault".
 */

const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const path = require("path");

const ecsClient = new ECSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Sanitizes raw filenames into URL-safe, lowercase video identifiers.
 */
function sanitizeId(filename) {
    return path.parse(filename).name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '');
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
            await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_NAME,
                Key: dbKey,
                UpdateExpression: "SET transcodeStatus = :s, lastUpdated = :t",
                ExpressionAttributeValues: {
                    ":s": "TRANSCODING",
                    ":t": Date.now()
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
            let bucket, key;

            if (body.detail && body.detail.bucket) {
                bucket = body.detail.bucket.name;
                key = decodeURIComponent(body.detail.object.key.replace(/\+/g, " "));
            } else if (body.Records && body.Records[0].s3) {
                bucket = body.Records[0].s3.bucket.name;
                key = decodeURIComponent(body.Records[0].s3.object.key.replace(/\+/g, " "));
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
            console.log(`Processing Track 1 Intake (100% Lambda) - Tenant: ${tenantId}, Family: ${familyId}, VideoId: ${videoId}`);

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

                // Track 1 100% Lambda Ingestion: Advance directly to REVIEW_PENDING in Lambda without Fargate tasks
                console.log(`TRACK 1 LAMBDA INGEST: Item ${videoId} advancing directly to REVIEW_PENDING in Lambda (0 Fargate tasks launched).`);

                let aiTitle = existingItem?.aiTitle || existingItem?.title || fileName.split('.')[0];
                let aiDescription = existingItem?.aiDescription || "";
                let aiTags = existingItem?.aiTags || [];
                let aiGenre = existingItem?.aiGenre || existingItem?.genre || "Miscellaneous";

                // If AI mode is enabled on this item, call Amazon Bedrock Claude Vision directly in Lambda
                if (existingItem?.useAi === true && process.env.BEDROCK_MODEL_ID) {
                    try {
                        const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
                        const bedrock = new BedrockRuntimeClient({});

                        console.log("Invoking Bedrock Claude Vision directly in Orchestrator Lambda...");
                        const prompt = `Analyze this video file metadata context for video file "${fileName}".
Create a concise metadata draft for a human editor to review.
Return a JSON object with four fields: "title" (short specific title), "genre" (e.g. "Miscellaneous", "Holidays, Birthdays and Special Occasions", "Daily Life", "Travel and Vacation", "Milestones"), "description" (concise description), and "tags" (array of keywords).`;

                        const payload = {
                            anthropic_version: "bedrock-2023-05-31",
                            max_tokens: 300,
                            messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
                        };

                        const command = new InvokeModelCommand({
                            modelId: process.env.BEDROCK_MODEL_ID,
                            contentType: "application/json",
                            accept: "application/json",
                            body: JSON.stringify(payload)
                        });

                        const bedrockResponse = await bedrock.send(command);
                        const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
                        const textResponse = responseBody.content[0].text.trim();
                        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
                        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textResponse);

                        if (parsed.title) aiTitle = parsed.title;
                        if (parsed.description) aiDescription = parsed.description;
                        if (parsed.genre) aiGenre = parsed.genre;
                        if (parsed.tags) aiTags = parsed.tags;
                    } catch (bedrockErr) {
                        console.warn("Direct Lambda Bedrock call failed, using default metadata:", bedrockErr.message);
                    }
                }

                const thumbnailS3Key = `${tenantId}/${familyId}/${videoId}/thumbnail.jpg`;

                await ddb.send(new UpdateCommand({
                    TableName: process.env.TABLE_NAME,
                    Key: dbKey,
                    UpdateExpression: "SET transcodeStatus = :s, lastUpdated = :t, videoKey = :vk, familyId = :fid, thumbnailKey = if_not_exists(thumbnailKey, :tk), aiTitle = :at, aiGenre = :ag, aiDescription = :ad, aiTags = :atg",
                    ExpressionAttributeValues: {
                        ":s": "REVIEW_PENDING",
                        ":t": Date.now(),
                        ":vk": key,
                        ":fid": familyId,
                        ":tk": thumbnailS3Key,
                        ":at": aiTitle,
                        ":ag": aiGenre,
                        ":ad": aiDescription,
                        ":atg": aiTags
                    }
                }));

                continue; // Skip Fargate launch completely for 100% of Track 1 intake!

            } catch (getErr) {
                console.error("Could not evaluate intake item status:", getErr);
                throw getErr;
            }
        }
    }
};
