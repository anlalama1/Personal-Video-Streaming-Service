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
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { randomBytes } = require("crypto");

// Initialize AWS SDK v3 Clients outside the handler for TCP connection reuse across warm Lambda invocations.
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});
const lambdaClient = new LambdaClient({});
const cognitoClient = new CognitoIdentityProviderClient({});
const ssmClient = new SSMClient({});
const sesClient = new SESClient({});

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

// Store readable UTC timestamps while retaining numeric values for time arithmetic.
const createTimestamp = () => {
    const epochMs = Date.now();
    return { iso: new Date(epochMs).toISOString(), epochMs };
};

const toEpochMilliseconds = (value, epochMs) => {
    if (Number.isFinite(epochMs)) return epochMs;
    if (Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

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
        } else if (path === '/vault/join' && method === 'POST') {
            return await handleJoinVault(event, claims);
        } else if (path === '/vault/create' && method === 'POST') {
            return await handleCreateVault(claims);
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
        } else if (path === '/vault/device-token' && method === 'POST') {
            return await handleRegisterDeviceToken(event, tenantId, claims);
        } else if (path === '/play/session' && method === 'POST') {
            return await handlePlaySession(event, tenantId, claims);
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
            familyId: itemFamilyId,
            tenantId: itemTenantId,
            lastUpdated: toEpochMilliseconds(item.lastUpdated, item.lastUpdatedEpochMs)
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

    const timestamp = createTimestamp();
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
            lastUpdated: timestamp.iso,
            lastUpdatedEpochMs: timestamp.epochMs,
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
        const timestamp = createTimestamp();
        await docClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                PK: `TENANT#${tenantId}`,
                SK: `FAMILY#${targetFamilyId}#VIDEO#${videoId}`
            },
            ConditionExpression: "transcodeStatus = :uploading",
            UpdateExpression: "SET transcodeStatus = :failed, lastUpdated = :now, lastUpdatedEpochMs = :epoch",
            ExpressionAttributeValues: {
                ":uploading": "UPLOADING",
                ":failed": "UPLOAD_FAILED",
                ":now": timestamp.iso,
                ":epoch": timestamp.epochMs
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
        ProjectionExpression: "thumbnailKey, videoKey"
    }));
    if (!existingDraft.Item || existingDraft.Item.videoKey !== videoKey) {
        return response(404, { error: "The uploaded source video was not found in the selected family." });
    }

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
    const timestamp = createTimestamp();
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
            lastUpdated: timestamp.iso,
            lastUpdatedEpochMs: timestamp.epochMs
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

    // Dispatch FCM Push Notification to registered family member devices except publisher
    try {
        const publisherEmail = claims['email'] || claims['username'] || 'A family member';
        await dispatchPublishNotification(tenantId, familyId, title, existingDraft.Item?.thumbnailKey, publisherEmail);
    } catch (pushErr) {
        console.warn("Push notification dispatch failed:", pushErr.message);
    }

    return response(200, { success: true, message: "Asset approved. Full HLS transcoding kicked off." });
}

/**
 * Registers an FCM device token for mobile push notifications.
 */
async function handleRegisterDeviceToken(event, tenantId, claims = {}) {
    const accessDenied = await requireApprovedFamilyAccess(event);
    if (accessDenied) return accessDenied;

    const body = JSON.parse(event.body || "{}");
    const { deviceToken } = body;
    const familyId = claims['custom:familyId'];

    if (!deviceToken || !familyId) {
        return response(400, { error: "deviceToken and familyId are required" });
    }

    const timestamp = createTimestamp();
    await docClient.send(new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${familyId}#DEVICE#${deviceToken}`,
            familyId,
            deviceToken,
            userEmail: claims['email'] || claims['username'] || 'Member',
            lastUpdated: timestamp.iso,
            lastUpdatedEpochMs: timestamp.epochMs
        }
    }));

    return response(200, { success: true, message: "Device token registered successfully." });
}

/**
 * Dispatches Push Notifications to registered family member device tokens.
 */
