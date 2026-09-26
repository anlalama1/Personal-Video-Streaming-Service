/**
 * ============================================================================
 * Decoupled Authentication Infrastructure Stack (Shop Admin vs. Customer Pools)
 * ============================================================================
 * Architecture Pattern: Completely Decoupled Multi-User Pool Identity Store.
 *
 * Enterprise Decision Rationale:
 * 1. Blast Radius & Privilege Isolation: Shop Operators (Demetrius) and End-User
 *    Customers (The Scroll / Android App) reside in completely separate Cognito User Pools.
 *    Registered customers cannot authenticate to Demetrius, and shop operators cannot
 *    authenticate to the customer catalog.
 * 2. Scoped Custom Attributes: 'custom:role' and 'custom:tenantId' are defined for Shop
 *    Admins, while 'custom:familyId' is enforced for Customer Vault Members.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Config } from '../bin/config';

export class AuthStack extends cdk.Stack {
  // Shop Operator Identity Store
  public readonly adminUserPool: cognito.UserPool;
  public readonly adminWebClient: cognito.UserPoolClient;

  // End-User Customer Identity Store
  public readonly customerUserPool: cognito.UserPool;
  public readonly customerWebClient: cognito.UserPoolClient;
  public readonly customerAndroidClient: cognito.UserPoolClient;

  // Backwards-compatible alias for customer pool
  public readonly userPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =========================================================================
    // 1. Demetrius Shop Operator User Pool (Alexandria-ShopAdmin-Vault)
    // =========================================================================
    this.adminUserPool = new cognito.UserPool(this, 'AlexandriaAdminUserPool', {
      userPoolName: 'Alexandria-ShopAdmin-Vault',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      // Custom Attributes for Shop Operator Role & Dynamic Tenant Isolation
      customAttributes: {
        'role': new cognito.StringAttribute({ mutable: true }),
        'tenantId': new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: false,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      email: cognito.UserPoolEmail.withSES({
        fromEmail: Config.fromEmail,
        fromName: 'Alexandria+ Operator Portal',
        sesVerifiedDomain: Config.domainName,
      }),
      userVerification: {
        emailSubject: 'Your Demetrius Shop Operator Verification Code',
        emailBody: 'Welcome to Demetrius Preservation Portal!\n\nYour operator verification code is: {####}\n\nEnter this code to activate your shop operator credentials.',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.adminWebClient = this.adminUserPool.addClient('AdminWebClient', {
      userPoolClientName: 'Alexandria-Demetrius-Admin-Client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // =========================================================================
    // 2. Customer Family Member User Pool (Alexandria-Customer-Vault)
    // =========================================================================
    this.customerUserPool = new cognito.UserPool(this, 'AlexandriaCustomerUserPool', {
      userPoolName: 'Alexandria-Customer-Vault',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      // Mandatory Family Vault Code attribute for customer isolation
      customAttributes: {
        'familyId': new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: false,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      email: cognito.UserPoolEmail.withSES({
        fromEmail: Config.fromEmail,
        fromName: 'Alexandria+ Vault',
        sesVerifiedDomain: Config.domainName,
      }),
      userVerification: {
        emailSubject: 'Your Alexandria+ Vault Verification Code',
        emailBody: 'Welcome to Alexandria+ Family Vault!\n\nYour verification code is: {####}\n\nEnter this code to activate your family heritage vault.',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.customerWebClient = this.customerUserPool.addClient('CustomerWebClient', {
      userPoolClientName: 'Alexandria-Scroll-Viewer-Client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    this.customerAndroidClient = this.customerUserPool.addClient('CustomerAndroidClient', {
      userPoolClientName: 'Alexandria-Android-Client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // Alias customer pool for backwards compatibility
    this.userPool = this.customerUserPool;

    // Stack CloudFormation Outputs
    new cdk.CfnOutput(this, 'AdminUserPoolId', { value: this.adminUserPool.userPoolId });
    new cdk.CfnOutput(this, 'AdminWebClientId', { value: this.adminWebClient.userPoolClientId });

    new cdk.CfnOutput(this, 'CustomerUserPoolId', { value: this.customerUserPool.userPoolId });
    new cdk.CfnOutput(this, 'CustomerWebClientId', { value: this.customerWebClient.userPoolClientId });
    new cdk.CfnOutput(this, 'CustomerAndroidClientId', { value: this.customerAndroidClient.userPoolClientId });

    // Legacy outputs for backwards compatibility
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.customerUserPool.userPoolId });
    new cdk.CfnOutput(this, 'WebClientId', { value: this.customerWebClient.userPoolClientId });
    new cdk.CfnOutput(this, 'AndroidClientId', { value: this.customerAndroidClient.userPoolClientId });
  }
}
