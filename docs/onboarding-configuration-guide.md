# Alexandria+ Onboarding & Configuration Guide

This guide consolidates all **account-dependent configuration settings** across the codebase for developers deploying Alexandria+ into a new AWS account.

---

## 🛠️ Centralized Configuration Inventory

When onboarding to a new AWS account, update the four configuration files below in order:

### 1. CDK Deployment Config: [`infrastructure/bin/config.ts`](file:///I:/Android%20Projects/infrastructure/bin/config.ts)
* **`account`**: Your 12-digit target AWS Account ID (e.g., `'123456789012'`).
* **`region`**: Target AWS deployment region (e.g., `'us-east-1'`).
* **`githubRepo`**: Your forked repository path (e.g., `'your-username/Personal-Video-Streaming-Service'`).
* **`githubBranch`**: Git branch driving CodePipeline builds (default: `'main'`).
* **`githubConnectionArn`**: ARN of your AWS CodeConnections GitHub connection created in the AWS Console.
* **`useCustomDomain`**: `true` if deploying custom domain routes (`alexandria-plus.com`), or `false` for raw AWS endpoints.

---

### 2. Mobile Android Auth Config: [`app/src/main/res/raw/amplifyconfiguration.json`](file:///I:/Android%20Projects/app/src/main/res/raw/amplifyconfiguration.json)
After running initial CDK synthesis/deployment (`npx cdk deploy --all` or CodePipeline `Synth`), extract the output from CloudFormation stack **`Prod-AuthStack`**:
* **`PoolId`**: Extract `CustomerUserPoolId` output (e.g., `"us-east-1_XXXXX"`).
* **`AppClientId`**: Extract `CustomerAndroidClientId` output (e.g., `"450aib3rtv77sglvalkneruf9c"`).
* **`Region`**: Target AWS Region (e.g., `"us-east-1"`).

```json
{
  "CognitoUserPool": {
    "Default": {
        "PoolId": "<YOUR_CUSTOMER_USER_POOL_ID>",
        "AppClientId": "<YOUR_CUSTOMER_ANDROID_CLIENT_ID>",
        "Region": "us-east-1"
    }
  }
}
```

---

### 3. Mobile API Endpoint Config: [`core/data/build.gradle.kts`](file:///I:/Android%20Projects/core/data/build.gradle.kts)
* **`BASE_URL`**: Set to custom domain API (`"https://api.alexandria-plus.com/"`) or raw CloudFormation `Prod-ApiStack` $\rightarrow$ `ApiUrl` output (`"https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/"`).

---

### 4. Admin Portal AI Model Config: [`app-admin/src/config.ts`](file:///I:/Android%20Projects/app-admin/src/config.ts)
* **`BEDROCK_MODEL_ID`**: The active Amazon Bedrock foundation model ID for AI metadata drafting (default: `'us.anthropic.claude-haiku-4-5-20251001-v1:0'`).

---

## 🎞️ Seed the DynamoDB genre registry

After deploying the infrastructure, add the supported video genres to the
`GENRES_REGISTRY` partition in the DynamoDB metadata table. The AI metadata
worker and customer catalogs read genres from this registry; metadata extraction
and review publishing require at least one valid genre item.

In PowerShell, set the target region and AWS CLI profile, then discover the
physical table name from the deployed `Prod-DatabaseStack`:

```powershell
$region = "us-east-1"
$env:AWS_PROFILE = "your-deployment-profile"
$tableName = aws cloudformation describe-stack-resources `
  --stack-name Prod-DatabaseStack `
  --query "StackResources[?ResourceType=='AWS::DynamoDB::Table'].PhysicalResourceId | [0]" `
  --output text `
  --region $region
if ($LASTEXITCODE -ne 0 -or !$tableName -or $tableName -eq "None") {
  throw "Could not find the DynamoDB metadata table in Prod-DatabaseStack."
}
```

Create the genre records. The stable ID is used in both the
`genreId` attribute and the `GENRE#<id>` sort key. The `put-item` operation is
idempotent for these keys and updates an existing item with the same key.

