const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

/**
 * Main Scribe Handler - Routes incoming API requests
 */
exports.handler = async (event) => {
    const path = event.resource;
    const method = event.httpMethod;
    const tenantId = event.headers['x-tenant-id'] || 'GLOBAL';

    console.log(`Scribe Request: ${method} ${path} for Tenant: ${tenantId}`);

    try {
        if (path === '/catalog' && method === 'GET') {
            return await handleGetCatalog(event, tenantId);
        } else if (path === '/ingest' && method === 'POST') {
            return await handleIngest(event, tenantId);
        } else if (path === '/upload/start' && method === 'POST') {
            return await handleStartMultipart(event, tenantId);
        } else if (path === '/upload/part' && method === 'POST') {
            return await handleGetPartUrl(event, tenantId);
        } else if (path === '/upload/complete' && method === 'POST') {
            return await handleCompleteMultipart(event, tenantId);
        }
    } catch (err) {
        console.error("API Error:", err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    return { statusCode: 404, body: JSON.stringify({ message: "Not Found" }) };
};

async function handleGetCatalog(event, tenantId) {
    const familyId = event.headers['x-family-id'];
    const tableName = process.env.TABLE_NAME;
    const cdnDomain = process.env.CLOUDFRONT_DOMAIN;

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
        if (!item.SK.includes("#VIDEO#")) return null;
        const skParts = item.SK.split('#');
        const videoId = skParts[skParts.length - 1];
        const itemFamilyId = skParts[1];

        /**
         * Principal Strategy: URL Safety Encoding.
         * Filenames often contain spaces or special characters that crash
         * mobile URI parsers. We encode each segment while preserving slashes.
         */
        const encodeUrlPath = (path) => path.split('/').map(p => encodeURIComponent(p)).join('/');

        const videoUrl = item.hlsKey
            ? `https://${cdnDomain}/hls/${tenantId}/${itemFamilyId}/${encodeURIComponent(item.hlsKey)}/master.m3u8`
            : `https://${cdnDomain}/${encodeUrlPath(item.videoKey)}`;

        const thumbnailUrl = item.thumbnailKey
            ? `https://${cdnDomain}/thumbnails/${encodeURIComponent(item.thumbnailKey)}`
            : "https://via.placeholder.com/150";

        return { ...item, videoId, videoUrl, thumbnailUrl };
    };

    return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
        body: JSON.stringify(items.map(mapToCdn).filter(i => i !== null)),
    };
}

async function handleIngest(event, tenantId) {
    const body = JSON.parse(event.body || "{}");
    const { videoId, title, genre, releaseYear, familyId, videoFileName, status = "INGESTED" } = body;

    await docClient.send(new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${familyId}#VIDEO#${videoId}`,
            title,
            genre,
            releaseYear,
            videoKey: `${tenantId}/${familyId}/${videoFileName}`,
            thumbnailKey: "",
            transcodeStatus: status,
            lastUpdated: Date.now(),
            retryCount: 0
        }
    }));

    return {
        statusCode: 201,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "Metadata record created" })
    };
}

async function handleStartMultipart(event, tenantId) {
    const { key, contentType } = JSON.parse(event.body);
    const command = new CreateMultipartUploadCommand({
        Bucket: process.env.MEDIA_BUCKET,
        Key: key,
        ContentType: contentType
    });

    const response = await s3Client.send(command);
    return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ uploadId: response.UploadId })
    };
}

async function handleGetPartUrl(event, tenantId) {
    const { key, uploadId, partNumber, totalParts } = JSON.parse(event.body);

    // Principal Strategy: Granular Ingestion Logging
    // This allows us to track the "Ingestion Pulse" of large files in CloudWatch.
    console.log(`INGESTION PULSE: Tenant=${tenantId} | Part ${partNumber}/${totalParts || '?'} | Key=${key}`);

    try {
        const command = new UploadPartCommand({
            Bucket: process.env.MEDIA_BUCKET,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ uploadUrl: url })
    };
}

async function handleCompleteMultipart(event, tenantId) {
    const { key, uploadId, parts } = JSON.parse(event.body);
    const command = new CompleteMultipartUploadCommand({
        Bucket: process.env.MEDIA_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts }
    });

    await s3Client.send(command);
    return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "Upload complete" })
    };
}

exports.logPlayHandler = async (event) => {
    // (Existing telemetry logic)
    return { statusCode: 200, body: JSON.stringify({ status: "logged" }) };
};
