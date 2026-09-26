/**
 * ============================================================================
 * System Governance Infrastructure Stack ("Nuclear Option" Reset Utility)
 * ============================================================================
 * Architecture Pattern: Isolated Administrative Utility & Least-Privilege IAM.
 *
 * Enterprise Decision Rationale:
 * High-risk administrative utilities with destructive authority must be isolated
 * into dedicated infrastructure stacks without public API Gateway integrations.
 * This prevents accidental exposure via CORS or compromised admin web tokens while
 * enforcing explicit IAM grants across S3, DynamoDB, and both Cognito User Pools.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

interface SystemGovernanceStackProps extends cdk.StackProps {
  sourceBucket: s3.IBucket;
  thumbnailBucket: s3.IBucket;
  hlsBucket: s3.IBucket;
  metadataTable: dynamodb.ITable;
  adminUserPool: cognito.IUserPool;
  customerUserPool: cognito.IUserPool;
}

export class SystemGovernanceStack extends cdk.Stack {
  public readonly nuclearResetLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: SystemGovernanceStackProps) {
    super(scope, id, props);

    // 1. Isolated "Nuclear Option" System Factory Reset Lambda
    this.nuclearResetLambda = new lambda.Function(this, 'NuclearResetFunction', {
      functionName: 'StreamingService-NuclearResetFunction',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'nuclearReset.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      timeout: cdk.Duration.minutes(15), // Extended 15-minute timeout for multi-resource purges
      environment: {
        SOURCE_BUCKET: props.sourceBucket.bucketName,
        THUMBNAIL_BUCKET: props.thumbnailBucket.bucketName,
        DEST_BUCKET: props.hlsBucket.bucketName,
        TABLE_NAME: props.metadataTable.tableName,
        ADMIN_USER_POOL_ID: props.adminUserPool.userPoolId,
        CUSTOMER_USER_POOL_ID: props.customerUserPool.userPoolId,
        USER_POOL_ID: props.customerUserPool.userPoolId, // Fallback key
      },
    });

    // 2. Strict Scoped IAM Execution Permissions
    // S3 Purge Permissions
    props.sourceBucket.grantReadWrite(this.nuclearResetLambda);
    props.thumbnailBucket.grantReadWrite(this.nuclearResetLambda);
    props.hlsBucket.grantReadWrite(this.nuclearResetLambda);

    // DynamoDB Table Scan & Delete Permissions
    props.metadataTable.grantReadWriteData(this.nuclearResetLambda);

    // Cognito Dual User Pool List & Admin Delete Permissions
    this.nuclearResetLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:ListUsers',
        'cognito-idp:AdminDeleteUser',
      ],
      resources: [
        props.adminUserPool.userPoolArn,
        props.customerUserPool.userPoolArn,
      ],
    }));

    new cdk.CfnOutput(this, 'NuclearResetFunctionName', {
      value: this.nuclearResetLambda.functionName,
      description: 'Manual System Factory Reset Lambda Function Name'
    });
  }
}