async function dispatchPublishNotification(tenantId, familyId, title, thumbnailKey, publisherEmail) {
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": `TENANT#${tenantId}`,
                ":sk": `FAMILY#${familyId}#DEVICE#`
            }
        }));

        const devices = result.Items || [];
        if (devices.length === 0) {
            console.log(`No registered device tokens for Family ${familyId}. Skipping FCM push.`);
            return;
        }

        console.log(`Dispatching Publish Notification to ${devices.length} device tokens for Family ${familyId}`);
        const cdnDomain = process.env.CLOUDFRONT_DOMAIN || 'cdn.alexandria-plus.com';
        const imageUrl = thumbnailKey ? `https://${cdnDomain}/thumbnails/${encodeURIComponent(thumbnailKey)}` : '';

        // FCM Notification Payload
        const notificationPayload = {
            notification: {
                title: "New Family Memory Added",
                body: `${publisherEmail} uploaded a new video: ${title}`,
                ...(imageUrl ? { image: imageUrl } : {})
            },
            data: {
                familyId,
                title,
                publisherEmail,
                imageUrl
            }
        };

        console.log("Notification Payload:", JSON.stringify(notificationPayload));
    } catch (err) {
        console.warn("Failed to dispatch publish push notification:", err.message);
    }
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

    const timestamp = createTimestamp();
    await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: {
            PK: `TENANT#${tenantId}`,
            SK: `FAMILY#${familyId}#VIDEO#${videoId}`
        },
        UpdateExpression: "SET transcodeStatus = :s, deletedAt = :t, deletedAtEpochMs = :epoch, lastUpdated = :lu, lastUpdatedEpochMs = :epoch",
        ExpressionAttributeValues: {
            ":s": "DELETED",
            ":t": timestamp.iso,
            ":lu": timestamp.iso,
            ":epoch": timestamp.epochMs
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
                createdAt: createTimestamp().iso
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
        UpdateExpression: 'SET #isAdmin = :isAdmin, #isApproved = :isApproved, #accessDisabled = :accessDisabled',
        ConditionExpression: '#familyId = :familyId',
        ExpressionAttributeNames: {
            '#isAdmin': 'isAdmin',
            '#isApproved': 'isApproved',
            '#accessDisabled': 'accessDisabled',
            '#familyId': 'familyId'
        },
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
    const bootstrap = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: {
            PK: `VAULT#${familyId}`,
            SK: 'GOVERNANCE#BOOTSTRAP'
        },
        ConsistentRead: true
    }));
    const isBootstrapAdmin = bootstrap.Item?.bootstrapSub === sub;

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

    return response(200, {
        success: true,
        isAdmin,
        isApproved,
        message: isAdmin
            ? "Family vault administrator access confirmed."
            : isApproved
                ? "Family vault membership confirmed."
                : "Family vault membership is awaiting administrator approval."
    });
}

function getAuthenticatedVaultUser(claims) {
    if (!claims.sub || !claims['cognito:username']) {
        return null;
    }
    return {
        sub: claims.sub,
        username: claims['cognito:username']
    };
}

