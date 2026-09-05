const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");

const ecsClient = new ECSClient({});

exports.handler = async (event) => {
    console.log("Orchestrator triggered with event:", JSON.stringify(event));

    for (const record of event.Records) {
        const body = JSON.parse(record.body);

        // Lead SDE Tip: Since we switched to EventBridge to avoid circular dependencies,
        // the S3 event metadata is now located in the 'detail' field.
        let bucket, key;

        if (body.detail && body.detail.bucket) {
            // EventBridge Shape (New)
            bucket = body.detail.bucket.name;
            key = decodeURIComponent(body.detail.object.key.replace(/\+/g, " "));
        } else if (body.Records && body.Records[0].s3) {
            // Direct S3 Notification Shape (Old/Fallback)
            bucket = body.Records[0].s3.bucket.name;
            key = decodeURIComponent(body.Records[0].s3.object.key.replace(/\+/g, " "));
        }

        if (!bucket || !key) {
            console.log("Skipping record: Not a valid S3 event shape.");
            continue;
        }

        console.log(`Unpacked S3 Event: Bucket=${bucket}, Key=${key}`);

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
            throw err;
        }
    }
};
