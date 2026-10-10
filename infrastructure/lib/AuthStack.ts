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
        emailSubject: 'Your Demetrius Shop Operator Verification Code (Expires in 15 mins)',
        emailBody: '<html><body><p>Welcome to Demetrius Preservation Portal!</p><p>Your operator verification code is:</p><p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">{####}</p><p>This code expires in <strong>15 minutes</strong>. Enter this code to activate your shop operator credentials.</p></body></html>',
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
        'isAdmin': new cognito.StringAttribute({ mutable: true }),
        'isApproved': new cognito.StringAttribute({ mutable: true }),
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
        emailSubject: 'Your Alexandria+ Vault Verification Code (Expires in 15 mins)',
        emailBody: '<html><body><p>Welcome to Alexandria+ Family Vault!</p><p>Your verification code is:</p><p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #D4AF37;">{####}</p><p>This code expires in <strong>15 minutes</strong>. Enter this code to activate your family heritage vault.</p></body></html>',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add Cognito Hosted UI Domain for OAuth 2.0 Identity Federation
    this.customerUserPool.addDomain('CustomerCognitoDomain', {
      cognitoDomain: {
        domainPrefix: `alexandria-vault-${Config.account.slice(-6)}`,
      },
    });
    new cdk.CfnOutput(this, 'CustomerHostedUIDomain', {
      value: `alexandria-vault-${Config.account.slice(-6)}.auth.${Config.region}.amazoncognito.com`,
    });

    const googleOAuthSecretName = 'alexandria/google-oauth';
    const googleClientId = cdk.SecretValue.secretsManager(googleOAuthSecretName, {
      jsonField: 'client_id',
    }).unsafeUnwrap();
    const googleClientSecret = cdk.SecretValue.secretsManager(googleOAuthSecretName, {
      jsonField: 'client_secret',
    });
    const customerGoogleIdentityProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'CustomerGoogleIdentityProvider', {
      userPool: this.customerUserPool,
      clientId: googleClientId,
      clientSecretValue: googleClientSecret,
      scopes: ['openid', 'email', 'profile'],
    });

    this.customerWebClient = this.customerUserPool.addClient('CustomerWebClient', {
      userPoolClientName: 'Alexandria-Scroll-Viewer-Client',
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes('familyId', 'isAdmin', 'isApproved'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes('familyId'),
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: ['https://www.alexandria-plus.com/', 'http://localhost:5173/'],
        logoutUrls: ['https://www.alexandria-plus.com/', 'http://localhost:5173/'],
      },
    });
    this.customerWebClient.node.addDependency(customerGoogleIdentityProvider);

    this.customerAndroidClient = this.customerUserPool.addClient('CustomerAndroidClient', {
      userPoolClientName: 'Alexandria-Android-Client',
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes('familyId', 'isAdmin', 'isApproved'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes('familyId'),
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: ['myapp://callback'],
        logoutUrls: ['myapp://logout'],
      },
    });
    this.customerAndroidClient.node.addDependency(customerGoogleIdentityProvider);

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
