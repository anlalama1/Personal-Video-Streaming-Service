# System Integrity & Release Checklist

Use this checklist after any major architectural shift or CI/CD deployment to ensure the end-to-end streaming service remains "Production-Ready."

## 1. Cloud Infrastructure (CI/CD)
- [ ] **Pipeline Health**: Verify the `StreamingService-Production-Pipeline` in AWS Console shows all stages as **Green**.
- [ ] **Self-Mutation**: If the pipeline logic was changed, verify the `SelfMutate` stage succeeded.
- [ ] **Asset Building**: Verify the `Assets` stage successfully built and pushed the new Docker image to ECR.

## 2. Media Processing Pipeline
- [ ] **Event Trigger**: Upload an MP4 to `Prod-StorageStack-MediaSourceBucket`. Verify SQS receives a message.
- [ ] **Fargate Execution**: Check ECS Console. A task should spin up in the `TranscoderCluster`.
- [ ] **FFmpeg Success**: Check CloudWatch Logs for the task. It should end with `Transcode pipeline completed successfully!`.
- [ ] **S3 Verification**: Verify the `Prod-StorageStack-HlsOutputBucket` contains a new `_hls` folder with `.m3u8` and `.ts` files.
- [ ] **Database Update**: Check the `Prod-DatabaseStack-VideoMetadataTable`. The `videoUrl` for the item should now start with `s3://` and `isHls` should be `true`.

## 3. Backend API (BFF)
- [ ] **URL Transformation**: Call the `Prod-ApiStack` endpoint (GET `/catalog`). Verify that `videoUrl` and `thumbnailUrl` have been transformed from `s3://` or standard S3 links into **CloudFront URLs**.
- [ ] **CORS**: Verify the API response includes `Access-Control-Allow-Origin: *`.
- [ ] **Telemetry**: Call the POST `/play` endpoint. Verify a 200 OK and check CloudWatch Metrics for a `VideoPlayCount` increment.

## 4. Android Application (Client)
- [ ] **Connectivity**: App opens and fetches the "Cloud Library" without showing an error state.
- [ ] **HLS Playback**: Play an HLS-enabled video. Verify it starts quickly and doesn't buffer.
- [ ] **ABR Verification**: (Optional) Use a network throttle to verify the player drops to a lower resolution without stopping.
- [ ] **Rotation Survival**: Rotate the device during playback. The video should **not** restart from the beginning.
- [ ] **MVI State**: Verify the "Buffering" spinner appears if the network is disconnected.
- [ ] **Navigation**: Verify the "Back" button returns the user to the catalog and stops the timer.

## 5. Parental Monitoring
- [ ] **Heartbeat Logic**: Verify "Session" and "Daily" timers only increment while the video is **actively playing**.
- [ ] **Persistence**: Kill the app and restart. The "Daily" timer should retain its previous value.
- [ ] **Day Rollover**: (System Test) Change the device date to tomorrow. The "Daily" timer should reset to 0 upon the first playback.

## 6. Observability
- [ ] **Dashboard**: Open the `StreamingService-Modular-Overview` CloudWatch Dashboard.
- [ ] **Real-time Data**: Verify that recent catalog requests and play events are appearing in the graphs.
- [ ] **Log Query**: Verify the "Top 10" table is correctly listing movie titles.
