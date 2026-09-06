/**
 * Principal SDE Strategy: Centralized Configuration.
 * These values are specific to the AWS account and GitHub repository.
 * Any new user onboarding to this project must update these values.
 */
export const Config = {
    // The AWS Account ID where resources will be deployed
    account: '575992668616',

    // The AWS Region for deployment
    region: 'us-east-1',

    // The GitHub repository path (Owner/Repo)
    githubRepo: 'anlalama1/Personal-Video-Streaming-Service',

    // The branch that triggers the CI/CD pipeline
    githubBranch: 'main',

    // The ARN of the AWS CodeStar/CodeConnection to GitHub
    // Created manually in the AWS Console (CodePipeline -> Settings -> Connections)
    githubConnectionArn: 'arn:aws:codeconnections:us-east-1:575992668616:connection/5119b184-5098-45b0-bbc0-f56ed91d5f82',

    // The prefix used for various production resources
    projectPrefix: 'StreamingService'
};
