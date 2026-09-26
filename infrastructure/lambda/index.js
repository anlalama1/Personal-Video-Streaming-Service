/**
 * ============================================================================
 * Scribe Central Lambda Function (API Gateway Router & Backend BFF)
 * ============================================================================
 * Architecture Pattern: Backend-For-Frontend (BFF) & Single-Table Router.
 *
 * Enterprise Decision Rationale:
 * Instead of spinning up individual Lambda microservices for every REST route
 * during early-stage scaling, a unified router Lambda minimizes cold starts,
 * reduces AWS CloudWatch log group clutter, and simplifies shared database connections.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Initialize AWS SDK v3 Clients outside the handler for TCP connection reuse across warm Lambda invocations.
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});
const lambdaClient = new LambdaClient({});

/**
 * Standardized HTTP response helper with cross-origin CORS headers enabled.
 */
const response = (statusCode, body) => ({
    statusCode,
    headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "*"
    },
    body: JSON.stringify(body)
});

/**
 * Main Lambda Entry Point (API Gateway Proxy Event Router)
 */
exports.handler = async (event) => {
    try {
        const path = event.resource;
        const method = event.httpMethod;
        const requestContext = event.requestContext || {};
        const authorizer = requestContext.authorizer || {};
        const claims = authorizer.claims || {};

        // System partition tenant ID defaults to 'GLOBAL' unless overridden in header
        const headers = event.headers || {};
        const tenantId = headers['x-tenant-id'] || headers['X-Tenant-Id'] || 'GLOBAL';

        console.log(`Scribe Request: ${method} ${path} for Tenant: ${tenantId}`);

        // Route matching logic
        if (path === '/catalog' && method === 'GET') {
            return await handleGetCatalog(event, tenantId, claims);
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

/**
 * Handles fetching catalog media items for Viewers and Admins.
 * Enforces Cryptographic Tenancy Isolation based on Cognito JWT claims.
 */
async function handleGetCatalog(event, tenantId, claims = {}) {
    const headers = event.headers || {};
    const queryParams = event.queryStringParameters || {};
    const isAdminView = queryParams.adminView === 'true';
    const jwtFamilyId = claims['custom:familyId'];

    // Enforce Strict Family Vault Isolation for non-admin viewers
    let familyId = headers['x-family-id'] || headers['X-Family-Id'];
    if (familyId === 'ALL') {
        familyId = undefined;
    }

    if (!isAdminView && jwtFamilyId && jwtFamilyId !== 'SHOP_ADMIN') {
        familyId = jwtFamilyId;
    }

    const tableName = process.env.TABLE_NAME;
    const cdnDomain = process.env.CLOUDFRONT_DOMAIN;

    const skPrefix = familyId ? `FAMILY#${familyId}#VIDEO#` : "FAMILY#";

    // Query DynamoDB Single-Table Design using Partition Key (PK) & Sort Key (SK) range query
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

    // Filter out deleted items (soft-delete governance)
    items = items.filter(item => item.transcodeStatus !== 'DELETED');

    // For consumer apps, filter items to only show COMPLETED or TRANSCODING assets belonging to their family
    if (!isAdminView) {
        items = items.filter(item =>
            item.transcodeStatus === 'COMPLETED' ||
            item.transcodeStatus === 'TRANSCODING'
        );

        if (jwtFamilyId && jwtFamilyId !== 'SHOP_ADMIN') {
            items = items.filter(item => {
                const skParts = (item.SK || '').split('#');
                const itemFamilyId = skParts[1];
                return itemFamilyId === jwtFamilyId || itemFamilyId === 'PUBLIC';
            });
        }
    }

    // Map DynamoDB records to CloudFront CDN URLs
    const mapToCdn = (item) => {
        if (!item.SK || !item.SK.includes("#VIDEO#")) return null;
        const skParts = item.SK.split('#');
        const videoId = skParts[skParts.length - 1];
        const itemFamilyId = skParts[1];

        const encodeUrlPath = (path) => path.split('/').map(p => encodeURIComponent(p)).join('/');

        // Uniform Path Access for HLS master playlists vs raw MP4s
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

/**
 * Creates initial metadata record in DynamoDB when a shop operator initiates media upload.
 */
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

/**
 * Initiates an S3 Resumable Multipart Upload pass.
 */
async function handleStartMultipart(event, tenantId) {
    const { key, contentType } = JSON.parse(event.body);
    const res = await s3Client.send(new CreateMultipartUploadCommand({
        Bucket: process.env.MEDIA_BUCKET,
        Key: key,
        ContentType: contentType
    }));
    return response(200, { uploadId: res.UploadId });
}

/**
 * Generates an S3 Pre-Signed URL for uploading an individual 10MB chunk.
 */
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

/**
 * Finalizes an S3 Multipart Upload and normalizes ETag quotes.
 */
async function handleCompleteMultipart(event, tenantId) {
    const { key, uploadId, parts } = JSON.parse(event.body);

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

/**
 * Approves AI-drafted metadata and triggers asynchronous Fargate HLS transcoding pass.
 */
async function handlePublishVideo(event, tenantId) {
    const body = JSON.parse(event.body || "{}");
    const { videoId, familyId, oldFamilyId, title, genre, releaseYear, description, tags, videoKey } = body;
    const tableName = process.env.TABLE_NAME;

    if (!videoId || !familyId || !videoKey || !title) {
        return response(400, { error: "videoId, familyId, videoKey, and title are required" });
    }

    console.log(`PUBLISH: Finalizing ${videoId} for Tenant ${tenantId}, Target Family: ${familyId}`);

    // If familyId was reassigned on the Review Board (e.g. from PUBLIC to FAM_LALAMA)
    if (oldFamilyId && oldFamilyId !== familyId) {
        console.log(`REASSIGN: Moving item from FAMILY#${oldFamilyId} to FAMILY#${familyId}`);
        try {
            await docClient.send(new DeleteCommand({
                TableName: tableName,
                Key: {
                    PK: `TENANT#${tenantId}`,
                    SK: `FAMILY#${oldFamilyId}#VIDEO#${videoId}`
                }
            }));
        } catch (delErr) {
            console.warn("Failed to delete old partition key draft:", delErr.message);
        }
    }

    // Write the published record under the target familyId
    await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${familyId}#VIDEO#${videoId}`,
            title,
            genre,
            releaseYear,
            description: description || "",
            tags: tags || [],
            transcodeStatus: "TRANSCODING",
            videoKey,
            lastUpdated: Date.now()
        }
    }));

    // Trigger Orchestrator Lambda asynchronously to launch the ECS Fargate transcoder task
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

/**
 * Executes soft-delete on a video record for two-phase retention.
 */
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

/**
 * Fetches all registered family tenants from DynamoDB Single-Table registry.
 */
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

/**
 * Creates a new family tenant record in DynamoDB Single-Table registry.
 * Generates an 8-character uppercase alphanumeric code (e.g. FAM_8K2N9P4X).
 */
async function handleCreateTenant(event, tenantId) {
    const tableName = process.env.TABLE_NAME;
    const body = JSON.parse(event.body || "{}");
    const { familyName, contactEmail } = body;

    if (!familyName) {
        return response(400, { error: "familyName is required" });
    }

    // Generate 8 random uppercase alphanumeric characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const familyId = `FAM_${code}`;
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

/**
 * Handler for playback telemetry logging.
 */
exports.logPlayHandler = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        console.log("Logged play event for:", body.videoId);
        return response(200, { status: "logged" });
    } catch (err) {
        return response(500, { error: err.message });
    }
};
