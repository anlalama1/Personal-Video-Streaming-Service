const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    console.log("Fetching catalog from DynamoDB...");

    const tableName = process.env.TABLE_NAME;
    const cdnDomain = process.env.CLOUDFRONT_DOMAIN;

    try {
        const command = new ScanCommand({ TableName: tableName });
        const response = await docClient.send(command);
        const items = response.Items || [];

        /**
         * SDE Strategy: URL Transformation
         * In a production BFF (Backend-for-Frontend), we translate internal storage paths
         * or raw S3 URLs into public CDN URLs. This shields the client from our
         * infrastructure details and allows us to swap buckets/providers without app updates.
         */
        const mapToCdn = (item) => {
            return {
                ...item,
                // Extract the filename (key) from the stored S3 URL and prepend the CDN domain
                thumbnailUrl: transformUrl(item.thumbnailUrl, cdnDomain, "thumbnails"),
                videoUrl: transformUrl(item.videoUrl, cdnDomain)
            };
        };

        if (items.length === 0) {
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify([
                    {
                        videoId: "mock-1",
                        title: "Fortress Deployment Successful",
                        genre: "Security",
                        releaseYear: "2026",
                        thumbnailUrl: "https://via.placeholder.com/150",
                        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    }
                ]),
            };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(items.map(mapToCdn)),
        };
    } catch (error) {
        console.error("Error scanning DynamoDB:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
        };
    }
};

/**
 * Helper to extract the key from an S3 URL and rebuild it for CloudFront.
 * Logic: https://bucket.s3.region.amazonaws.com/folder/file.mp4 -> https://cdn.com/folder/file.mp4
 */
function transformUrl(rawUrl, cdnDomain, prefix = "") {
    if (!rawUrl || !rawUrl.includes("amazonaws.com")) return rawUrl;

    try {
        const url = new URL(rawUrl);
        // Pathname includes the leading slash, e.g., "/image.jpg"
        const key = url.pathname;

        // If a prefix is provided, prepend it to the path (e.g., "/thumbnails/image.jpg")
        const path = prefix ? `/${prefix}${key}` : key;

        return `https://${cdnDomain}${path}`;
    } catch (e) {
        return rawUrl;
    }
}