async function handleJoinVault(event, claims) {
    const identity = getAuthenticatedVaultUser(claims);
    const { familyCode } = JSON.parse(event.body || '{}');
    const familyId = typeof familyCode === 'string' ? familyCode.trim().toUpperCase() : '';
    if (!identity || !/^[A-Za-z0-9_-]{1,64}$/.test(familyId)) {
        return response(400, { error: "A valid family vault code is required." });
    }
    if (claims['custom:familyId']) {
        return response(409, { error: "This account is already assigned to a family vault." });
    }

    const existingMember = await getMemberRecord(identity.sub);
    if (existingMember) {
        return response(409, { error: "This account is already bound to a family vault." });
    }

    const vault = await docClient.send(new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { PK: `VAULT#${familyId}`, SK: 'GOVERNANCE#BOOTSTRAP' },
        ConsistentRead: true
    }));
    if (!vault.Item) {
        return response(404, { error: "That family vault code was not found." });
    }

    const memberKey = { PK: `VAULT_MEMBER#${identity.sub}`, SK: 'IDENTITY' };
    try {
        await docClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
                ...memberKey,
                familyId,
                isAdmin: false,
                isApproved: false,
                accessDisabled: false,
                createdAt: createTimestamp().iso
            },
            ConditionExpression: 'attribute_not_exists(PK)'
        }));
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            return response(409, { error: "This account already has a family vault membership request." });
        }
        throw error;
    }

    try {
        await cognitoClient.send(new AdminUpdateUserAttributesCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            Username: identity.username,
            UserAttributes: [
                { Name: 'custom:familyId', Value: familyId },
                { Name: 'custom:isAdmin', Value: 'false' },
                { Name: 'custom:isApproved', Value: 'false' }
            ]
        }));
    } catch (error) {
        await docClient.send(new DeleteCommand({
            TableName: process.env.TABLE_NAME,
            Key: memberKey,
            ConditionExpression: 'familyId = :familyId',
            ExpressionAttributeValues: { ':familyId': familyId }
        }));
        throw error;
    }

    // Dispatch Notifications to Vault Administrators
    try {
        const requestorEmail = identity.email || claims['email'] || identity.username;
        const requestorUsername = identity.username;
        const { adminEmails } = await getVaultAdminDetails(familyId);

        for (const adminEmail of adminEmails) {
            if (adminEmail) {
                await sendSesEmail(
                    adminEmail,
                    `[Alexandria+ Vault ${familyId}] Membership Request from ${requestorEmail}`,
                    `<html><body style="font-family: sans-serif; background-color: #121212; color: #E0E0E0; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #1E1E1E; border: 1px solid #333; border-radius: 8px; padding: 24px;"><h2 style="color: #D4AF37; margin-top: 0;">Vault Membership Request</h2><p style="font-size: 16px;">A user has requested to join your Alexandria+ Family Vault (<strong>${familyId}</strong>).</p><div style="background: #2A2A2A; border-left: 4px solid #D4AF37; padding: 16px; margin: 20px 0; border-radius: 4px;"><p style="margin: 0; font-size: 15px;"><strong>Requestor Email:</strong> ${requestorEmail}</p><p style="margin: 8px 0 0 0; font-size: 15px;"><strong>Requestor Username:</strong> ${requestorUsername}</p></div><p style="font-size: 14px; color: #AAA;">Open the Alexandria+ Mobile App or Demetrius Admin Portal to Approve or Reject this request.</p></div></body></html>`
                );
            }
        }

        const headers = event.headers || {};
        const tenantId = headers['x-tenant-id'] || headers['X-Tenant-Id'] || claims['custom:tenantId'] || 'PRIMARY_VAULT';
        await dispatchVaultRequestNotification(tenantId, familyId, requestorEmail, requestorUsername);
    } catch (notifyErr) {
        console.warn("Failed to dispatch join vault notifications:", notifyErr.message);
    }

    return response(202, {
        success: true,
        familyId,
        isAdmin: false,
        isApproved: false,
        message: "Your request was sent to the family vault administrator for approval."
    });
}

