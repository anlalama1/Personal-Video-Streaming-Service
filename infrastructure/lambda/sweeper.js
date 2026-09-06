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
    console.log("Starting Transcoding Sweep & Metric Collection...");

    try {
        // 1. Scan the whole table for a full status overview
        const fullScan = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
        const allItems = fullScan.Items || [];

        // 2. Count statuses for the Dashboard
        const counts = { TOTAL: allItems.length, COMPLETED: 0, TRANSCODING: 0, FAILED: 0, FATAL: 0, INGESTED: 0 };

        allItems.forEach(item => {
            const status = item.transcodeStatus || (item.hlsKey ? "COMPLETED" : "INGESTED");
            if (counts[status] !== undefined) counts[status]++;
        });

        // Emit counts as EMF metrics
        Object.keys(counts).forEach(status => {
            emitMetric("VideoCountByStatus", counts[status], "Count", { Status: status });
        });

        // 3. Filter for items that actually need retrying
        const now = Date.now();
        const TEN_MINUTES_MS = 10 * 60 * 1000;

        const stuckItems = allItems.filter(item => {
            if (item.hlsKey) return false; // Already done
            const status = item.transcodeStatus || "INGESTED";
            return (status === "INGESTED" || status === "FAILED");
        });

        console.log(`Found ${stuckItems.length} items requiring transcode check.`);

        for (const item of stuckItems) {
            const videoId = item.videoId;
            const retryCount = item.retryCount || 0;
            const lastUpdated = item.lastUpdated || 0;

            if (now - lastUpdated < TEN_MINUTES_MS) continue;

            if (retryCount >= 3) {
                console.warn(`CRITICAL: ${videoId} marked as FATAL.`);
                await ddb.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { videoId },
                    UpdateExpression: "set transcodeStatus = :s, lastUpdated = :t",
                    ExpressionAttributeValues: { ":s": "FATAL", ":t": now }
                }));
                emitMetric("FatalTranscodeFailure", 1, "Count", { VideoId: videoId });
                continue;
            }

            console.log(`Triggering retry for ${videoId}...`);
            await sqs.send(new SendMessageCommand({
                QueueUrl: QUEUE_URL,
                MessageBody: JSON.stringify({
                    detail: { bucket: { name: "retry" }, object: { key: item.videoKey } },
                    isRetry: true
                })
            }));
        }
    } catch (err) {
        console.error("Sweeper Failed:", err);
        throw err;
    }
};
