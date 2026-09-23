const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});
const lambdaClient = new LambdaClient({});

const response = (statusCode, body) => ({
    statusCode,
    headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "*"
    },
    body: JSON.stringify(body)
});

exports.handler = async (event) => {
    try {
        const path = event.resource;
        const method = event.httpMethod;
        const requestContext = event.requestContext || {};
        const authorizer = requestContext.authorizer || {};
        const claims = authorizer.claims || {};

        // Principal Strategy: Identity-Driven Tenancy.
        // We derive the Tenant ID (familyId) directly from the cryptographically signed JWT.
        const tenantId = claims['custom:familyId'] || 'GLOBAL';

        console.log(`Scribe Request: ${method} ${path} for Tenant: ${tenantId}`);

        if (path === '/catalog' && method === 'GET') {
            return await handleGetCatalog(event, tenantId);
        } else if (path === '/tenants' && method === 'GET') {
            return await handleGetTenants(event, tenantId);
        } else if (path === '/tenants' && method === 'POST') {
            return await handleCreateTenant(event, tenantId);
        } else if (path === '/ingest' && method === 'POST') {
            return await handleIngest(event, tenantId);
        } else if (path === '/upload/start' && method === 'POST') {
            return await handleStartMultipart(event, tenantId);
        } else if (path === '/upload/part' && method === 'POST') {
            return await handleGetPartUrl(event, tenantId);
        } else if (path === '/upload/complete' && method === 'POST') {
            return await handleCompleteMultipart(event, tenantId);
        } else if (path === '/catalog/publish' && method === 'POST') {
            return await handlePublishVideo(event, tenantId);
        } else if (path === '/catalog/{videoId}/{familyId}' && method === 'DELETE') {
            return await handleDeleteVideo(event, tenantId);
        }

        return response(404, { message: "Not Found" });
    } catch (err) {
        console.error("Global Handler Error:", err);
        return response(500, { error: err.message });
    }
};

async function handleGetCatalog(event, tenantId) {
    const headers = event.headers || {};
    const queryParams = event.queryStringParameters || {};
    const familyId = headers['x-family-id'] || headers['X-Family-Id'];
    const isAdminView = queryParams.adminView === 'true';

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

    const result = await docClient.send(command);
    let items = result.Items || [];

    // Principal Strategy: Governance Gating.
    // We always filter out items in the 'DELETED' state to support the two-phase purge.
    items = items.filter(item => item.transcodeStatus !== 'DELETED');

    // Principal Strategy: Catalog Visibility Gating.
    // Consumer apps (Android/Scroll) only see items that are past the approval gate.
    if (!isAdminView) {
        items = items.filter(item =>
            item.transcodeStatus === 'COMPLETED' ||
            item.transcodeStatus === 'TRANSCODING'
        );
    }

    const mapToCdn = (item) => {
        if (!item.SK || !item.SK.includes("#VIDEO#")) return null;
        const skParts = item.SK.split('#');
        const videoId = skParts[skParts.length - 1];
        const itemFamilyId = skParts[1];

        const encodeUrlPath = (path) => path.split('/').map(p => encodeURIComponent(p)).join('/');

        // Lead Strategy: Uniform Path Access.
        // HLS streams use the /hls/ prefix.
        // Raw MP4s now use the /media/ prefix for CDN routing consistency.
        const videoUrl = item.hlsKey
            ? `https://${cdnDomain}/hls/${tenantId}/${itemFamilyId}/${encodeURIComponent(item.hlsKey)}/master.m3u8`
            : `https://${cdnDomain}/media/${encodeUrlPath(item.videoKey)}`;

        const thumbnailUrl = item.thumbnailKey
            ? `https://${cdnDomain}/thumbnails/${encodeUrlPath(item.thumbnailKey)}`
            : "https://via.placeholder.com/150";

        return {
            videoId,
            title: item.title || "Untitled",
            genre: item.genre || "Unknown",
            releaseYear: item.releaseYear || "0",
            thumbnailUrl,
            videoUrl,
            transcodeStatus: item.transcodeStatus || 'INGESTED',
            description: item.description || item.aiDescription || '',
            tags: item.tags || item.aiTags || [],
            aiTitle: item.aiTitle || '',
            aiDescription: item.aiDescription || '',
            aiTags: item.aiTags || [],
            videoKey: item.videoKey || '',
            familyId: itemFamilyId
        };
    };

    return response(200, items.map(mapToCdn).filter(i => i !== null));
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

    return response(201, { message: "Metadata record created" });
}

async function handleStartMultipart(event, tenantId) {
    const { key, contentType } = JSON.parse(event.body);
    const res = await s3Client.send(new CreateMultipartUploadCommand({
        Bucket: process.env.MEDIA_BUCKET,
        Key: key,
        ContentType: contentType
    }));
    return response(200, { uploadId: res.UploadId });
}

async function handleGetPartUrl(event, tenantId) {
    const { key, uploadId, partNumber, totalParts } = JSON.parse(event.body);
    console.log(`INGESTION: Part ${partNumber}/${totalParts || '?'} | Key=${key}`);

    const url = await getSignedUrl(s3Client, new UploadPartCommand({
        Bucket: process.env.MEDIA_BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber
    }), { expiresIn: 3600 });

    return response(200, { uploadUrl: url });
}