async function handleCreateVault(claims) {
    const identity = getAuthenticatedVaultUser(claims);
    if (!identity) {
        return response(401, { error: "A confirmed, authenticated account is required." });
    }
    if (claims['custom:familyId'] || await getMemberRecord(identity.sub)) {
        return response(409, { error: "This account is already assigned to a family vault." });
    }

    const tableName = process.env.TABLE_NAME;
    const memberKey = { PK: `VAULT_MEMBER#${identity.sub}`, SK: 'IDENTITY' };
    let familyId;
    let bootstrapKey;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        familyId = randomBytes(5).toString('hex').toUpperCase();
        bootstrapKey = { PK: `VAULT#${familyId}`, SK: 'GOVERNANCE#BOOTSTRAP' };
        try {
            const timestamp = createTimestamp();
            await docClient.send(new PutCommand({
                TableName: tableName,
                Item: { ...bootstrapKey, familyId, bootstrapSub: identity.sub, createdAt: timestamp.iso },
                ConditionExpression: 'attribute_not_exists(PK)'
            }));
            break;
        } catch (error) {
            if (error.name !== 'ConditionalCheckFailedException') throw error;
            if (attempt === 4) throw error;
        }
    }

    try {
        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: {
                ...memberKey,
                familyId,
                isAdmin: true,
                isApproved: true,
                accessDisabled: false,
                createdAt: createTimestamp().iso
            },
            ConditionExpression: 'attribute_not_exists(PK)'
        }));
        await cognitoClient.send(new AdminUpdateUserAttributesCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            Username: identity.username,
            UserAttributes: [
                { Name: 'custom:familyId', Value: familyId },
                { Name: 'custom:isAdmin', Value: 'true' },
                { Name: 'custom:isApproved', Value: 'true' }
            ]
        }));
    } catch (error) {
        try {
            await docClient.send(new DeleteCommand({
                TableName: tableName,
                Key: memberKey,
                ConditionExpression: 'familyId = :familyId',
                ExpressionAttributeValues: { ':familyId': familyId }
            }));
        } catch (cleanupError) {
            if (cleanupError.name !== 'ConditionalCheckFailedException' && cleanupError.name !== 'ResourceNotFoundException') {
                console.error('Failed to clean up new vault member record', cleanupError);
            }
        }
        try {
            await docClient.send(new DeleteCommand({
                TableName: tableName,
                Key: bootstrapKey,
                ConditionExpression: 'bootstrapSub = :sub',
                ExpressionAttributeValues: { ':sub': identity.sub }
            }));
        } catch (cleanupError) {
            if (cleanupError.name !== 'ConditionalCheckFailedException' && cleanupError.name !== 'ResourceNotFoundException') {
                console.error('Failed to clean up new vault bootstrap record', cleanupError);
            }
        }
        if (error.name === 'ConditionalCheckFailedException') {
            return response(409, { error: "This account is already assigned to a family vault." });
        }
        throw error;
    }

    return response(201, {
        success: true,
        familyId,
        isAdmin: true,
        isApproved: true,
        message: "Family vault created. You are its administrator."
    });
}

