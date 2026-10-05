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
const { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } = require("@aws-sdk/client-s3");
const {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
    AdminUpdateUserAttributesCommand,
    AdminDisableUserCommand,
    AdminUserGlobalSignOutCommand,
    ListUsersCommand
} = require("@aws-sdk/client-cognito-identity-provider");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Initialize AWS SDK v3 Clients outside the handler for TCP connection reuse across warm Lambda invocations.
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});
const lambdaClient = new LambdaClient({});
const cognitoClient = new CognitoIdentityProviderClient({});

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

    // System partition tenant ID resolved from dynamic Cognito claims or header
        const headers = event.headers || {};
        const tenantId = headers['x-tenant-id'] || headers['X-Tenant-Id'] || claims['custom:tenantId'] || 'PRIMARY_VAULT';

        console.log(`Scribe Request: ${method} ${path} for Tenant: ${tenantId}`);

        // Route matching logic
        if (path === '/catalog' && method === 'GET') {
            return await handleGetCatalog(event, tenantId, claims);
        } else if (path === '/genres' && method === 'GET') {
            return await handleGetGenres(event, tenantId);
        } else if (path === '/genres' && method === 'POST') {
            return await handleCreateGenre(event, tenantId);
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
        } else if (path === '/upload/fail' && method === 'POST') {
            return await handleFailMultipart(event, tenantId);
        } else if (path === '/catalog/publish' && method === 'POST') {
            return await handlePublishVideo(event, tenantId);
        } else if (path === '/catalog/{videoId}/{familyId}' && method === 'DELETE') {
            return await handleDeleteVideo(event, tenantId);
        } else if (path === '/catalog/{videoId}/{familyId}/reject' && method === 'DELETE') {
            return await handleRejectReviewItem(event, tenantId, claims);
        } else if (path === '/vault/members' && method === 'GET') {
            return await handleListVaultMembers(claims);
        } else if (path === '/vault/members' && method === 'POST') {
            return await handleRegisterVaultMember(claims);
        } else if (path === '/vault/members/approve' && method === 'POST') {
            return await handleManageVaultMember(event, claims, 'approve');
        } else if (path === '/vault/members/promote' && method === 'POST') {
            return await handleManageVaultMember(event, claims, 'promote');
        } else if (path === '/vault/members/demote' && method === 'POST') {
            return await handleManageVaultMember(event, claims, 'demote');
        } else if (path === '/vault/members/ban' && method === 'POST') {
            return await handleManageVaultMember(event, claims, 'ban');
        } else if (path === '/vault/members/reject' && method === 'POST') {
            return await handleManageVaultMember(event, claims, 'reject');
        } else if (path === '/vault/videos/{videoId}' && method === 'PUT') {
            return await handleUpdateVaultVideo(event, tenantId, claims);
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
    const isReviewQueue = queryParams.reviewQueue === 'true';
    const jwtFamilyId = claims['custom:familyId'];
    const isShopAdmin = claims['custom:role'] === 'ShopAdmin';
    const isVaultAdmin = claims['custom:isAdmin'] === 'true';
    const trustedFamilyId = isShopAdmin ? null : await getTrustedFamilyId(claims);

    if (isAdminView && !isShopAdmin && !isVaultAdmin) {
        return response(403, { error: "Administrator privileges are required for the full vault management view." });
    }

    if (!isShopAdmin && (
        (!isVaultAdmin && claims['custom:isApproved'] !== 'true') ||
        !trustedFamilyId ||
        trustedFamilyId !== claims['custom:familyId']
    )) {
        return response(403, { error: "Family vault membership is awaiting administrator approval." });
    }

    if (isReviewQueue && !isShopAdmin && !jwtFamilyId) {
        return response(403, { error: "A family vault claim is required to view the review queue" });
    }

    // Enforce Strict Family Vault Isolation for non-admin viewers
    let familyId = headers['x-family-id'] || headers['X-Family-Id'];
    if (familyId === 'ALL') {
        familyId = undefined;
    }

    if (!isAdminView && jwtFamilyId) {
        familyId = jwtFamilyId;
    }

    const tableName = process.env.TABLE_NAME;
    const cdnDomain = process.env.CLOUDFRONT_DOMAIN;

    const skPrefix = familyId ? `FAMILY#${familyId}#VIDEO#` : "FAMILY#";

    // Query DynamoDB Single-Table Design using Partition Key (PK) & Sort Key (SK) range query
    let items;
    if (((!isAdminView || isReviewQueue) && jwtFamilyId) || (isAdminView && isVaultAdmin && !isShopAdmin)) {
        const queryFamily = async (requestedFamilyId) => {
            const result = await docClient.send(new QueryCommand({
                TableName: tableName,
                IndexName: 'FamilyCatalogIndex',
                KeyConditionExpression: "familyId = :familyId AND begins_with(SK, :sk)",
                ExpressionAttributeValues: {
                    ":familyId": requestedFamilyId,
                    ":sk": `FAMILY#${requestedFamilyId}#VIDEO#`
                }
            }));
            return result.Items || [];
        };

        items = await queryFamily(jwtFamilyId);
        if (!isReviewQueue && !isAdminView && jwtFamilyId !== 'PUBLIC') {
            items = [...items, ...await queryFamily('PUBLIC')];
        }
    } else {
        const result = await docClient.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": `TENANT#${tenantId}`,
                ":sk": skPrefix
            }
        }));
        items = result.Items || [];
    }

    // Filter out deleted items (soft-delete governance)
    items = items.filter(item => item.transcodeStatus !== 'DELETED');

    if (isReviewQueue) {
        items = items.filter(item =>
            ['REVIEW_PENDING', 'UPLOADING', 'PROCESSING'].includes(item.transcodeStatus)
        );
    }

    // For consumer apps, filter items to only show COMPLETED or TRANSCODING assets belonging to their family
    if (!isAdminView && !isReviewQueue) {
        items = items.filter(item =>
            item.transcodeStatus === 'COMPLETED' ||
            item.transcodeStatus === 'TRANSCODING'
        );

        if (jwtFamilyId) {
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
        const itemTenantId = item.PK?.startsWith('TENANT#')
            ? item.PK.slice('TENANT#'.length)
            : tenantId;
        const thumbnailKey = item.thumbnailKey || (item.videoKey
            ? `${itemTenantId}/${itemFamilyId}/${videoId}/thumbnail.jpg`
            : '');

        const encodeUrlPath = (path) => path.split('/').map(p => encodeURIComponent(p)).join('/');

        // Uniform Path Access for HLS master playlists vs raw MP4s
        const videoUrl = item.hlsKey
            ? `https://${cdnDomain}/hls/${itemTenantId}/${itemFamilyId}/${encodeURIComponent(item.hlsKey)}/master.m3u8`
            : `https://${cdnDomain}/media/${encodeUrlPath(item.videoKey)}`;

        const thumbnailUrl = thumbnailKey
            ? `https://${cdnDomain}/thumbnails/${encodeUrlPath(thumbnailKey)}`
            : "https://via.placeholder.com/150";

        return {
            videoId,
            title: item.title || "Untitled",
            genre: item.genre || "Unknown",
            releaseYear: item.releaseYear || "0",
            thumbnailUrl,
            videoUrl,
            transcodeStatus: item.transcodeStatus || 'INGESTED',
            useAi: item.useAi === true,
            description: item.description || '',
            tags: item.tags || [],
            aiTitle: item.aiTitle || '',
            aiTags: item.aiTags || [],
            aiDescription: item.aiDescription || '',
            aiTags: item.aiTags || [],
            videoKey: item.videoKey || '',
            thumbnailKey,
            familyId: itemFamilyId
        };
    };

    return response(200, items.map(mapToCdn).filter(i => i !== null));
}

