/**
 * ============================================================================
 * Sweeper & Automated Governance Lambda Function
 * ============================================================================
 * Architecture Pattern: Scheduled Cron Job & Automated Governance Purge.
 *
 * Enterprise Decision Rationale:
 * 1. Two-Phase Soft Delete: When items are deleted by users, they enter 'DELETED' state.
 *    The Sweeper periodically scans and hard-purges expired assets (S3 source MP4,
 *    S3 thumbnails, S3 HLS segments, DynamoDB metadata) after a 30-day retention window.
 * 2. Self-Healing Failover: Detects failed/stuck transcoding passes, emits CloudWatch EMF metrics,
 *    and automatically re-queues retryable jobs to SQS.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});
const s3 = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME;
const QUEUE_URL = process.env.QUEUE_URL;
const RETENTION_PERIOD_HOURS = parseInt(process.env.RETENTION_PERIOD_HOURS || "720"); // Default: 30 days (720 hrs)
const SOURCE_BUCKET = process.env.SOURCE_BUCKET;
const THUMBNAIL_BUCKET = process.env.THUMBNAIL_BUCKET;
const DEST_BUCKET = process.env.DEST_BUCKET;

/**
 * Emits Structured JSON for AWS CloudWatch Embedded Metric Format (EMF).
 */
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

/**
 * Helper to recursively purge an entire S3 directory prefix (e.g., all HLS stream segments).
 */
async function purgeS3Folder(bucket, prefix) {
    if (!prefix) return;
    console.log(`Purging S3 Folder: s3://${bucket}/${prefix}`);

    let continuationToken;
    do {
        const listParams = { Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken };
        const listedObjects = await s3.send(new ListObjectsV2Command(listParams));

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) break;

        const deleteParams = {
            Bucket: bucket,
            Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) }
        };

        await s3.send(new DeleteObjectsCommand(deleteParams));
        continuationToken = listedObjects.NextContinuationToken;
    } while (continuationToken);
}

/**
 * Helper to delete a single object from S3 safely.
 */
async function deleteS3Object(bucket, key) {
    if (!key) return;
    console.log(`Deleting S3 Object: s3://${bucket}/${key}`);
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
        console.warn(`Failed to delete s3://${bucket}/${key}:`, err.message);
    }
}

/**
 * Scheduled Sweeper Entry Point
 */
exports.handler = async (event) => {
    console.log("Starting Multi-Tenant Transcoding Sweep & Governance Purge...");
    const now = Date.now();

    try {
        const fullScan = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
        const allItems = fullScan.Items || [];

        const counts = { TOTAL: allItems.length, COMPLETED: 0, TRANSCODING: 0, FAILED: 0, FATAL: 0, INGESTED: 0, DELETED: 0 };

        for (const item of allItems) {
            // Skip non-video items
            if (!item.SK || !item.SK.includes("#VIDEO#")) continue;

            let status = item.transcodeStatus;

            // 1. Two-Phase Hard Purge Phase
            if (status === "DELETED") {
                counts.DELETED++;
                const deletedAt = item.deletedAt || 0;
                const hoursSinceDeletion = (now - deletedAt) / (1000 * 60 * 60);

                if (hoursSinceDeletion >= RETENTION_PERIOD_HOURS) {
                    console.log(`HARD PURGE: Retention period expired for ${item.SK}. Cleaning up assets...`);

                    // Clean up source MP4, thumbnail, and HLS segment folder in parallel
                    await deleteS3Object(SOURCE_BUCKET, item.videoKey);
                    await deleteS3Object(THUMBNAIL_BUCKET, item.thumbnailKey);
                    if (item.hlsKey) {
                        const skParts = item.SK.split('#');
                        const tenantId = item.PK.replace("TENANT#", "");
                        const familyId = skParts[1];
                        const hlsPrefix = `${tenantId}/${familyId}/${item.hlsKey}`;
                        await purgeS3Folder(DEST_BUCKET, hlsPrefix);
                    }

                    // Delete DynamoDB record permanently
                    await ddb.send(new DeleteCommand({
                        TableName: TABLE_NAME,
                        Key: { PK: item.PK, SK: item.SK }
                    }));
                    console.log(`HARD PURGE COMPLETE: ${item.SK} removed from database.`);
                    continue;
                }
            }

            // 2. Legacy status recovery
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

            // 3. Automated Self-Healing Retry Loop
            const TEN_MINUTES_MS = 10 * 60 * 1000;

            if (!item.hlsKey && (effectiveStatus === "INGESTED" || effectiveStatus === "FAILED")) {
                const lastUpdated = item.lastUpdated || 0;
                if (now - lastUpdated < TEN_MINUTES_MS) continue;

                const retryCount = item.retryCount || 0;
                if (retryCount >= 3) {
                    // Mark as FATAL after 3 failed retry attempts
                    await ddb.send(new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: { PK: item.PK, SK: item.SK },
                        UpdateExpression: "set transcodeStatus = :s, lastUpdated = :t",
                        ExpressionAttributeValues: { ":s": "FATAL", ":t": now }
                    }));
                    continue;
                }

                console.log(`Triggering retry for ${item.SK}...`);
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

        // Emit counts as CloudWatch EMF metrics
        Object.keys(counts).forEach(status => {
            emitMetric("VideoCountByStatus", counts[status], "Count", { Status: status });
        });

    } catch (err) {
        console.error("Sweeper Failed:", err);
        throw err;
    }
};
