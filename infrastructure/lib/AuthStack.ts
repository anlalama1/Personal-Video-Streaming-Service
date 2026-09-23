import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly webClient: cognito.UserPoolClient;
  public readonly androidClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. The User Pool - The "Vault" of Identities
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
      // Principal Strategy: Custom Attributes for Tenancy
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
      // Requirement 1: Remember Device support
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: false, // Automatically remember if user chooses
      },
      // Customizing Verification Email branding
      userVerification: {
        emailSubject: 'Your Alexandria+ Vault Verification Code',
        emailBody: 'Welcome to Alexandria+ Preservation Vault!\n\nYour verification code is: {####}\n\nEnter this code to activate your family heritage vault.',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      /*
       * To send from 'no-reply@alexandriaplus.com' via Amazon SES:
       * 1. Verify 'alexandriaplus.com' in Amazon SES console or Route53
       * 2. Uncomment the email config below:
       *
       * email: cognito.UserPoolEmail.withSES({
       *   fromEmail: 'no-reply@alexandriaplus.com',
       *   fromName: 'Alexandria+ Vault',
       *   sesVerifiedDomain: 'alexandriaplus.com',
       * }),
       */
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For spike - change to RETAIN for prod
    });

    // 2. Web Client (The Scroll & Demetrius)
    this.webClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'Alexandria-Web-Client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // 3. Android Client
    this.androidClient = this.userPool.addClient('AndroidClient', {
      userPoolClientName: 'Alexandria-Android-Client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // Requirement 4 Placeholder: Google Identity Provider
    // Note: Fully enabling this requires a ClientSecret from Google Console.
    // We can add this via:
    // new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdP', { ... });

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'WebClientId', { value: this.webClient.userPoolClientId });
    new cdk.CfnOutput(this, 'AndroidClientId', { value: this.androidClient.userPoolClientId });
  }
}
