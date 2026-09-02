# Cloud Infrastructure (AWS CDK)

This directory contains the AWS CDK (Cloud Development Kit) project for the Personal Video Streaming Service. It defines the serverless backend (S3, DynamoDB, Lambda, and API Gateway) using TypeScript.

## Prerequisites

1. **Node.js**: v20 or higher.
2. **AWS CLI**: [Installed and configured](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
3. **AWS Account**: A personal AWS account.

## AWS Credentials & CLI Setup

To deploy this infrastructure, your terminal needs permission to talk to AWS.

### 1. Security First: Use an IAM User (Not Root)
Never use your AWS Root User for daily development. 
- Log into the console as Root.
- Create an IAM User (e.g., `portfolio-dev`) with `AdministratorAccess` (or restricted permissions for production).
- Generate **Access Keys** (Access Key ID and Secret Access Key) for this user.

### 2. Configure the CLI
Run the following command and paste your credentials when prompted:
```bash
aws configure --profile portfolio-dev
```

### 3. Set the Active Profile
Tell your terminal to use the new profile for subsequent commands:
- **Windows (PowerShell)**: `$env:AWS_PROFILE="portfolio-dev"`
- **Mac/Linux**: `export AWS_PROFILE=portfolio-dev`

Verify your identity:
```bash
aws sts get-caller-identity
```

## Initial Deployment

Before the first deployment, you must "Bootstrap" your environment:
```bash
npx cdk bootstrap
```

Then, deploy the stack:
```bash
npx cdk deploy
```

## Useful commands

* `npm run build`   type-check the project
* `npx cdk synth`   emits the synthesized CloudFormation template
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk destroy` tear down all AWS resources and avoid costs
