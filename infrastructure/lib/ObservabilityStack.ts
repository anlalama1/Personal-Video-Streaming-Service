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
      width: 24
    }));
  }
}