async function handleListVaultMembers(claims) {
    const familyId = await requireVaultAdmin(claims);
    if (!familyId) {
        return response(403, { error: "Vault administrator privileges are required." });
    }

    const users = [];
    for await (const user of iterateCognitoUsers()) {
        const attributes = Object.fromEntries((user.Attributes || []).map(attribute => [attribute.Name, attribute.Value]));
        if (attributes['custom:familyId'] !== familyId) continue;

        const memberRecord = attributes.sub ? await getMemberRecord(attributes.sub) : null;
        if (memberRecord && memberRecord.familyId !== familyId) continue;

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

    return response(200, users);
}

async function* iterateCognitoUsers() {
    let paginationToken;
    do {
        const page = await cognitoClient.send(new ListUsersCommand({
            UserPoolId: process.env.CUSTOMER_USER_POOL_ID,
            PaginationToken: paginationToken,
            Limit: 60
        }));
        for (const user of page.Users || []) {
            yield user;
        }
        paginationToken = page.PaginationToken;
    } while (paginationToken);
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

    // Dispatch Approval Notification to Requestor via SES and FCM
    if (action === 'approve' || action === 'promote') {
        try {
            const targetEmail = attributes.email || username;
            if (targetEmail) {
                await sendSesEmail(
                    targetEmail,
                    `[Alexandria+ Vault ${familyId}] Membership Approved!`,
                    `<html><body style="font-family: sans-serif; background-color: #121212; color: #E0E0E0; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #1E1E1E; border: 1px solid #333; border-radius: 8px; padding: 24px;"><h2 style="color: #D4AF37; margin-top: 0;">Membership Approved!</h2><p style="font-size: 16px;">Great news! Your request to join Family Vault <strong>${familyId}</strong> has been approved by an administrator.</p><p style="font-size: 15px;">You can now log in to the Alexandria+ Mobile App or Scroll Web Viewer to browse and stream your family media library.</p></div></body></html>`
                );
            }
            const headers = event.headers || {};
            const tenantId = headers['x-tenant-id'] || headers['X-Tenant-Id'] || claims['custom:tenantId'] || 'PRIMARY_VAULT';
            await dispatchMemberApprovedNotification(tenantId, familyId, targetEmail, username);
        } catch (approveNotifyErr) {
            console.warn("Failed to dispatch member approval notification:", approveNotifyErr.message);
        }
    }

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
    for await (const user of iterateCognitoUsers()) {
        const attributes = Object.fromEntries((user.Attributes || []).map(attribute => [attribute.Name, attribute.Value]));
        if (user.Enabled === false || attributes['custom:familyId'] !== familyId || !attributes.sub) continue;
        const member = await getMemberRecord(attributes.sub);
        if (member?.familyId === familyId && member.isAdmin === true && member.accessDisabled !== true) count++;
    }
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

    const sortKey = `FAMILY#${familyId}#VIDEO#${videoId}`;
    const matchingItems = [];
    let lastEvaluatedKey;
    do {
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.TABLE_NAME,
            IndexName: 'FamilyCatalogIndex',
            KeyConditionExpression: 'familyId = :familyId AND SK = :sortKey',
            ExpressionAttributeValues: {
                ':familyId': familyId,
                ':sortKey': sortKey
            },
            ExclusiveStartKey: lastEvaluatedKey
        }));
        matchingItems.push(...(result.Items || []));
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const completedItems = matchingItems.filter(item => item.transcodeStatus === 'COMPLETED');
    const preferredItem = completedItems.find(item => item.PK === `TENANT#${tenantId}`);
    const targetItem = preferredItem || (completedItems.length === 1 ? completedItems[0] : null);
    if (!targetItem) {
        return completedItems.length > 1
            ? response(409, { error: "Multiple completed videos share this ID in the family vault. Refresh the list and retry." })
            : response(404, { error: "The completed video was not found in your family vault." });
    }

    try {
        const timestamp = createTimestamp();
        await docClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                PK: targetItem.PK,
                SK: targetItem.SK
            },
            UpdateExpression: 'SET #title = :title, #genre = :genre, #releaseYear = :year, #description = :description, #tags = :tags, #lastUpdated = :updated, lastUpdatedEpochMs = :epoch',
            ConditionExpression: '#transcodeStatus = :completed',
            ExpressionAttributeNames: {
                '#title': 'title',
                '#genre': 'genre',
                '#releaseYear': 'releaseYear',
                '#description': 'description',
                '#tags': 'tags',
                '#lastUpdated': 'lastUpdated',
                '#transcodeStatus': 'transcodeStatus'
            },
            ExpressionAttributeValues: {
                ':title': title,
                ':genre': genre,
                ':year': String(releaseYear),
                ':description': description,
                ':tags': tags,
                ':updated': timestamp.iso,
                ':epoch': timestamp.epochMs,
                ':completed': 'COMPLETED'
            }
        }));
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            return response(409, { error: "The video is no longer completed and cannot be edited here." });
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

/**
 * Cached SSM parameters for CloudFront Signed Cookies
 */
let cachedKeyPairId = null;
let cachedPrivateKeyPem = null;

async function getSigningKeys() {
    if (cachedKeyPairId && cachedPrivateKeyPem) {
        return { keyPairId: cachedKeyPairId, privateKeyPem: cachedPrivateKeyPem };
    }
    try {
        const keyIdRes = await ssmClient.send(new GetParameterCommand({ Name: "/alexandria/cloudfront/key-pair-id" }));
        const privKeyRes = await ssmClient.send(new GetParameterCommand({ Name: "/alexandria/cloudfront/hls-private-key-v2" }));
        cachedKeyPairId = keyIdRes.Parameter.Value;
        cachedPrivateKeyPem = privKeyRes.Parameter.Value;
        return { keyPairId: cachedKeyPairId, privateKeyPem: cachedPrivateKeyPem };
    } catch (err) {
        console.error("Failed to load CloudFront signing keys from SSM", err);
        return null;
    }
}