/**
 * Creates initial metadata record in DynamoDB when a shop operator initiates media upload.
 */
async function handleIngest(event, tenantId) {
    const accessDenied = await requireApprovedFamilyAccess(event);
    if (accessDenied) return accessDenied;
    const body = JSON.parse(event.body || "{}");
    const { videoId, title, genre, releaseYear, familyId, videoFileName, useAi = false, status } = body;

    const authorizer = (event.requestContext || {}).authorizer || {};
    const claims = authorizer.claims || {};
    const jwtFamilyId = claims['custom:familyId'];
    const isShopAdmin = claims['custom:role'] === 'ShopAdmin';

    // Enforce cryptographic tenancy containment for customer accounts
    const targetFamilyId = (!isShopAdmin && jwtFamilyId) ? await getTrustedFamilyId(claims) : (familyId || 'PUBLIC');
    if (!targetFamilyId) return response(403, { error: "Family vault membership could not be verified." });

    // Default status: If useAi is false (default Manual Mode), set status directly to REVIEW_PENDING.
    // If useAi is true, set status to UPLOADING so Fargate Bedrock task runs upon S3 upload completion.
    const initialStatus = status || (useAi ? "UPLOADING" : "REVIEW_PENDING");

    await docClient.send(new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${targetFamilyId}#VIDEO#${videoId}`,
            familyId: targetFamilyId,
            title: title || videoFileName.split('.')[0],
            genre: genre || "Miscellaneous",
            releaseYear: releaseYear || new Date().getFullYear().toString(),
            videoKey: `${targetFamilyId}/${videoFileName}`,
            thumbnailKey: "",
            transcodeStatus: initialStatus,
            useAi: useAi === true,
            lastUpdated: Date.now(),
            retryCount: 0
        }
    }));

    return response(201, {
        message: "Metadata record created",
        videoKey: `${targetFamilyId}/${videoFileName}`
    });
}

