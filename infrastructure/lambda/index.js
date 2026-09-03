const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * EMF Helper to generate formatted logs that CloudWatch parses into metrics.
 */
function emitMetric(name, value, unit, dimensions = {}, namespace = "StreamingService") {
    const dimensionKeys = Object.keys(dimensions);
    const logEntry = {
        "_aws": {
            "Timestamp": Date.now(),
            "CloudWatchMetrics": [{
                "Namespace": namespace,
                // Senior SDE Tip: By providing two dimension sets (specific and empty),
                // we allow CloudWatch to track both the individual video stats AND
                // the total aggregate across the entire service simultaneously.
                "Dimensions": [dimensionKeys, []],
                "Metrics": [{ "Name": name, "Unit": unit }]
            }]
        },
        ...dimensions,
        [name]: value
    };
    console.log(JSON.stringify(logEntry));
}

exports.handler = async (event) => {
    console.log("Fetching catalog from DynamoDB...");

    // Emit EMF Metric for Catalog Request
    emitMetric("CatalogRequestCount", 1, "Count", { Service: "CatalogService" });

    const tableName = process.env.TABLE_NAME;
    const cdnDomain = process.env.CLOUDFRONT_DOMAIN;

    try {
        const command = new ScanCommand({ TableName: tableName });
        const response = await docClient.send(command);
        const items = response.Items || [];

        const mapToCdn = (item) => {
            return {
                ...item,
                thumbnailUrl: transformUrl(item.thumbnailUrl, cdnDomain, "thumbnails"),
                videoUrl: transformUrl(item.videoUrl, cdnDomain)
            };
        };

        if (items.length === 0) {
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify([
                    {
                        videoId: "mock-1",
                        title: "Fortress Deployment Successful",
                        genre: "Security",
                        releaseYear: "2026",
                        thumbnailUrl: "https://via.placeholder.com/150",
                        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    }
                ]),
            };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(items.map(mapToCdn)),
        };
    } catch (error) {
        console.error("Error scanning DynamoDB:", error);

        // SDE Logic: Track backend errors
        emitMetric("ApiErrorCount", 1, "Count", {
            Service: "CatalogService",
            ErrorCode: "DynamoDBScanError"
        });

        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
        };
    }
};

/**
 * Handler for logging play events and emitting video-specific metrics.
 */
exports.logPlayHandler = async (event) => {
    console.log("Logging play event...");

    const body = JSON.parse(event.body || "{}");
    const videoId = body.videoId;
    const tableName = process.env.TABLE_NAME;

    if (!videoId) {
        return { statusCode: 400, body: JSON.stringify({ message: "Missing videoId" }) };
    }

    try {
        // Fetch metadata to get a clean title for the metric dimension
        const response = await docClient.send(new GetCommand({
            TableName: tableName,
            Key: { videoId: videoId }
        }));

        const video = response.Item;
        const title = video ? video.title : "Unknown Title";

        // Emit EMF Metric with Video Dimensions
        emitMetric("VideoPlayCount", 1, "Count", {
            VideoId: videoId,
            Title: title
        });

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ status: "logged", videoId, title }),
        };
    } catch (error) {
        console.error("Error logging play event:", error);

        emitMetric("ApiErrorCount", 1, "Count", {
            Service: "PlayLogService",
            ErrorCode: "LoggingFailure"
        });

        return { statusCode: 500, body: JSON.stringify({ message: "Error logging event" }) };
    }
};

function transformUrl(rawUrl, cdnDomain, prefix = "") {
    if (!rawUrl || !rawUrl.includes("amazonaws.com")) return rawUrl;
    try {
        const url = new URL(rawUrl);
        const key = url.pathname;
        const path = prefix ? `/${prefix}${key}` : key;
        return `https://${cdnDomain}${path}`;
    } catch (e) {
        return rawUrl;
    }
}
