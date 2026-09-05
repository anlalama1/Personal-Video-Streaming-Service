const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

const s3 = new S3Client({});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const SOURCE_BUCKET = process.env.SOURCE_BUCKET;
const DEST_BUCKET = process.env.DEST_BUCKET;
const TABLE_NAME = process.env.TABLE_NAME;
const INPUT_KEY = process.env.INPUT_KEY;

async function run() {
    console.log(`Starting Transcode for: ${INPUT_KEY}`);

    const videoId = path.basename(INPUT_KEY, path.extname(INPUT_KEY));
    const localInput = `/tmp/${INPUT_KEY}`;
    const outputDir = `/tmp/${videoId}_hls`;

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    ['stream_0', 'stream_1', 'stream_2'].forEach(dir => {
        const p = path.join(outputDir, dir);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    });

    try {
        console.log("Downloading source from S3...");
        const response = await s3.send(new GetObjectCommand({
            Bucket: SOURCE_BUCKET,
            Key: INPUT_KEY
        }));
        await pipeline(response.Body, fs.createWriteStream(localInput));

        console.log("Running FFmpeg...");

        /**
         * Lead Strategy: Correct Filtergraph Chaining.
         * The labels [v1], [v2], [v3] must be explicitly wrapped in brackets
         * when being passed as inputs to the scale filters.
         */
        const filter = "[0:v]split=3[v1][v2][v3];[v1]scale=w=1920:h=1080[v1out];[v2]scale=w=1280:h=720[v2out];[v3]scale=w=854:h=480[v3out]";

        const ffmpegCmd = [
            'ffmpeg',
            '-i', localInput,
            '-filter_complex', `'${filter}'`,
            '-map', '[v1out]', '-c:v:0', 'libx264', '-preset', 'veryfast', '-b:v:0', '5000k', '-maxrate:v:0', '5350k', '-bufsize:v:0', '7500k',
            '-map', '[v2out]', '-c:v:1', 'libx264', '-preset', 'veryfast', '-b:v:1', '2800k', '-maxrate:v:1', '2996k', '-bufsize:v:1', '4200k',
            '-map', '[v3out]', '-c:v:2', 'libx264', '-preset', 'veryfast', '-b:v:2', '1400k', '-maxrate:v:2', '1498k', '-bufsize:v:2', '2100k',
            '-map', 'a:0', '-c:a', 'aac', '-b:a:0', '192k',
            '-map', 'a:0', '-c:a', 'aac', '-b:a:1', '128k',
            '-map', 'a:0', '-c:a', 'aac', '-b:a:2', '96k',
            '-f', 'hls',
            '-hls_time', '6',
            '-hls_playlist_type', 'vod',
            '-hls_flags', 'independent_segments',
            '-hls_segment_type', 'mpegts',
            '-hls_segment_filename', `${outputDir}/stream_%v/data%03d.ts`,
            '-master_pl_name', 'master.m3u8',
            '-var_stream_map', '"v:0,a:0 v:1,a:1 v:2,a:2"',
            `${outputDir}/stream_%v/playlist.m3u8`
        ].join(' ');

        console.log(`Executing: ${ffmpegCmd}`);
        execSync(ffmpegCmd, { stdio: 'inherit' });

        console.log("Uploading HLS artifacts to S3...");
        await uploadFolder(outputDir, `${videoId}_hls`);

        console.log("Updating DynamoDB...");
        const hlsKey = `${videoId}_hls`;

        await db.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { videoId: videoId },
            UpdateExpression: "set hlsKey = :h", // Store directory path instead of boolean
            ExpressionAttributeValues: {
                ":h": hlsKey
            }
        }));

        console.log("Transcode pipeline completed successfully!");
    } catch (err) {
        console.error("Transcode failed:", err);
        process.exit(1);
    }
}

async function uploadFolder(localPath, s3Prefix) {
    const files = getFiles(localPath);
    for (const file of files) {
        const relativePath = path.relative(localPath, file);
        const s3Key = `${s3Prefix}/${relativePath.replace(/\\/g, '/')}`;
        const body = fs.readFileSync(file);

        await s3.send(new PutObjectCommand({
            Bucket: DEST_BUCKET,
            Key: s3Key,
            Body: body,
            ContentType: getContentType(file)
        }));
    }
}

function getFiles(dir) {
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    });
    return Array.prototype.concat(...files);
}

function getContentType(file) {
    if (file.endsWith(".m3u8")) return "application/x-mpegURL";
    if (file.endsWith(".ts")) return "video/MP2T";
    return "application/octet-stream";
}

run();
