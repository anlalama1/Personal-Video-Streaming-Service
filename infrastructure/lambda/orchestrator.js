const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const path = require("path");

const ecsClient = new ECSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Principal Strategy: Unified ID Generation.
 * Sanitizes filenames to create a stable, shell-safe, and URL-safe videoId.
 */
function sanitizeId(filename) {
    return path.parse(filename).name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '');
}

exports.handler = async (event) => {
    console.log("Orchestrator triggered with event:", JSON.stringify(event));

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

        const parts = key.split('/');
        let tenantId = 'GLOBAL';
        let familyId = 'PUBLIC';
        let fileName = "";

        if (parts.length >= 3) {
            tenantId = parts[0];
            familyId = parts[1];
            fileName = parts[2];
        } else if (parts.length === 2) {
            tenantId = parts[0];
            fileName = parts[1];
        } else {
            fileName = key;
        }

        const videoId = sanitizeId(fileName);
        console.log(`Processing - Tenant: ${tenantId}, Family: ${familyId}, VideoId: ${videoId}`);

        const dbKey = {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${familyId}#VIDEO#${videoId}`
        };

        try {
            /**
             * Principal Strategy: Atomic Lock with correct Hierarchical SK.
             */
            await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_NAME,
                Key: dbKey,
                ConditionExpression: "attribute_not_exists(transcodeStatus) OR transcodeStatus = :i OR transcodeStatus = :f",
                UpdateExpression: "SET transcodeStatus = :s, lastUpdated = :t, retryCount = if_not_exists(retryCount, :zero) + :inc, videoKey = :vk",
                ExpressionAttributeValues: {
                    ":i": "INGESTED",
                    ":f": "FAILED",
                    ":s": "TRANSCODING",
                    ":t": Date.now(),
                    ":zero": 0,
                    ":inc": 1,
                    ":vk": key
                }
            }));
        } catch (err) {
            if (err.name === "ConditionalCheckFailedException") {
                console.warn(`Lock failed for ${videoId}. Task likely in progress.`);
                continue;
            }
            throw err;
        }

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
                containerOverrides: [
                    {
                        name: process.env.CONTAINER_NAME,
                        environment: [
                            { name: "INPUT_KEY", value: key },
                            { name: "TENANT_ID", value: tenantId },
                            { name: "FAMILY_ID", value: familyId },
                            { name: "VIDEO_ID", value: videoId }
                        ],
                    },
                ],
            },
        };

        try {
            console.log("Starting Fargate Task...");
            const data = await ecsClient.send(new RunTaskCommand(params));
            console.log("Fargate Task started successfully:", data.tasks[0].taskArn);
        } catch (err) {
            console.error("Error starting Fargate Task:", err);
            await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_NAME,
                Key: dbKey,
                UpdateExpression: "SET transcodeStatus = :f, lastUpdated = :t",
                ExpressionAttributeValues: { ":f": "FAILED", ":t": Date.now() }
            }));
            throw err;
        }
    }
};
