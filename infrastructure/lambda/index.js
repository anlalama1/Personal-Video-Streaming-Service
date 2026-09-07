const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

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
    const path = event.resource;
    const method = event.httpMethod;
    const tenantId = event.headers['x-tenant-id'] || 'GLOBAL';

    console.log(`Scribe Request: ${method} ${path} for Tenant: ${tenantId}`);

    if (path === '/catalog' && method === 'GET') {
        return handleGetCatalog(event, tenantId);
    } else if (path === '/ingest' && method === 'POST') {
        return handleIngest(event, tenantId);
    } else if (path === '/upload-url' && method === 'GET') {
        return handleGetUploadUrl(event, tenantId);
    }

    return { statusCode: 404, body: JSON.stringify({ message: "Not Found" }) };
};

async function handleGetCatalog(event, tenantId) {
    const familyId = event.headers['x-family-id'];
    const tableName = process.env.TABLE_NAME;
    const cdnDomain = process.env.CLOUDFRONT_DOMAIN;

    try {
        /**
         * Lead Strategy: Hierarchical Filter.
         * If familyId is provided (Phone), we look for VIDEOs in that family.
         * If omitted (Portal), we look for ALL families in the tenant partition.
         */
        const skPrefix = familyId ? `FAMILY#${familyId}#VIDEO#` : "FAMILY#";

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
            const skParts = item.SK.split('#');
            const videoId = skParts[skParts.length - 1];
            const itemFamilyId = skParts[1];

            // Skip non-video records if any
            if (!item.SK.includes("#VIDEO#")) return null;

            const videoUrl = item.hlsKey
                ? `https://${cdnDomain}/hls/${tenantId}/${itemFamilyId}/${item.hlsKey}/master.m3u8`
                : `https://${cdnDomain}/${item.videoKey}`;

            const thumbnailUrl = item.thumbnailKey
                ? `https://${cdnDomain}/thumbnails/${item.thumbnailKey}`
                : "https://via.placeholder.com/150";

            return { ...item, videoId, videoUrl, thumbnailUrl };
        };

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify(items.map(mapToCdn).filter(i => i !== null)),
        };
    } catch (error) {
        console.error("Catalog Error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}

async function handleIngest(event, tenantId) {
    const body = JSON.parse(event.body || "{}");
    const { videoId, title, genre, releaseYear, familyId, videoFileName, thumbnailFileName } = body;

    if (!videoId || !title || !familyId) {
        return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields" }) };
    }

    const tableName = process.env.TABLE_NAME;
    const now = Date.now();

    try {
        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: {
                PK: `TENANT#${tenantId}`,
                SK: `FAMILY#${familyId}#VIDEO#${videoId}`,
                title,
                genre,
                releaseYear,
                videoKey: `${tenantId}/${familyId}/${videoFileName}`,
                thumbnailKey: thumbnailFileName,
                transcodeStatus: "INGESTED",
                lastUpdated: now,
                retryCount: 0
            }
        }));

        return {
            statusCode: 201,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Metadata ingested successfully" })
        };
    } catch (error) {
        console.error("Ingest Error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}

async function handleGetUploadUrl(event, tenantId) {
    const key = event.queryStringParameters.key;
    const contentType = event.queryStringParameters.contentType || 'video/mp4';

    if (!key) return { statusCode: 400, body: JSON.stringify({ message: "Missing key" }) };

    try {
        const command = new PutObjectCommand({
            Bucket: process.env.MEDIA_BUCKET,
            Key: key,
            ContentType: contentType
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ uploadUrl: url })
        };
    } catch (error) {
        console.error("Pre-sign Error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}

exports.logPlayHandler = async (event) => {
    const tenantId = event.headers['x-tenant-id'] || 'GLOBAL';
    const body = JSON.parse(event.body || "{}");
    const videoId = body.videoId;
    const familyId = event.headers['x-family-id'] || 'PUBLIC';

    if (!videoId) return { statusCode: 400, body: JSON.stringify({ message: "Missing videoId" }) };

    try {
        const response = await docClient.send(new GetCommand({
            TableName: process.env.TABLE_NAME,
            Key: { PK: `TENANT#${tenantId}`, SK: `FAMILY#${familyId}#VIDEO#${videoId}` }
        }));

        const video = response.Item;
        const title = video ? video.title : "Unknown Title";

        emitMetric("VideoPlayCount", 1, "Count", {
            VideoId: videoId,
            Title: title,
            Tenant: tenantId
        });

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ status: "logged", videoId, title }),
        };
    } catch (error) {
        console.error("Error logging play event:", error);
        return { statusCode: 500, body: JSON.stringify({ message: "Error logging event" }) };
    }
};