/**
 * Initiates an S3 Resumable Multipart Upload pass.
 */
async function handleStartMultipart(event, tenantId) {
    const accessDenied = await requireApprovedFamilyAccess(event);
    if (accessDenied) return accessDenied;
    const { key, contentType } = JSON.parse(event.body);
    const keyDenied = requireUploadKeyAccess(event, key);
    if (keyDenied) return keyDenied;
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
    const accessDenied = await requireApprovedFamilyAccess(event);
    if (accessDenied) return accessDenied;
    const { key, uploadId, partNumber, totalParts } = JSON.parse(event.body);
    const keyDenied = requireUploadKeyAccess(event, key);
    if (keyDenied) return keyDenied;
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
    const accessDenied = await requireApprovedFamilyAccess(event);
    if (accessDenied) return accessDenied;
    const { key, uploadId, parts } = JSON.parse(event.body);
    const keyDenied = requireUploadKeyAccess(event, key);
    if (keyDenied) return keyDenied;

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
 * Marks an unsuccessful upload as failed and aborts any unfinished S3 multipart upload.
 */
async function handleFailMultipart(event, tenantId) {
    const accessDenied = await requireApprovedFamilyAccess(event);
    if (accessDenied) return accessDenied;
    const { videoId, familyId, key, uploadId } = JSON.parse(event.body || "{}");
    const claims = ((event.requestContext || {}).authorizer || {}).claims || {};
    const jwtFamilyId = claims['custom:familyId'];
    const isShopAdmin = claims['custom:role'] === 'ShopAdmin';

    if (!videoId || !familyId) {
        return response(400, { error: "videoId and familyId are required" });
    }
    if (!isShopAdmin && !jwtFamilyId) {
        return response(403, { error: "A family vault claim is required" });
    }

    const targetFamilyId = isShopAdmin ? familyId : await getTrustedFamilyId(claims);
    if (!targetFamilyId) return response(403, { error: "Family vault membership could not be verified." });
    if (key && !key.startsWith(`${targetFamilyId}/`)) {
        return response(400, { error: "Upload key does not belong to the target family vault" });
    }

    try {
        await docClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                PK: `TENANT#${tenantId}`,
                SK: `FAMILY#${targetFamilyId}#VIDEO#${videoId}`
            },
            ConditionExpression: "transcodeStatus = :uploading",
            UpdateExpression: "SET transcodeStatus = :failed, lastUpdated = :now",
            ExpressionAttributeValues: {
                ":uploading": "UPLOADING",
                ":failed": "UPLOAD_FAILED",
                ":now": Date.now()
            }
        }));
    } catch (err) {
        if (err.name !== "ConditionalCheckFailedException") throw err;
    }

    if (key && uploadId) {
        try {
            await s3Client.send(new AbortMultipartUploadCommand({
                Bucket: process.env.MEDIA_BUCKET,
                Key: key,
                UploadId: uploadId
            }));
        } catch (err) {
            console.warn("Could not abort the failed multipart upload:", err.message);
        }
    }

    return response(200, { message: "Upload failure recorded" });
}

/**
 * Approves AI-drafted metadata and triggers asynchronous Fargate HLS transcoding pass.
 */
