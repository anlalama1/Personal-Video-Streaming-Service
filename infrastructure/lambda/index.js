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

    emitMetric("CatalogRequestCount", 1, "Count", { Service: "CatalogService" });

    const tableName = process.env.TABLE_NAME;
    const cdnDomain = process.env.CLOUDFRONT_DOMAIN;

    try {
        const command = new ScanCommand({ TableName: tableName });
        const response = await docClient.send(command);
        const items = response.Items || [];

        /**
         * Lead Strategy: Late Binding.
         * The database now only stores 'Key' paths (e.g., 'movie.mp4').
         * The Lambda constructs the full CloudFront URL at runtime.
         * This makes the data portable across different buckets/domains.
         */
        const mapToCdn = (item) => {
            // Lead Strategy: HLS Key presence acts as the switch
            const videoUrl = item.hlsKey
                ? `https://${cdnDomain}/hls/${item.hlsKey}/master.m3u8`
                : `https://${cdnDomain}/${item.videoKey}`;

            const thumbnailUrl = item.thumbnailKey
                ? `https://${cdnDomain}/thumbnails/${item.thumbnailKey}`
                : "https://via.placeholder.com/150";

            return {
                ...item,
                videoUrl,
                thumbnailUrl
            };
        };

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(items.map(mapToCdn)),
        };
    } catch (error) {
        console.error("Error scanning DynamoDB:", error);
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

exports.logPlayHandler = async (event) => {
    console.log("Logging play event...");

    const body = JSON.parse(event.body || "{}");
    const videoId = body.videoId;
    const tableName = process.env.TABLE_NAME;

    if (!videoId) {
        return { statusCode: 400, body: JSON.stringify({ message: "Missing videoId" }) };
    }

    try {
        const response = await docClient.send(new GetCommand({
            TableName: tableName,
            Key: { videoId: videoId }
        }));

        const video = response.Item;
        const title = video ? video.title : "Unknown Title";

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