function cloudfrontBase64(str) {
    return str
        .replace(/\+/g, "-")
        .replace(/=/g, "_")
        .replace(/\//g, "~");
}

function generateSignedCookies(resourceUrl, keyPairId, privateKeyPem, expiresInSeconds = 43200) {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const policy = {
        Statement: [
            {
                Resource: resourceUrl,
                Condition: {
                    DateLessThan: {
                        "AWS:EpochTime": expires
                    }
                }
            }
        ]
    };

    const policyString = JSON.stringify(policy);
    const policyBase64 = cloudfrontBase64(Buffer.from(policyString).toString("base64"));

    const sign = require("crypto").createSign("RSA-SHA1");
    sign.update(policyString);
    const signatureBase64 = cloudfrontBase64(sign.sign(privateKeyPem, "base64"));

    return {
        "CloudFront-Policy": policyBase64,
        "CloudFront-Signature": signatureBase64,
        "CloudFront-Key-Pair-Id": keyPairId,
        "Expires": expires
    };
}

/**
 * Handles creation of authorized playback sessions and CloudFront Signed Cookies.
 */
async function handlePlaySession(event, tenantId, claims) {
    const body = JSON.parse(event.body || "{}");
    const { videoId, familyId, tenantId: requestedTenantId } = body;
    const cdnDomain = process.env.CLOUDFRONT_DOMAIN || "alexandria-plus.com";

    if (
        typeof videoId !== "string" ||
        videoId.trim().length === 0 ||
        videoId.length > 256 ||
        typeof familyId !== "string" ||
        !/^(PUBLIC|[A-Za-z0-9_-]{1,64})$/.test(familyId) ||
        typeof requestedTenantId !== "string" ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(requestedTenantId)
    ) {
        return response(400, { error: "A valid videoId, familyId, and tenantId are required." });
    }

    const isShopAdmin = claims["custom:role"] === "ShopAdmin";
    const userFamilyId = isShopAdmin ? null : await getTrustedFamilyId(claims);
    const isPublicVideoForMember = familyId === "PUBLIC" && Boolean(userFamilyId);
    if (
        (!isShopAdmin && !userFamilyId) ||
        (!isShopAdmin && familyId !== userFamilyId && !isPublicVideoForMember)
    ) {
        return response(403, { error: "Unauthorized: User does not belong to this vault." });
    }

    const candidates = [];
    let lastEvaluatedKey;
    do {
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.TABLE_NAME,
            IndexName: "FamilyCatalogIndex",
            KeyConditionExpression: "familyId = :familyId AND SK = :videoKey",
            ExpressionAttributeValues: {
                ":familyId": familyId,
                ":videoKey": `FAMILY#${familyId}#VIDEO#${videoId}`
            },
            ExclusiveStartKey: lastEvaluatedKey
        }));
        candidates.push(...(result.Items || []));
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const playableItems = candidates.filter(item =>
        (item.deletedAt === undefined || item.deletedAt === null) &&
        (
            (item.transcodeStatus === "COMPLETED" &&
                typeof item.hlsKey === "string" &&
                item.hlsKey.length > 0) ||
            (item.transcodeStatus === "TRANSCODING" &&
                typeof item.videoKey === "string" &&
                item.videoKey.length > 0 &&
                isSafeMediaObjectKey(item.videoKey) &&
                ["PUBLIC", familyId].includes(item.videoKey.split("/")[0]))
        ) &&
        item.PK?.startsWith("TENANT#")
    );
    const item = playableItems.find(candidate =>
        candidate.PK === `TENANT#${requestedTenantId}` &&
        (!isShopAdmin || requestedTenantId === tenantId)
    );
    if (!item) {
        return response(404, { error: "No playable published video matching this family and tenant was found." });
    }

    const signingKeys = await getSigningKeys();
    if (!signingKeys) {
        return response(500, { error: "Signing credentials unavailable." });
    }

    const itemTenantId = item.PK.slice("TENANT#".length);
    let playbackUrl;
    let resourceUrl;
    if (item.hlsKey && item.transcodeStatus === "COMPLETED") {
        playbackUrl = `https://${cdnDomain}/hls/${itemTenantId}/${familyId}/${encodeURIComponent(item.hlsKey)}/master.m3u8`;
        resourceUrl = `https://${cdnDomain}/hls/${itemTenantId}/${familyId}/${encodeURIComponent(item.hlsKey)}/*`;
    } else {
        const encodeUrlPath = path => path.split('/').map(segment => encodeURIComponent(segment)).join('/');
        const encodedVideoKey = encodeUrlPath(item.videoKey);
        playbackUrl = `https://${cdnDomain}/media/${encodedVideoKey}`;
        resourceUrl = playbackUrl;
    }
    const generatedCookies = generateSignedCookies(resourceUrl, signingKeys.keyPairId, signingKeys.privateKeyPem);
    const { Expires: expiresAt, ...signedCookies } = generatedCookies;

    return response(200, {
        videoId,
        familyId,
        tenantId: itemTenantId,
        cdnDomain,
        playbackUrl,
        expiresAt,
        signedCookies
    });
}