async function handlePublishVideo(event, tenantId) {
    const body = JSON.parse(event.body || "{}");
    const { videoId, familyId, oldFamilyId, title, genre, releaseYear, description, tags, videoKey } = body;
    const claims = event.requestContext?.authorizer?.claims || {};
    const isShopAdmin = claims['custom:role'] === 'ShopAdmin';
    const jwtFamilyId = claims['custom:familyId'];
    const trustedFamilyId = isShopAdmin ? null : await getTrustedFamilyId(claims);
    if (!isShopAdmin && (
        claims['custom:isApproved'] !== 'true' ||
        !trustedFamilyId ||
        trustedFamilyId !== jwtFamilyId ||
        familyId !== jwtFamilyId ||
        (oldFamilyId && oldFamilyId !== jwtFamilyId)
    )) {
        return response(403, { error: "Approved family membership is required to publish within your own vault." });
    }
    const tableName = process.env.TABLE_NAME;

    if (!videoId || !familyId || !videoKey || !title) {
        return response(400, { error: "videoId, familyId, videoKey, and title are required" });
    }

    const genres = await queryGenres(tableName);
    if (!genres.some(registeredGenre => registeredGenre.genreName === genre)) {
        return response(400, { error: "genre must match an entry in the DynamoDB genre registry" });
    }

    console.log(`PUBLISH: Finalizing ${videoId} for Tenant ${tenantId}, Target Family: ${familyId}`);

    const sourceFamilyId = oldFamilyId || familyId;
    const existingDraft = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${sourceFamilyId}#VIDEO#${videoId}`
        },
        ProjectionExpression: "thumbnailKey"
    }));

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
            familyId,
            ...(existingDraft.Item?.thumbnailKey ? { thumbnailKey: existingDraft.Item.thumbnailKey } : {}),
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
    const claims = event.requestContext?.authorizer?.claims || {};
    const isShopAdmin = claims['custom:role'] === 'ShopAdmin';
    if (!isShopAdmin && (
        claims['custom:isAdmin'] !== 'true' ||
        claims['custom:familyId'] !== familyId ||
        await getTrustedFamilyId(claims) !== familyId
    )) {
        return response(403, { error: "Only a family vault administrator can delete videos in that vault." });
    }

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

async function handleRejectReviewItem(event, tenantId, claims) {
    const { videoId, familyId } = event.pathParameters;
    const jwtFamilyId = claims['custom:familyId'];
    const isShopAdmin = claims['custom:role'] === 'ShopAdmin';

    if (!isShopAdmin && (
        claims['custom:isApproved'] !== 'true' ||
        jwtFamilyId !== familyId ||
        await getTrustedFamilyId(claims) !== familyId
    )) {
        return response(403, { error: "You can only reject videos in your family vault." });
    }

    try {
        await docClient.send(new DeleteCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                PK: `TENANT#${tenantId}`,
                SK: `FAMILY#${familyId}#VIDEO#${videoId}`
            },
            ConditionExpression: "transcodeStatus = :reviewPending",
            ExpressionAttributeValues: {
                ":reviewPending": "REVIEW_PENDING"
            }
        }));
    } catch (err) {
        if (err.name === "ConditionalCheckFailedException") {
            return response(409, { error: "Only videos pending review can be rejected." });
        }
        throw err;
    }

    return response(200, { success: true, message: "Review item rejected and removed." });
}

async function getTrustedFamilyId(claims) {
    const familyId = claims['custom:familyId'];
    if (!claims.sub || !/^[A-Za-z0-9_-]{1,64}$/.test(familyId || '')) {
        return null;
    }
    const member = await getMemberRecord(claims.sub);
    if (
        member?.familyId !== familyId ||
        member.accessDisabled === true ||
        (!member.isApproved && !member.isAdmin) ||
        (claims['custom:isAdmin'] === 'true' && member.isAdmin !== true) ||
        (claims['custom:isApproved'] === 'true' && member.isApproved !== true && member.isAdmin !== true)
    ) {
        return null;
    }
    return familyId;
}