```powershell
$genres = @(
  @{ Id = "holidays_birthdays_and_special_occasions"; Name = "Holidays, Birthdays and Special Occasions"; Order = 1 }
  @{ Id = "daily_life"; Name = "Daily Life"; Order = 2 }
  @{ Id = "friend_and_family"; Name = "Friends and Family"; Order = 3 }
  @{ Id = "milestones"; Name = "Milestones"; Order = 4 }
  @{ Id = "school_sports_and_hobbies"; Name = "School, Sports and Hobbies"; Order = 5 }
  @{ Id = "travel_and_vacation"; Name = "Travel and Vacation"; Order = 6 }
  @{ Id = "miscellaneous"; Name = "Miscellaneous"; Order = 7 }
  @{ Id = "pets_and_animals"; Name = "Pets and Animals"; Order = 8 }
  @{ Id = "performances_and_recitals"; Name = "Performances and Recitals"; Order = 9 }
  @{ Id = "arts_crafts_and_projects"; Name = "Arts, Crafts and Projects"; Order = 10 }
  @{ Id = "community_and_cultural_events"; Name = "Community and Cultural Events"; Order = 11 }
  @{ Id = "home_and_everyday_places"; Name = "Home and Everyday Places"; Order = 12 }
  @{ Id = "nature_and_outdoor_moments"; Name = "Nature and Outdoor Moments"; Order = 13 }
)

$itemPath = Join-Path $env:TEMP "alexandria-genre-item.json"
foreach ($genre in $genres) {
  $item = @{
    PK           = @{ S = "GENRES_REGISTRY" }
    SK           = @{ S = "GENRE#$($genre.Id)" }
    genreId      = @{ S = $genre.Id }
    genreName    = @{ S = $genre.Name }
    displayOrder = @{ N = [string]$genre.Order }
    createdAt    = @{ S = [DateTime]::UtcNow.ToString("o") }
  } | ConvertTo-Json -Depth 5 -Compress

  Set-Content -LiteralPath $itemPath -Value $item -Encoding ascii
  aws dynamodb put-item `
    --table-name $tableName `
    --item "file://$itemPath" `
    --region $region
  if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $itemPath -ErrorAction SilentlyContinue
    throw "Failed to create genre: $($genre.Name)"
  }
}
Remove-Item -LiteralPath $itemPath -ErrorAction SilentlyContinue
```

Verify the registered items:

```powershell
$valuesPath = Join-Path $env:TEMP "alexandria-genre-query.json"
$values = @{
  ":pk"     = @{ S = "GENRES_REGISTRY" }
  ":prefix" = @{ S = "GENRE#" }
} | ConvertTo-Json -Depth 5 -Compress
Set-Content -LiteralPath $valuesPath -Value $values -Encoding ascii
aws dynamodb query `
  --table-name $tableName `
  --key-condition-expression "PK = :pk AND begins_with(SK, :prefix)" `
  --expression-attribute-values "file://$valuesPath" `
  --region $region
Remove-Item -LiteralPath $valuesPath -ErrorAction SilentlyContinue
```

---

## 🔐 Configure Google sign-in

The customer Cognito pool uses a Google identity provider for web and Android
social sign-in. In AWS Secrets Manager in the CDK deployment account and region,
create a secret named `alexandria/google-oauth` with this JSON structure:

```json
{
  "client_id": "<Google OAuth client ID>",
  "client_secret": "<Google OAuth client secret>"
}
```

In Google Cloud Console, add the customer Cognito domain's
`https://<cognito-domain>/oauth2/idpresponse` URL as an authorized redirect URI
for that OAuth client. Cognito then redirects back to the app client callback
URLs configured in `AuthStack.ts`. Keep the client secret in Secrets Manager;
the CDK stack references it dynamically and does not store it in source code.
Deploy the Auth stack after creating the secret. The deployment's CloudFormation
execution role must be allowed to read the secret.

---

## ⚡ Deployment Pipeline Automation Notice

For production web applications (**Demetrius Admin** & **The Scroll Viewer**), AWS CodePipeline **automatically passes live CloudFormation outputs** directly into build environments via `envFromCfnOutputs` in [`PipelineStack.ts`](file:///I:/Android%20Projects/infrastructure/lib/PipelineStack.ts). You do **not** need to manually update `.env` files for production web deployments!
