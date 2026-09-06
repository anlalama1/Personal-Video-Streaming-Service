const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const path = require("path");

const ecsClient = new ECSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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

        if (!bucket || !key) {
            console.log("Skipping record: Not a valid S3 event shape.");
            continue;
        }

        const videoId = path.basename(key, path.extname(key));
        console.log(`Processing Video: ${videoId} (Key: ${key})`);

        /**
         * Principal Strategy: Atomic Lock.
         * Before starting Fargate, we attempt to move the state to TRANSCODING.
         * This prevents multiple tasks for the same video if events are duplicated
         * or if the sweeper triggers while a task is already running.
         */
        try {
            console.log(`Attempting to acquire lock for ${videoId}...`);
            await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_NAME,
                Key: { videoId },
                // Only acquire lock if state is null, INGESTED, or FAILED.
                // This blocks if already TRANSCODING or COMPLETED.
                ConditionExpression: "attribute_not_exists(transcodeStatus) OR transcodeStatus = :i OR transcodeStatus = :f",
                UpdateExpression: "SET transcodeStatus = :s, lastUpdated = :t, retryCount = if_not_exists(retryCount, :zero) + :inc",
                ExpressionAttributeValues: {
                    ":i": "INGESTED",
                    ":f": "FAILED",
                    ":s": "TRANSCODING",
                    ":t": Date.now(),
                    ":zero": 0,
                    ":inc": 1
                }
            }));
        } catch (err) {
            if (err.name === "ConditionalCheckFailedException") {
                console.warn(`Concurrency Guard: Task for ${videoId} is already in progress or completed. Skipping.`);
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
                        environment: [{ name: "INPUT_KEY", value: key }],
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
            // On failure to start task, move status back to FAILED so sweeper can retry
            await ddb.send(new UpdateCommand({
                TableName: process.env.TABLE_NAME,
                Key: { videoId },
                UpdateExpression: "SET transcodeStatus = :f, lastUpdated = :t",
                ExpressionAttributeValues: { ":f": "FAILED", ":t": Date.now() }
            }));
            throw err;
        }
    }
};