async function ensureVaultMemberRecord(sub, familyId) {
    const key = { PK: `VAULT_MEMBER#${sub}`, SK: 'IDENTITY' };
    try {
        await docClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
                ...key,
                familyId,
                isAdmin: false,
                isApproved: false,
                accessDisabled: false,
                createdAt: Date.now()
            },
            ConditionExpression: 'attribute_not_exists(PK)'
        }));
        return true;
    } catch (error) {
        if (error.name !== 'ConditionalCheckFailedException') {
            throw error;
        }
        const result = await docClient.send(new GetCommand({
            TableName: process.env.TABLE_NAME,
            Key: key,
            ConsistentRead: true,
            ProjectionExpression: 'familyId'
        }));
        return result.Item?.familyId === familyId;
    }
}

async function getMemberRecord(sub) {
    const result = await docClient.send(new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { PK: `VAULT_MEMBER#${sub}`, SK: 'IDENTITY' },
        ConsistentRead: true
    }));
    return result.Item || null;
}

async function setVaultMemberState(sub, familyId, isAdmin, isApproved, accessDisabled = false) {
    await docClient.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { PK: `VAULT_MEMBER#${sub}`, SK: 'IDENTITY' },
        UpdateExpression: 'SET isAdmin = :isAdmin, isApproved = :isApproved, accessDisabled = :accessDisabled',
        ConditionExpression: 'familyId = :familyId',
        ExpressionAttributeValues: {
            ':isAdmin': isAdmin,
            ':isApproved': isApproved,
            ':accessDisabled': accessDisabled,
            ':familyId': familyId
        }
    }));
}

async function getMemberFamilyId(sub) {
    return (await getMemberRecord(sub))?.familyId || null;
}

async function requireVaultAdmin(claims) {
    if (
        claims['custom:isAdmin'] !== 'true' ||
        !claims['cognito:username']
    ) {
        return null;
    }
    return getTrustedFamilyId(claims);
}

async function requireApprovedFamilyAccess(event) {
    const claims = event.requestContext?.authorizer?.claims || {};
    if (claims['custom:role'] === 'ShopAdmin') {
        return null;
    }
    const trustedFamilyId = await getTrustedFamilyId(claims);
    if (
        trustedFamilyId &&
        trustedFamilyId === claims['custom:familyId'] &&
        (claims['custom:isAdmin'] === 'true' || claims['custom:isApproved'] === 'true')
    ) return null;
    return response(403, { error: "Family vault membership is awaiting administrator approval." });
}

function requireUploadKeyAccess(event, key) {
    const claims = event.requestContext?.authorizer?.claims || {};
    if (claims['custom:role'] === 'ShopAdmin') {
        return null;
    }
    const familyId = claims['custom:familyId'];
    if (!familyId || !key || !key.startsWith(`${familyId}/`)) {
        return response(403, { error: "Upload key must belong to your family vault." });
    }
    return null;
}

function getAttribute(user, name) {
    return user.UserAttributes?.find(attribute => attribute.Name === name)?.Value;
}

async function getVaultUser(username, familyId) {
    let user;
    try {
        user = await cognitoClient.send(new AdminGetUserCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            Username: username
        }));
    } catch (error) {
        if (error.name === 'UserNotFoundException') {
            return null;
        }
        throw error;
    }
    if (getAttribute(user, 'custom:familyId') !== familyId) {
        return null;
    }
    return user;
}