async function handleCompleteMultipart(event, tenantId) {
    const { key, uploadId, parts } = JSON.parse(event.body);

    /**
     * Principal Strategy: ETag Normalization.
     * S3 requires ETags to be wrapped in double quotes for completion.
     * We ensure each part's ETag is correctly quoted before sending to S3.
     */
    const normalizedParts = parts.map(part => ({
        ETag: part.ETag.startsWith('"') ? part.ETag : `"${part.ETag}"`,
        PartNumber: parseInt(part.PartNumber)
    }));

    console.log(`Completing Multipart: Key=${key}, Parts=${normalizedParts.length}`);

    await s3Client.send(new CompleteMultipartUploadCommand({
        Bucket: process.env.MEDIA_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: normalizedParts }
    }));

    return response(200, { message: "Upload complete" });
}

async function handlePublishVideo(event, tenantId) {
    const body = JSON.parse(event.body || "{}");
    const { videoId, familyId, title, genre, releaseYear, description, tags, videoKey } = body;
    const tableName = process.env.TABLE_NAME;

    if (!videoId || !familyId || !videoKey || !title) {
        return response(400, { error: "videoId, familyId, videoKey, and title are required" });
    }

    console.log(`PUBLISH: Finalizing ${videoId} for Tenant ${tenantId}`);

    // Lead Strategy: Transactional Locking not needed here; we just set the target state.
    await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${familyId}#VIDEO#${videoId}`
        },
        UpdateExpression: "SET title = :t, genre = :g, releaseYear = :ry, description = :d, tags = :tg, transcodeStatus = :s, lastUpdated = :lu",
        ExpressionAttributeValues: {
            ":t": title,
            ":g": genre,
            ":ry": releaseYear,
            ":d": description || "",
            ":tg": tags || [],
            ":s": "TRANSCODING",
            ":lu": Date.now()
        }
    }));

    // Invoke Orchestrator Lambda to trigger the full multi-bitrate HLS transcode in Fargate
    await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.ORCHESTRATOR_LAMBDA_ARN,
        InvocationType: "Event", // Asynchronous execution
        Payload: Buffer.from(JSON.stringify({
            action: "START_TRANSCODE",
            tenantId,
            familyId,
            videoId,
            videoKey
        }))
    }));

    return response(200, { success: true, message: "Asset approved. Full HLS transcoding kicked off." });
}

async function handleDeleteVideo(event, tenantId) {
    const { videoId, familyId } = event.pathParameters;
    const tableName = process.env.TABLE_NAME;

    console.log(`DELETE: Soft-deleting ${videoId} for Tenant ${tenantId}`);

    await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${familyId}#VIDEO#${videoId}`
        },
        UpdateExpression: "SET transcodeStatus = :s, deletedAt = :t, lastUpdated = :lu",
        ExpressionAttributeValues: {
            ":s": "DELETED",
            ":t": Date.now(),
            ":lu": Date.now()
        }
    }));

    return response(200, { success: true, message: "Asset moved to trash. Will be permanently purged after retention period." });
}

async function handleGetTenants(event, tenantId) {
    const tableName = process.env.TABLE_NAME;

    try {
        const command = new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": "TENANTS_REGISTRY",
                ":sk": "TENANT#"
            }
        });

        const result = await docClient.send(command);
        const items = (result.Items || []).map(item => ({
            familyId: item.familyId,
            familyName: item.familyName,
            contactEmail: item.contactEmail || '',
            createdAt: item.createdAt || new Date().toISOString()
        }));

        if (items.length === 0) {
            return response(200, [
                { familyId: 'PUBLIC', familyName: 'Public Access Pool', contactEmail: 'public@alexandria-plus.com', createdAt: new Date().toISOString() },
                { familyId: 'FAM_LALAMA', familyName: 'Lalama Family Vault', contactEmail: 'family@lalama.com', createdAt: new Date().toISOString() },
                { familyId: 'FAM_SMITH', familyName: 'Smith Family Vault', contactEmail: 'smith@familyvault.com', createdAt: new Date().toISOString() }
            ]);
        }

        return response(200, items);
    } catch (err) {
        console.error("handleGetTenants Error:", err);
        return response(500, { error: err.message });
    }
}

async function handleCreateTenant(event, tenantId) {
    const tableName = process.env.TABLE_NAME;
    const body = JSON.parse(event.body || "{}");
    const { familyName, contactEmail } = body;

    if (!familyName) {
        return response(400, { error: "familyName is required" });
    }

    const slug = familyName.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    const uniqueHash = Math.random().toString(36).substring(2, 6).toUpperCase();
    const familyId = `FAM_${slug}_${uniqueHash}`;
    const createdAt = new Date().toISOString();

    try {
        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: {
                PK: "TENANTS_REGISTRY",
                SK: `TENANT#${familyId}`,
                familyId,
                familyName,
                contactEmail: contactEmail || '',
                createdAt
            }
        }));

        return response(201, { familyId, familyName, contactEmail, createdAt });
    } catch (err) {
        console.error("handleCreateTenant Error:", err);
        return response(500, { error: err.message });
    }
}

exports.logPlayHandler = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        console.log("Logged play event for:", body.videoId);
        return response(200, { status: "logged" });
    } catch (err) {
        return response(500, { error: err.message });
    }
};
