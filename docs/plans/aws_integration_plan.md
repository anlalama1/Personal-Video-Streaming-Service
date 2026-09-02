# AWS Integration (S3 & DynamoDB) Implementation Plan

This plan outlines the transition from local media discovery to a professional, cloud-based streaming architecture using **Amazon Web Services (AWS)**.

## Architecture: The "Cloud Native" Pipeline

### Intermediate vs. Senior/Lead Approach
| Component | Intermediate Developer | Senior/Lead Developer |
| :--- | :--- | :--- |
| **Security** | Embeds AWS Access Keys directly in the app code (Major Security Risk). | Uses **Amazon Cognito** for temporary credentials or a **Lambda Proxy** (API Gateway) to hide secrets. |
| **Networking** | Uses raw `URLConnection` or simple `String` parsing. | Implements **Retrofit + Moshi/Kotlin Serialization** for type-safe, reactive API consumption. |
| **Image Loading** | Manually downloads bytes and converts to Bitmap. | Uses an optimized library like **Coil**, which handles memory caching, disk caching, and downsampling. |
| **Streaming** | Plays raw S3 URLs. | Serves content via **CloudFront** with **Signed Cookies/URLs** for low-latency distribution and access control. |

## Proposed Strategy: Three-Phase Migration

### Phase 1: Networking & Metadata (The API)
We will transition the "Catalog" from scanning the phone to calling an API.
- **Backend**: Set up a Lambda function that queries DynamoDB and returns a JSON list of movies.
- **Android**: Integrate **Retrofit** to fetch this JSON and map it to our `MediaFile` objects.

### Phase 2: Visuals (Thumbnails)
- **Backend**: Store JPG thumbnails in S3.
- **Android**: Integrate **Coil** to display these remote images in the `CatalogScreen`.

### Phase 3: The Stream (Video)
- **Backend**: Move MP4/HLS files to S3/CloudFront.
- **Android**: Update `VideoPlayerViewModel` to play remote HTTPS streams instead of `content://` URIs.

## Proposed Changes (Immediate Next Step)

### 1. Networking Infrastructure
#### [MODIFY] [build.gradle.kts](file:///I:/Android%20Projects/app/build.gradle.kts)
- Add **Retrofit** (API communication).
- Add **Kotlin Serialization** (JSON parsing).
- Add **Coil** (Image loading).

### 2. Data Contract
#### [MODIFY] [MediaBrowserViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/MediaBrowserViewModel.kt)
- Redefine `MediaFile` to include: `title`, `genre`, `releaseDate`, `thumbnailUrl`, and `videoUrl`.

### 3. Service Layer
#### [NEW] [StreamingApiService.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/data/network/StreamingApiService.kt)
- Define the interface for fetching the catalog from your AWS API Gateway.

## Verification Plan
1. **Mock Test**: Initially point to a mock JSON file on GitHub or S3 to verify the networking stack.
2. **End-to-End**: Connect to your live AWS API Gateway and verify the list loads from DynamoDB.
