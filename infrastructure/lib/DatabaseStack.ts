/**
 * ============================================================================
 * Database Infrastructure Stack (DynamoDB Single-Table Design)
 * ============================================================================
 * Architecture Pattern: NoSQL Single-Table Design (Alex DeBrie Pattern).
 *
 * Enterprise Decision Rationale:
 * Instead of creating separate database tables for Videos, Tenants, Play Events,
 * and Users, a single DynamoDB table with generic Partition Keys (PK) and Sort Keys (SK)
 * accommodates all access patterns in a single, ultra-low latency (<10ms) table.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DatabaseStack extends cdk.Stack {
  public readonly table: dynamodb.ITable;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Generic Single-Table DynamoDB Table
    const table = new dynamodb.Table(this, 'VideoMetadataTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Dev spike setting; change to RETAIN for production
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-Demand capacity scaling
    });
    this.table = table;

    table.addGlobalSecondaryIndex({
      indexName: 'FamilyCatalogIndex',
      partitionKey: { name: 'familyId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