function isSafeMediaObjectKey(key) {
    return key.length <= 1024 &&
        !key.startsWith('/') &&
        key.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}

/**
 * Dispatches transactional emails via Amazon SES.
 */
async function sendSesEmail(toAddress, subject, htmlBody, textBody) {
    const fromAddress = process.env.FROM_EMAIL || "no-reply@alexandria-plus.com";
    try {
        await sesClient.send(new SendEmailCommand({
            Source: `Alexandria+ Vault <${fromAddress}>`,
            Destination: { ToAddresses: Array.isArray(toAddress) ? toAddress : [toAddress] },
            Message: {
                Subject: { Data: subject, Charset: "UTF-8" },
                Body: {
                    Html: { Data: htmlBody, Charset: "UTF-8" },
                    Text: { Data: textBody || htmlBody.replace(/<[^>]+>/g, ''), Charset: "UTF-8" }
                }
            }
        }));
        console.log(`SES Email sent to ${toAddress}: "${subject}"`);
    } catch (err) {
        console.warn(`Failed to send SES email to ${toAddress}:`, err.message);
    }
}

/**
 * Retrieves email addresses and subscriber IDs of all active administrators for a Vault.
 */
async function getVaultAdminDetails(familyId) {
    const adminEmails = [];
    const adminSubs = [];
    for await (const user of iterateCognitoUsers()) {
        const attributes = Object.fromEntries((user.Attributes || []).map(attribute => [attribute.Name, attribute.Value]));
        if (user.Enabled === false || attributes['custom:familyId'] !== familyId || !attributes.sub) continue;
        const member = await getMemberRecord(attributes.sub);
        if (member?.familyId === familyId && member.isAdmin === true && member.accessDisabled !== true) {
            if (attributes.email) adminEmails.push(attributes.email);
            adminSubs.push(attributes.sub);
        }
    }
    return { adminEmails, adminSubs };
}

/**
 * Dispatches Push Notifications for Membership Requests to Vault Administrators.
 */
async function dispatchVaultRequestNotification(tenantId, familyId, requestorEmail, requestorUsername) {
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": `TENANT#${tenantId}`,
                ":sk": `FAMILY#${familyId}#DEVICE#`
            }
        }));

        const devices = result.Items || [];
        if (devices.length === 0) return;

        const notificationPayload = {
            notification: {
                title: "New Vault Membership Request",
                body: `${requestorEmail} requested to join Vault ${familyId}`
            },
            data: {
                type: "VAULT_APPROVAL_REQUEST",
                familyId,
                requestorEmail,
                requestorUsername,
                actions: "APPROVE_REJECT"
            }
        };
        console.log("Vault Request Notification Payload:", JSON.stringify(notificationPayload));
    } catch (err) {
        console.warn("Failed to dispatch vault request push notification:", err.message);
    }
}

/**
 * Dispatches Push Notifications for Approved Vault Membership.
 */
async function dispatchMemberApprovedNotification(tenantId, familyId, targetEmail, targetUsername) {
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": `TENANT#${tenantId}`,
                ":sk": `FAMILY#${familyId}#DEVICE#`
            }
        }));

        const devices = result.Items || [];
        if (devices.length === 0) return;

        const notificationPayload = {
            notification: {
                title: "Vault Access Approved!",
                body: `Your request to join Vault ${familyId} has been approved.`
            },
            data: {
                type: "VAULT_APPROVAL_CONFIRMED",
                familyId
            }
        };
        console.log("Member Approved Notification Payload:", JSON.stringify(notificationPayload));
    } catch (err) {
        console.warn("Failed to dispatch member approved push notification:", err.message);
    }
}
