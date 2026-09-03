# Infrastructure Data Migration Plan (SDE Style)

This plan outlines the steps to migrate your media and metadata from the legacy `InfrastructureStack` to the new modular stacks without data loss.

## Phase 1: Deploy New Infrastructure
Ensure the new stacks are live so we have a destination for the data.
1.  Run `npx cdk deploy --all`.
2.  Capture the **New Resource IDs** from the terminal outputs:
    *   `StreamingStorageStack.MediaBucketName`
    *   `StreamingStorageStack.ThumbnailBucketName`
    *   `StreamingDatabaseStack.VideoMetadataTable` (You can get this via `aws dynamodb list-tables`)

## Phase 2: S3 Migration (Sync)
Use the high-performance `s3 sync` command to move your MP4s and JPGs.

```powershell
# Migrate Videos
aws s3 sync s3://[OLD_MEDIA_BUCKET] s3://[NEW_MEDIA_BUCKET]

# Migrate Thumbnails
aws s3 sync s3://[OLD_THUMBNAIL_BUCKET] s3://[NEW_THUMBNAIL_BUCKET]
```

## Phase 3: DynamoDB Migration
Since we only have a few items, we will use a simple scan-and-pipe approach or manual entry in the console.

**Option A: The "SDE CLI" way (PowerShell loop)**:
```powershell
# 1. Fetch all items from old table to a file
aws dynamodb scan --table-name [OLD_TABLE_NAME] --output json > migration_data.json

# 2. Since the item count is very low (< 5), 
# it is safest to copy the JSON objects manually into the "Create Item" -> "JSON" view 
# of the NEW DynamoDB table in the AWS Console.
```

## Phase 4: App Update & Cleanup
1.  Update your Android `core:data` build file with the **New `ApiUrl`**.
2.  Verify the app loads your videos perfectly.
3.  **Delete the legacy stack**:
    `aws cloudformation delete-stack --stack-name InfrastructureStack`
