const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

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
    const tenantId = event.headers['x-tenant-id'] || 'GLOBAL';
    // Lead Strategy: Extract Family ID for deep multi-tenancy.
    // If present, we scope the query to ONLY that family's movies.
    const familyId = event.headers['x-family-id'];

    console.log(`Fetching catalog for Tenant: ${tenantId}, Family: ${familyId || 'ALL'}...`);

    emitMetric("CatalogRequestCount", 1, "Count", { Service: "CatalogService", Tenant: tenantId });

    const tableName = process.env.TABLE_NAME;
    const cdnDomain = process.env.CLOUDFRONT_DOMAIN;

    try {
        /**
         * Principal Strategy: Hierarchical Sort Key Query.
         * If familyId is provided (Android App), we use 'begins_with' to target their cell.
         * If omitted (Partner Portal), we fetch the whole shop partition.
         */
        const skPrefix = familyId ? `FAMILY#${familyId}#VIDEO#` : "VIDEO#";

        const command = new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": `TENANT#${tenantId}`,
                ":sk": skPrefix
            }
        });

        const response = await docClient.send(command);
        const items = response.Items || [];

        const mapToCdn = (item) => {
            // Extract original videoId from the SK (FAMILY#<FID>#VIDEO#<VID>)
            const videoId = item.SK.split('#').pop();

            const videoUrl = item.hlsKey
                ? `https://${cdnDomain}/hls/${tenantId}/${item.hlsKey}/master.m3u8`
                : `https://${cdnDomain}/${item.videoKey}`;

            const thumbnailUrl = item.thumbnailKey
                ? `https://${cdnDomain}/thumbnails/${item.thumbnailKey}`
                : "https://via.placeholder.com/150";

            return {
                ...item,
                videoId: videoId,
                videoUrl,
                thumbnailUrl
            };
        };

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,x-tenant-id,x-family-id"
            },
            body: JSON.stringify(items.map(mapToCdn)),
        };
    } catch (error) {
        console.error("Error querying DynamoDB:", error);
        emitMetric("ApiErrorCount", 1, "Count", { Service: "CatalogService", ErrorCode: "DynamoDBQueryError" });
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
        };
    }
};

exports.logPlayHandler = async (event) => {
    const tenantId = event.headers['x-tenant-id'] || 'GLOBAL';
    const familyId = event.headers['x-family-id'] || 'UNKNOWN';
    const body = JSON.parse(event.body || "{}");
    const videoId = body.videoId;

    // ... (rest of play log logic, now with tenant/family dimensions)
};