async function handleRegisterVaultMember(claims) {
    const familyId = claims['custom:familyId'];
    const username = claims['cognito:username'];
    const sub = claims.sub;
    if (!familyId || !/^[A-Za-z0-9_-]{1,64}$/.test(familyId) || !username || !sub) {
        return response(403, { error: "A verified family vault identity is required." });
    }

    const existingUser = await getVaultUser(username, familyId);
    if (!existingUser) {
        return response(403, { error: "This account is not registered in the claimed family vault." });
    }
    if (!await ensureVaultMemberRecord(sub, familyId)) {
        return response(403, { error: "This account is already bound to a different family vault." });
    }
    const memberRecord = await getMemberRecord(sub);
    if (memberRecord?.accessDisabled === true) {
        return response(403, { error: "This family vault membership has been disabled." });
    }

    const tableName = process.env.TABLE_NAME;
    const bootstrapKey = {
        PK: `VAULT#${familyId}`,
        SK: 'GOVERNANCE#BOOTSTRAP'
    };
    let isBootstrapAdmin = false;
    try {
        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: { ...bootstrapKey, bootstrapSub: sub, createdAt: Date.now() },
            ConditionExpression: 'attribute_not_exists(PK)'
        }));
        isBootstrapAdmin = true;
    } catch (error) {
        if (error.name !== 'ConditionalCheckFailedException') {
            throw error;
        }
        const bootstrap = await docClient.send(new GetCommand({
            TableName: tableName,
            Key: bootstrapKey,
            ConsistentRead: true
        }));
        isBootstrapAdmin = bootstrap.Item?.bootstrapSub === sub;
    }

    const updates = {};
    if (isBootstrapAdmin) {
        updates['custom:isAdmin'] = 'true';
        updates['custom:isApproved'] = 'true';
    } else {
        if (getAttribute(existingUser, 'custom:isAdmin') !== 'true') {
            updates['custom:isAdmin'] = 'false';
        }
        if (getAttribute(existingUser, 'custom:isApproved') !== 'true') {
            updates['custom:isApproved'] = 'false';
        }
    }

    try {
        if (Object.keys(updates).length) {
            await cognitoClient.send(new AdminUpdateUserAttributesCommand({
                UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
                Username: username,
                UserAttributes: Object.entries(updates).map(([Name, Value]) => ({ Name, Value }))
            }));
        }
        const isAdmin = isBootstrapAdmin || getAttribute(existingUser, 'custom:isAdmin') === 'true';
        const isApproved = isBootstrapAdmin || getAttribute(existingUser, 'custom:isApproved') === 'true';
        await setVaultMemberState(sub, familyId, isAdmin, isApproved, memberRecord?.accessDisabled === true);
    } catch (error) {
        if (isBootstrapAdmin) {
            try {
                await docClient.send(new DeleteCommand({
                    TableName: tableName,
                    Key: bootstrapKey,
                    ConditionExpression: 'bootstrapSub = :sub',
                    ExpressionAttributeValues: { ':sub': sub }
                }));
            } catch (cleanupError) {
                console.error('Failed to release vault bootstrap claim after Cognito update error', cleanupError);
            }
        }
        throw error;
    }

    return response(200, {
        success: true,
        isAdmin: isBootstrapAdmin || getAttribute(existingUser, 'custom:isAdmin') === 'true',
        isApproved: isBootstrapAdmin || getAttribute(existingUser, 'custom:isApproved') === 'true',
        message: isBootstrapAdmin
            ? "This account is the first administrator for the family vault."
            : "Family vault membership is awaiting administrator approval."
    });
}

async function handleListVaultMembers(claims) {
    const familyId = await requireVaultAdmin(claims);
    if (!familyId) {
        return response(403, { error: "Vault administrator privileges are required." });
    }

    const users = [];
    let paginationToken;
    do {
        const page = await cognitoClient.send(new ListUsersCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            Filter: `custom:familyId = "${familyId.replace(/["\\]/g, '\\$&')}"`,
            PaginationToken: paginationToken,
            Limit: 60
        }));
        for (const user of page.Users || []) {
            const attributes = Object.fromEntries((user.Attributes || []).map(attribute => [attribute.Name, attribute.Value]));
            const memberRecord = attributes.sub ? await getMemberRecord(attributes.sub) : null;
            if (attributes['custom:familyId'] === familyId && (!memberRecord || memberRecord.familyId === familyId)) {
                users.push({
                    username: user.Username,
                    email: attributes.email || '',
                    isCurrentUser: user.Username === claims['cognito:username'],
                    isAdmin: memberRecord?.isAdmin === true,
                    isApproved: memberRecord?.isApproved === true,
                    enabled: user.Enabled !== false,
                    status: user.UserStatus || 'UNKNOWN'
                });
            }
        }
        paginationToken = page.PaginationToken;
    } while (paginationToken);

    return response(200, users);
}

