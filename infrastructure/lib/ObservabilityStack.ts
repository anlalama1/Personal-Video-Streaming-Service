import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';

interface ObservabilityStackProps extends cdk.StackProps {
  logGroup: logs.ILogGroup;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(this, 'StreamingServiceDashboard', {
      dashboardName: 'StreamingService-Modular-Overview',
    });

    dashboard.addWidgets(new cloudwatch.GraphWidget({
      title: 'Catalog Requests',
      left: [new cloudwatch.Metric({
        namespace: 'StreamingService',
        metricName: 'CatalogRequestCount',
        dimensionsMap: { Service: 'CatalogService' },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      })],
      width: 12
    }));

    dashboard.addWidgets(new cloudwatch.GraphWidget({
      title: 'Video Playback Activity',
      left: [new cloudwatch.Metric({
        namespace: 'StreamingService',
        metricName: 'VideoPlayCount',
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      })],
      width: 12
    }));

    dashboard.addWidgets(new cloudwatch.LogQueryWidget({
      title: 'Top 10 Most Played Videos',
      logGroupNames: [props.logGroup.logGroupName],
      queryString: `
        fields @timestamp, VideoPlayCount, Title
        | filter ispresent(VideoPlayCount)
        | stats sum(VideoPlayCount) as Plays by Title
        | sort Plays desc
        | limit 10
      `,
      width: 24,
      height: 6
    }));

    dashboard.addWidgets(new cloudwatch.GraphWidget({
      title: 'API Errors',
      left: [new cloudwatch.Metric({
        namespace: 'StreamingService',
        metricName: 'ApiErrorCount',
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
        color: '#d62728'
      })],
      width: 12
    }));

    // Lead Strategy: Monitor Fatal Pipeline Failures
    const fatalMetric = new cloudwatch.Metric({
      namespace: 'StreamingService',
      metricName: 'FatalTranscodeFailure',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
      color: '#000000'
    });

    dashboard.addWidgets(new cloudwatch.GraphWidget({
      title: 'Fatal Transcode Failures',
      left: [fatalMetric],
      width: 12
    }));

    new cloudwatch.Alarm(this, 'FatalTranscodeAlarm', {
      metric: fatalMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'A video has failed transcoding 3 times and is marked as FATAL.',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Lead Strategy: Library Health Overview
    // Shows the total count of videos broken down by their pipeline state.
    dashboard.addWidgets(new cloudwatch.GraphWidget({
      title: 'Library Transcoding Status',
      left: [
        new cloudwatch.Metric({ namespace: 'StreamingService', metricName: 'VideoCountByStatus', dimensionsMap: { Status: 'TOTAL' }, label: 'Total Library' }),
        new cloudwatch.Metric({ namespace: 'StreamingService', metricName: 'VideoCountByStatus', dimensionsMap: { Status: 'COMPLETED' }, label: 'HLS Ready' }),
        new cloudwatch.Metric({ namespace: 'StreamingService', metricName: 'VideoCountByStatus', dimensionsMap: { Status: 'TRANSCODING' }, label: 'In Progress' }),
        new cloudwatch.Metric({ namespace: 'StreamingService', metricName: 'VideoCountByStatus', dimensionsMap: { Status: 'FAILED' }, label: 'Failed' }),
        new cloudwatch.Metric({ namespace: 'StreamingService', metricName: 'VideoCountByStatus', dimensionsMap: { Status: 'FATAL' }, label: 'Fatal (Alert!)' }),
      ],
      width: 24,
      height: 6
    }));
  }
}
