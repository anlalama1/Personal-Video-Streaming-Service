package com.portfolio.videostreaming.ui

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.portfolio.videostreaming.R
import com.portfolio.videostreaming.core.data.network.CompleteUploadRequest
import com.portfolio.videostreaming.core.data.network.CompletedPartDto
import com.portfolio.videostreaming.core.data.network.IngestRequest
import com.portfolio.videostreaming.core.data.network.PartUrlRequest
import com.portfolio.videostreaming.core.data.network.StartUploadRequest
import com.portfolio.videostreaming.core.data.network.StreamingApi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.Calendar

class S3UploadWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
    private val httpClient = OkHttpClient()

    override suspend fun doWork(): Result {
        val uriStrings = inputData.getStringArray(KEY_VIDEO_URIS)
        if (uriStrings.isNullOrEmpty()) {
            return Result.failure(workDataOf(KEY_ERROR to "No videos were selected."))
        }

        return try {
            createNotificationChannel()
            setForeground(foregroundInfo(1, uriStrings.size, 0, false))

            uriStrings.forEachIndexed { fileIndex, uriString ->
                setProgress(
                    workDataOf(
                        KEY_CURRENT_FILE to fileIndex + 1,
                        KEY_TOTAL_FILES to uriStrings.size,
                        KEY_PROGRESS to 0
                    )
                )
                setForeground(foregroundInfo(fileIndex + 1, uriStrings.size, 0, false))
                uploadVideo(Uri.parse(uriString), fileIndex, uriStrings.size)
            }
            Result.success()
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            Log.e(TAG, "Background video upload failed", exception)
            Result.failure(
                workDataOf(KEY_ERROR to (exception.localizedMessage ?: "Upload failed."))
            )
        }
    }

    private suspend fun uploadVideo(uri: Uri, fileIndex: Int, totalFiles: Int) {
        val videoSize = getVideoSize(uri)
        require(videoSize > 0L) { "Unable to determine the selected video's size." }
        val totalParts = ((videoSize + CHUNK_SIZE - 1) / CHUNK_SIZE).toInt()
        val fileName = "mobile_memory_${System.currentTimeMillis()}_${fileIndex + 1}.mp4"
        val year = Calendar.getInstance().get(Calendar.YEAR).toString()
        val ingestResponse = StreamingApi.service.ingestMedia(
            IngestRequest(
                title = "Family Memory $year",
                genre = "Miscellaneous",
                releaseYear = year,
                familyId = inputData.getString(KEY_FAMILY_ID),
                videoFileName = fileName,
                videoId = fileName.removeSuffix(".mp4"),
                useAi = inputData.getBoolean(KEY_USE_AI, false),
                status = "UPLOADING"
            )
        )
        val s3Key = ingestResponse.videoKey
        val uploadId = StreamingApi.service.startUpload(
            StartUploadRequest(key = s3Key, contentType = "video/mp4")
        ).uploadId
        val completedParts = mutableListOf<CompletedPartDto>()

        applicationContext.contentResolver.openInputStream(uri)?.use { inputStream ->
            val buffer = ByteArray(CHUNK_SIZE)
            var partNumber = 1
            var uploadedBytes = 0L
            while (uploadedBytes < videoSize) {
                val expectedBytes = minOf(CHUNK_SIZE.toLong(), videoSize - uploadedBytes).toInt()
                readFully(inputStream, buffer, expectedBytes)
                val partData = if (expectedBytes == CHUNK_SIZE) buffer else buffer.copyOf(expectedBytes)
                val partUrl = StreamingApi.service.getPartUrl(
                    PartUrlRequest(
                        key = s3Key,
                        uploadId = uploadId,
                        partNumber = partNumber,
                        totalParts = totalParts
                    )
                ).uploadUrl

                val response = withContext(Dispatchers.IO) {
                    httpClient.newCall(
                        Request.Builder()
                            .url(partUrl)
                            .put(partData.toRequestBody("video/mp4".toMediaType()))
                            .build()
                    ).execute()
                }
                response.use {
                    if (!it.isSuccessful) {
                        throw IOException("S3 upload failed with HTTP ${it.code}.")
                    }
                    val etag = it.header("ETag") ?: it.header("etag")
                        ?: throw IOException("S3 did not return an ETag for part $partNumber.")
                    val cleanEtag = if (etag.startsWith("\"")) etag else "\"$etag\""
                    completedParts.add(CompletedPartDto(ETag = cleanEtag, PartNumber = partNumber))
                }

                uploadedBytes += expectedBytes
                val progress = (uploadedBytes * 100 / videoSize).toInt()
                val currentFile = fileIndex + 1
                setProgress(
                    workDataOf(
                        KEY_CURRENT_FILE to currentFile,
                        KEY_TOTAL_FILES to totalFiles,
                        KEY_PROGRESS to progress
                    )
                )
                setForeground(foregroundInfo(currentFile, totalFiles, progress, true))
                partNumber++
            }
        } ?: throw IOException("Unable to open the selected video.")

        StreamingApi.service.completeUpload(
            CompleteUploadRequest(key = s3Key, uploadId = uploadId, parts = completedParts)
        )
        Log.d(TAG, "Successfully uploaded $fileName to s3://$s3Key")
    }

    private fun getVideoSize(uri: Uri): Long {
        applicationContext.contentResolver.query(
            uri,
            arrayOf(OpenableColumns.SIZE),
            null,
            null,
            null
        )?.use { cursor ->
            val sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst() && sizeColumn >= 0 && !cursor.isNull(sizeColumn)) {
                return cursor.getLong(sizeColumn)
            }
        }
        return applicationContext.contentResolver.openAssetFileDescriptor(uri, "r")?.use {
            it.length
        } ?: -1L
    }

    private fun readFully(input: java.io.InputStream, buffer: ByteArray, length: Int) {
        var offset = 0
        while (offset < length) {
            val count = input.read(buffer, offset, length - offset)
            if (count < 0) {
                throw IOException("The selected video ended before its reported size.")
            }
            offset += count
        }
    }

    private fun foregroundInfo(
        currentFile: Int,
        totalFiles: Int,
        progress: Int,
        showProgress: Boolean
    ): ForegroundInfo {
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_upload)
            .setContentTitle("Uploading family memories")
            .setContentText("Uploading Family Memory $currentFile/$totalFiles ($progress%)...")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(100, progress, !showProgress)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .build()
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = applicationContext.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Background uploads",
                    NotificationManager.IMPORTANCE_LOW
                )
            )
        }
    }

    companion object {
        const val WORK_TAG = "s3_video_upload"
        const val UNIQUE_WORK_NAME = "s3_video_upload_batch"
        const val KEY_VIDEO_URIS = "video_uris"
        const val KEY_FAMILY_ID = "family_id"
        const val KEY_USE_AI = "use_ai"
        const val KEY_CURRENT_FILE = "current_file"
        const val KEY_TOTAL_FILES = "total_files"
        const val KEY_PROGRESS = "progress"
        const val KEY_ERROR = "error"

        private const val TAG = "S3UploadWorker"
        private const val CHANNEL_ID = "background_uploads"
        private const val NOTIFICATION_ID = 3901
        private const val CHUNK_SIZE = 10 * 1024 * 1024
    }
}