async function handleManageVaultMember(event, claims, action) {
    const familyId = await requireVaultAdmin(claims);
    if (!familyId) {
        return response(403, { error: "Vault administrator privileges are required." });
    }
    const { username } = JSON.parse(event.body || '{}');
    if (!username || username === claims['cognito:username']) {
        return response(400, { error: "A different family member username is required." });
    }

    const user = await getVaultUser(username, familyId);
    if (!user) {
        return response(404, { error: "The requested account is not a member of your family vault." });
    }

    const attributes = Object.fromEntries((user.UserAttributes || []).map(attribute => [attribute.Name, attribute.Value]));
    if (!attributes.sub || !await ensureVaultMemberRecord(attributes.sub, familyId)) {
        return response(403, { error: "The requested account is bound to a different family vault." });
    }
    const isTargetAdmin = attributes['custom:isAdmin'] === 'true';
    let adminLockHeld = false;
    if ((action === 'ban' || action === 'demote') && isTargetAdmin) {
        adminLockHeld = await acquireLastAdminGuard(familyId, claims.sub);
        if (!adminLockHeld) {
            return response(409, { error: "The last active vault administrator cannot be demoted or banned, or another administrator change is in progress." });
        }
    }

    try {
    if (action === 'ban' || action === 'reject') {
        if (action === 'reject' && attributes['custom:isApproved'] === 'true') {
            return response(409, { error: "Only pending membership requests can be rejected." });
        }
        await setVaultMemberState(attributes.sub, familyId, false, false, true);
        await cognitoClient.send(new AdminUpdateUserAttributesCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            Username: username,
            UserAttributes: [{ Name: 'custom:isApproved', Value: 'false' }]
        }));
        await cognitoClient.send(new AdminUserGlobalSignOutCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            Username: username
        }));
        await cognitoClient.send(new AdminDisableUserCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            Username: username
        }));
        return response(200, {
            success: true,
            message: action === 'reject'
                ? "Family membership request rejected."
                : "Family member access has been disabled."
        });
    }

    if (action === 'demote') {
        if (!isTargetAdmin) {
            return response(409, { error: "The selected member is not a vault administrator." });
        }
        await setVaultMemberState(attributes.sub, familyId, false, attributes['custom:isApproved'] === 'true');
        await cognitoClient.send(new AdminUpdateUserAttributesCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            Username: username,
            UserAttributes: [{ Name: 'custom:isAdmin', Value: 'false' }]
        }));
        return response(200, { success: true, message: "Member administrator privileges removed." });
    }

    const updates = action === 'promote'
        ? [{ Name: 'custom:isAdmin', Value: 'true' }, { Name: 'custom:isApproved', Value: 'true' }]
        : [{ Name: 'custom:isApproved', Value: 'true' }];
    await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
        Username: username,
        UserAttributes: updates
    }));
    await setVaultMemberState(
        attributes.sub,
        familyId,
        action === 'promote' || isTargetAdmin,
        true
    );
    return response(200, {
        success: true,
        message: action === 'promote'
            ? "Member promoted to vault administrator."
            : "Family member access approved."
    });
    } finally {
        if (adminLockHeld) {
            try {
                await releaseAdminMutationLock(familyId, claims.sub);
            } catch (error) {
                console.error("Failed to release family administrator mutation lock", error);
            }
        }
    }
}

async function acquireLastAdminGuard(familyId, lockOwner) {
    const lockKey = { PK: `VAULT#${familyId}`, SK: 'GOVERNANCE#ADMIN_MUTATION_LOCK' };
    const now = Date.now();
    try {
        await docClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: { ...lockKey, lockOwner, lockExpires: now + 120000 },
            ConditionExpression: 'attribute_not_exists(PK) OR lockExpires < :now',
            ExpressionAttributeValues: { ':now': now }
        }));
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            return false;
        }
        throw error;
    }

    try {
        if (await countActiveVaultAdmins(familyId) <= 1) {
            await releaseAdminMutationLock(familyId, lockOwner);
            return false;
        }
        return true;
    } catch (error) {
        await releaseAdminMutationLock(familyId, lockOwner);
        throw error;
    }
}

async function countActiveVaultAdmins(familyId) {
    let count = 0;
    let paginationToken;
    do {
        const page = await cognitoClient.send(new ListUsersCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            Filter: `custom:familyId = "${familyId}"`,
            PaginationToken: paginationToken,
            Limit: 60
        }));
        for (const user of page.Users || []) {
            const attributes = Object.fromEntries((user.Attributes || []).map(attribute => [attribute.Name, attribute.Value]));
            if (user.Enabled === false || attributes['custom:familyId'] !== familyId || !attributes.sub) continue;
            const member = await getMemberRecord(attributes.sub);
            if (member?.familyId === familyId && member.isAdmin === true && member.accessDisabled !== true) count++;
        }
        paginationToken = page.PaginationToken;
    } while (paginationToken);
    return count;
}

