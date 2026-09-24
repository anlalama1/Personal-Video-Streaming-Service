/**
 * ============================================================================
 * Authentication Infrastructure Stack (AWS Cognito & Amazon SES Identity)
 * ============================================================================
 * Architecture Pattern: Identity Provider (IdP) & Multi-Tenant Identity Store.
 *
 * Enterprise Decision Rationale:
 * 1. Custom User Attributes: 'custom:familyId' is embedded in JWT ID tokens,
 *    enabling cryptographically verifiable data isolation at the API boundary.
 * 2. Dedicated Client Applications: Separate App Clients for Web vs Mobile
 *    allow platform-specific auth flow configuration and OAuth scope tuning.
 * 3. Amazon SES Integration: Routes transactional emails (verification codes)
 *    through verified custom domains rather than default Cognito shared quotas.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Config } from '../bin/config';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly webClient: cognito.UserPoolClient;
  public readonly androidClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. The User Pool - The Central Vault of User Identities
    this.userPool = new cognito.UserPool(this, 'AlexandriaUserPool', {
      userPoolName: 'Alexandria-User-Vault',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      // Custom Attributes for Multi-Tenant Vault Isolation
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
      // Remember Device support for frictionless repeated logins
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: false,
      },
      // Amazon SES Configuration for Custom Email Identity (no-reply@alexandria-plus.com)
      email: cognito.UserPoolEmail.withSES({
        fromEmail: Config.fromEmail,
        fromName: 'Alexandria+ Vault',
        sesVerifiedDomain: Config.domainName,
      }),
      // Custom Verification Email Branding
      userVerification: {
        emailSubject: 'Your Alexandria+ Vault Verification Code',
        emailBody: 'Welcome to Alexandria+ Preservation Vault!\n\nYour verification code is: {####}\n\nEnter this code to activate your family heritage vault.',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Dev spike setting; change to RETAIN for production
    });

    // 2. Web App Client (Serves Demetrius & The Scroll Web Viewers)
    this.webClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'Alexandria-Web-Client',
      authFlows: {
        userPassword: true,
        userSrp: true, // Secure Remote Password protocol enabled
      },
    });

    // 3. Native Android App Client
    this.androidClient = this.userPool.addClient('AndroidClient', {
      userPoolClientName: 'Alexandria-Android-Client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // Stack CloudFormation Outputs for cross-stack referencing
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'WebClientId', { value: this.webClient.userPoolClientId });
    new cdk.CfnOutput(this, 'AndroidClientId', { value: this.androidClient.userPoolClientId });
  }
}
