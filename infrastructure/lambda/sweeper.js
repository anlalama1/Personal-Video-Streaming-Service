const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});

const TABLE_NAME = process.env.TABLE_NAME;
const QUEUE_URL = process.env.QUEUE_URL;

function emitMetric(name, value, unit, dimensions = {}) {
    const logEntry = {
        "_aws": {
            "Timestamp": Date.now(),
            "CloudWatchMetrics": [{
                "Namespace": "StreamingService",
                "Dimensions": [Object.keys(dimensions)],
                "Metrics": [{ "Name": name, "Unit": unit }]
            }]
        },
        ...dimensions,
        [name]: value
    };
    console.log(JSON.stringify(logEntry));
}

exports.handler = async (event) => {
    console.log("Starting Multi-Tenant Transcoding Sweep...");

    try {
        const fullScan = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
        const allItems = fullScan.Items || [];

        const counts = { TOTAL: allItems.length, COMPLETED: 0, TRANSCODING: 0, FAILED: 0, FATAL: 0, INGESTED: 0 };

        for (const item of allItems) {
            // Skip non-video items (e.g., Shop Metadata)
            if (!item.SK || !item.SK.startsWith("VIDEO#")) continue;

            let status = item.transcodeStatus;

            if (!status && item.hlsKey) {
                status = "COMPLETED";
                await ddb.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: item.PK, SK: item.SK },
                    UpdateExpression: "SET transcodeStatus = :s",
                    ExpressionAttributeValues: { ":s": "COMPLETED" }
                }));
            }

            const effectiveStatus = status || "INGESTED";
            if (counts[effectiveStatus] !== undefined) counts[effectiveStatus]++;

            // 3. Filter for items that actually need retrying
            const now = Date.now();
            const TEN_MINUTES_MS = 10 * 60 * 1000;

            if (!item.hlsKey && (effectiveStatus === "INGESTED" || effectiveStatus === "FAILED")) {
                const videoId = item.videoId || item.SK.replace("VIDEO#", "");
                const retryCount = item.retryCount || 0;
                const lastUpdated = item.lastUpdated || 0;

                if (now - lastUpdated < TEN_MINUTES_MS) continue;

                if (retryCount >= 3) {
                    console.warn(`CRITICAL: ${videoId} marked as FATAL.`);
                    await ddb.send(new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: { PK: item.PK, SK: item.SK },
                        UpdateExpression: "set transcodeStatus = :s, lastUpdated = :t",
                        ExpressionAttributeValues: { ":s": "FATAL", ":t": now }
                    }));
                    emitMetric("FatalTranscodeFailure", 1, "Count", { VideoId: videoId, TenantId: item.PK });
                    continue;
                }

                console.log(`Triggering retry for ${videoId} in ${item.PK}...`);
                await sqs.send(new SendMessageCommand({
                    QueueUrl: QUEUE_URL,
                    MessageBody: JSON.stringify({
                        detail: {
                            bucket: { name: "retry" },
                            object: { key: item.videoKey }
                        },
                        isRetry: true
                    })
                }));
            }
        }

        // Emit counts as EMF metrics
        Object.keys(counts).forEach(status => {
            emitMetric("VideoCountByStatus", counts[status], "Count", { Status: status });
        });

    } catch (err) {
        console.error("Sweeper Failed:", err);
        throw err;
    }
};