async function releaseAdminMutationLock(familyId, lockOwner) {
    await docClient.send(new DeleteCommand({
        TableName: process.env.TABLE_NAME,
        Key: { PK: `VAULT#${familyId}`, SK: 'GOVERNANCE#ADMIN_MUTATION_LOCK' },
        ConditionExpression: 'lockOwner = :owner',
        ExpressionAttributeValues: { ':owner': lockOwner }
    }));
}

async function handleUpdateVaultVideo(event, tenantId, claims) {
    const { videoId } = event.pathParameters;
    const familyId = await requireVaultAdmin(claims);
    if (!familyId) {
        return response(403, { error: "Vault administrator privileges are required." });
    }

    const body = JSON.parse(event.body || '{}');
    const { title, genre, releaseYear, description = '', tags = [] } = body;
    if (!title || !genre || !releaseYear || !Array.isArray(tags)) {
        return response(400, { error: "title, genre, releaseYear, and a tags array are required." });
    }

    try {
        await docClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                PK: `TENANT#${tenantId}`,
                SK: `FAMILY#${familyId}#VIDEO#${videoId}`
            },
            UpdateExpression: 'SET title = :title, genre = :genre, releaseYear = :year, description = :description, tags = :tags, lastUpdated = :updated',
            ConditionExpression: 'attribute_exists(PK) AND (attribute_not_exists(transcodeStatus) OR transcodeStatus <> :deleted)',
            ExpressionAttributeValues: {
                ':title': title,
                ':genre': genre,
                ':year': String(releaseYear),
                ':description': description,
                ':tags': tags,
                ':updated': Date.now(),
                ':deleted': 'DELETED'
            }
        }));
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            return response(404, { error: "The video was not found in your family vault." });
        }
        throw error;
    }
    return response(200, { success: true, message: "Video metadata updated." });
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
 * Generates a 6-character uppercase alphanumeric code.
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

    const familyId = code;
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
 * Fetches dynamic Heritage Genres from DynamoDB Single-Table registry.
 */
async function handleGetGenres(event, tenantId) {
    const tableName = process.env.TABLE_NAME;

    try {
        return response(200, await queryGenres(tableName));
    } catch (err) {
        console.error("handleGetGenres Error:", err);
        return response(500, { error: err.message });
    }
}

async function queryGenres(tableName) {
    const items = [];
    let lastEvaluatedKey;

    do {
        const result = await docClient.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": "GENRES_REGISTRY",
                ":sk": "GENRE#"
            },
            ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {})
        }));
        items.push(...(result.Items || []));
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items
        .filter(item => typeof item.genreName === 'string' && item.genreName.trim())
        .map(item => ({
            genreId: item.genreId,
            genreName: item.genreName.trim(),
            displayOrder: typeof item.displayOrder === 'number' && Number.isFinite(item.displayOrder) ? item.displayOrder : 99
        }))
        .sort((a, b) => {
            const aMiscellaneous = a.genreName.toLowerCase() === 'miscellaneous';
            const bMiscellaneous = b.genreName.toLowerCase() === 'miscellaneous';
            if (aMiscellaneous !== bMiscellaneous) return aMiscellaneous ? 1 : -1;
            return a.displayOrder - b.displayOrder || a.genreName.localeCompare(b.genreName);
        });
}

/**
 * Dynamically registers a new Heritage Genre in DynamoDB Single-Table registry.
 */
async function handleCreateGenre(event, tenantId) {
    const tableName = process.env.TABLE_NAME;
    const body = JSON.parse(event.body || "{}");
    const { genreName, displayOrder } = body;

    if (!genreName) {
        return response(400, { error: "genreName is required" });
    }

    const genreId = genreName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    const createdAt = new Date().toISOString();

    try {
        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: {
                PK: "GENRES_REGISTRY",
                SK: `GENRE#${genreId}`,
                genreId,
                genreName,
                displayOrder: displayOrder || 50,
                createdAt
            }
        }));

        return response(201, { genreId, genreName, displayOrder: displayOrder || 50, createdAt });
    } catch (err) {
        console.error("handleCreateGenre Error:", err);
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
