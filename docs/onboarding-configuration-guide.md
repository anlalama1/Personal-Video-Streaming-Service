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
"CognitoUserPool": {
    "Default": {
        "PoolId": "<YOUR_CUSTOMER_USER_POOL_ID>",
        "AppClientId": "<YOUR_CUSTOMER_ANDROID_CLIENT_ID>",
        "Region": "us-east-1"
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

## ⚡ Deployment Pipeline Automation Notice

For production web applications (**Demetrius Admin** & **The Scroll Viewer**), AWS CodePipeline **automatically passes live CloudFormation outputs** directly into build environments via `envFromCfnOutputs` in [`PipelineStack.ts`](file:///I:/Android%20Projects/infrastructure/lib/PipelineStack.ts). You do **not** need to manually update `.env` files for production web deployments!
