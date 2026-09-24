/**
 * ============================================================================
 * "Nuclear Option" System Factory Reset Lambda
 * ============================================================================
 * Architecture Pattern: Administrative System Factory Reset Utility.
 *
 * Enterprise Decision Rationale:
 * This function provides a complete, automated factory reset of all customer data.
 * It is completely isolated from API Gateway public routes and requires an explicit
 * confirmation key payload to execute.
 *
 * Purge Targets:
 * 1. S3 Buckets: Source Media, Thumbnails, HLS Output Segments.
 * 2. DynamoDB: Scans and deletes all items from Single-Table VideoMetadataTable.
 * 3. Cognito: Lists and deletes all authenticated user identities.
 */

const { S3Client, ListObjectsV2Command, ListObjectVersionsCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, ListUsersCommand, AdminDeleteUserCommand } = require("@aws-sdk/client-cognito-identity-provider");

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const cognitoClient = new CognitoIdentityProviderClient({});

const SOURCE_BUCKET = process.env.SOURCE_BUCKET;
const THUMBNAIL_BUCKET = process.env.THUMBNAIL_BUCKET;
const DEST_BUCKET = process.env.DEST_BUCKET;
const TABLE_NAME = process.env.TABLE_NAME;
const USER_POOL_ID = process.env.USER_POOL_ID;

const CONFIRMATION_KEY = "CONFIRM_SYSTEM_FACTORY_RESET_ALEXANDRIA";

exports.handler = async (event) => {
    console.log("NuclearResetFunction invoked with event:", JSON.stringify(event));

    // Phase 1: Safety Confirmation Gate
    const userConfirmation = event && (event.confirmReset || event.body && JSON.parse(event.body).confirmReset);

    if (userConfirmation !== CONFIRMATION_KEY) {
        console.error("NUCLEAR RESET ABORTED: Missing or invalid confirmation key.");
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: "ABORTED: System Factory Reset requires an explicit confirmation key.",
                requiredPayload: { confirmReset: CONFIRMATION_KEY }
            })
        };
    }

    console.warn("NUCLEAR RESET CONFIRMED: Beginning full system factory reset...");

    const auditLog = {
        startTime: new Date().toISOString(),
        purgedS3Objects: 0,
        purgedDynamoDbRecords: 0,
        purgedCognitoUsers: 0,
    };

    try {
        // Phase 2: Purge S3 Buckets (Source Media, Thumbnails, HLS)
        auditLog.purgedS3Objects += await purgeS3Bucket(SOURCE_BUCKET);
        auditLog.purgedS3Objects += await purgeS3Bucket(THUMBNAIL_BUCKET);
        auditLog.purgedS3Objects += await purgeS3Bucket(DEST_BUCKET);

        // Phase 3: Purge DynamoDB Metadata Table
        auditLog.purgedDynamoDbRecords += await purgeDynamoDbTable(TABLE_NAME);

        // Phase 4: Purge Cognito User Pool
        auditLog.purgedCognitoUsers += await purgeCognitoUsers(USER_POOL_ID);

        auditLog.endTime = new Date().toISOString();
        console.warn("SYSTEM FACTORY RESET COMPLETE:", JSON.stringify(auditLog));

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "System Factory Reset Complete. All customer data purged across S3, DynamoDB, and Cognito.",
                auditLog
            })
        };

    } catch (err) {
        console.error("NUCLEAR RESET FAILED:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message, auditLog })
        };
    }
};

/**
 * Recursively lists and deletes all objects and object versions in an S3 bucket.
 */
async function purgeS3Bucket(bucketName) {
    if (!bucketName) return 0;
    console.log(`NUCLEAR RESET: Purging S3 Bucket s3://${bucketName}...`);
    let deletedCount = 0;

    // Purge standard objects
    let continuationToken;
    do {
        const listRes = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken: continuationToken
        }));

        const objects = listRes.Contents || [];
        if (objects.length > 0) {
            await s3Client.send(new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: objects.map(o => ({ Key: o.Key }))
                }
            }));
            deletedCount += objects.length;
            console.log(`Deleted ${objects.length} objects from s3://${bucketName}`);
        }

        continuationToken = listRes.NextContinuationToken;
    } while (continuationToken);

    // Purge object versions (if bucket versioning is enabled)
    try {
        const versionRes = await s3Client.send(new ListObjectVersionsCommand({ Bucket: bucketName }));
        const versions = (versionRes.Versions || []).concat(versionRes.DeleteMarkers || []);
        if (versions.length > 0) {
            await s3Client.send(new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: versions.map(v => ({ Key: v.Key, VersionId: v.VersionId }))
                }
            }));
            deletedCount += versions.length;
        }
    } catch (vErr) {
        // Versioning list ignored if not versioned
    }

    return deletedCount;
}

/**
 * Scans DynamoDB Single-Table and deletes all items.
 */
async function purgeDynamoDbTable(tableName) {
    if (!tableName) return 0;
    console.log(`NUCLEAR RESET: Purging DynamoDB Table ${tableName}...`);
    let deletedCount = 0;

    let lastEvaluatedKey;
    do {
        const scanRes = await docClient.send(new ScanCommand({
            TableName: tableName,
            ExclusiveStartKey: lastEvaluatedKey
        }));

        const items = scanRes.Items || [];
        for (const item of items) {
            if (item.PK && item.SK) {
                await docClient.send(new DeleteCommand({
                    TableName: tableName,
                    Key: { PK: item.PK, SK: item.SK }
                }));
                deletedCount++;
            }
        }

        lastEvaluatedKey = scanRes.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Deleted ${deletedCount} records from DynamoDB Table ${tableName}`);
    return deletedCount;
}

/**
 * Lists and deletes all authenticated Cognito Users in the User Pool.
 */
async function purgeCognitoUsers(userPoolId) {
    if (!userPoolId) return 0;
    console.log(`NUCLEAR RESET: Purging Cognito Users from User Pool ${userPoolId}...`);
    let deletedCount = 0;

    let paginationToken;
    do {
        const listRes = await cognitoClient.send(new ListUsersCommand({
            UserPoolId: userPoolId,
            PaginationToken: paginationToken
        }));

        const users = listRes.Users || [];
        for (const user of users) {
            await cognitoClient.send(new AdminDeleteUserCommand({
                UserPoolId: userPoolId,
                Username: user.Username
            }));
            deletedCount++;
            console.log(`Deleted Cognito User: ${user.Username}`);
        }

        paginationToken = listRes.PaginationToken;
    } while (paginationToken);

    console.log(`Deleted ${deletedCount} users from Cognito User Pool ${userPoolId}`);
    return deletedCount;
}
