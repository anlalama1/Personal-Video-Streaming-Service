import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3_assets from 'aws-cdk-lib/aws-s3-assets';
import * as path from 'path';

/**
 * Senior Strategy: Separation of Concerns.
 * This stack is responsible ONLY for building the container image.
 * It does not know HOW the image is used; it only knows how to build it.
 */
export class ImageBuilderStack extends cdk.Stack {
  public readonly repository: ecr.IRepository;
  public readonly buildProjectName: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Private repository to store the FFmpeg image
    this.repository = new ecr.Repository(this, 'TranscoderRepo', {
      repositoryName: 'media-transcoder',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true
    });

    // 2. Package the local Docker source code
    const transcoderAsset = new s3_assets.Asset(this, 'TranscoderAsset', {
      path: path.join(__dirname, '../transcoder'),
    });

    // 3. The Cloud Builder
    const buildProject = new codebuild.Project(this, 'TranscoderBuild', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
        privileged: true,
      },
      source: codebuild.Source.s3({
        bucket: transcoderAsset.bucket,
        path: transcoderAsset.s3ObjectKey,
      }),
      environmentVariables: {
        REPOSITORY_URI: { value: this.repository.repositoryUri },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI'
            ]
          },
          build: {
            commands: [
              'echo Building the Docker image...',
              'docker build -t $REPOSITORY_URI:latest .',
            ]
          },
          post_build: {
            commands: [
              'echo Pushing the image to ECR...',
              'docker push $REPOSITORY_URI:latest'
            ]
          }
        }
      })
    });

    this.repository.grantPush(buildProject);
    this.buildProjectName = buildProject.projectName;

    new cdk.CfnOutput(this, 'BuildProjectName', { value: this.buildProjectName });
  }
}
