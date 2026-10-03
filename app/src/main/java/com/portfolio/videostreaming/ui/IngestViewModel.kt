package com.portfolio.videostreaming.ui

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.portfolio.videostreaming.core.data.network.CompleteUploadRequest
import com.portfolio.videostreaming.core.data.network.CompletedPartDto
import com.portfolio.videostreaming.core.data.network.IngestRequest
import com.portfolio.videostreaming.core.data.network.PartUrlRequest
import com.portfolio.videostreaming.core.data.network.StartUploadRequest
import com.portfolio.videostreaming.core.data.network.StreamingApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.InputStream
import java.util.Calendar

sealed class UploadState {
    object Idle : UploadState()
    data class Uploading(val currentFile: Int, val totalFiles: Int, val progressPercent: Int) : UploadState()
    object Success : UploadState()
    data class Error(val message: String) : UploadState()
}

/**
 * ============================================================================
 * Mobile Ingestion ViewModel (S3 Resumable Chunked Uploader)
 * ============================================================================
 * Enterprise Architecture Strategy: Resumable Multipart Background Upload.
 * Manages 10MB chunked HTTP PUT uploads directly to S3 pre-signed URLs,
 * synchronizing state with Scribe API Gateway and updating reactive UI progress flows.
 */
class IngestViewModel : ViewModel() {
    private val _uploadState = MutableStateFlow<UploadState>(UploadState.Idle)
    val uploadState: StateFlow<UploadState> = _uploadState.asStateFlow()

    private val httpClient = OkHttpClient()

    companion object {
        private const val CHUNK_SIZE = 10 * 1024 * 1024 // 10MB parts
    }

    fun uploadSelectedVideos(context: Context, videoUris: List<Uri>, familyId: String? = null) {
        viewModelScope.launch(Dispatchers.IO) {
            _uploadState.value = UploadState.Uploading(1, videoUris.size, 0)

            videoUris.forEachIndexed { index, uri ->
                try {
                    val fileName = "mobile_memory_${System.currentTimeMillis()}_${index + 1}.mp4"
                    val videoTitle = "Family Memory ${Calendar.getInstance().get(Calendar.YEAR)}"

                    _uploadState.value = UploadState.Uploading(index + 1, videoUris.size, 10)

                    // 1. Ingest metadata lock in DynamoDB via Scribe Lambda
                    val ingestRes = StreamingApi.service.ingestMedia(
                        IngestRequest(
                            title = videoTitle,
                            genre = "Miscellaneous",
                            releaseYear = Calendar.getInstance().get(Calendar.YEAR).toString(),
                            familyId = familyId,
                            videoFileName = fileName,
                            status = "UPLOADING"
                        )
                    )

                    val s3Key = ingestRes.videoKey

                    // 2. Initiate Multipart Upload Handshake
                    val startRes = StreamingApi.service.startUpload(
                        StartUploadRequest(key = s3Key, contentType = "video/mp4")
                    )
                    val uploadId = startRes.uploadId

                    // 3. Read InputStream and Upload 10MB Parts to Pre-Signed S3 URLs
                    val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
                    val totalBytes = inputStream?.available()?.toLong() ?: 0L
                    val totalParts = Math.max(1, Math.ceil(totalBytes.toDouble() / CHUNK_SIZE).toInt())
                    val completedParts = mutableListOf<CompletedPartDto>()

                    var bytesRead = 0
                    val buffer = ByteArray(CHUNK_SIZE)
                    var partNumber = 1

                    while (inputStream != null && inputStream.read(buffer).also { bytesRead = it } != -1) {
                        val partData = if (bytesRead == CHUNK_SIZE) buffer else buffer.copyOf(bytesRead)

                        val partUrlRes = StreamingApi.service.getPartUrl(
                            PartUrlRequest(
                                key = s3Key,
                                uploadId = uploadId,
                                partNumber = partNumber,
                                totalParts = totalParts
                            )
                        )

                        // Upload 10MB byte array directly to S3 Pre-Signed URL
                        val putRequest = Request.Builder()
                            .url(partUrlRes.uploadUrl)
                            .put(partData.toRequestBody("video/mp4".toMediaType()))
                            .build()

                        val putResponse = httpClient.newCall(putRequest).execute()
                        val rawEtag = putResponse.header("ETag") ?: putResponse.header("etag") ?: ""
                        val cleanEtag = if (rawEtag.startsWith("\"")) rawEtag else "\"$rawEtag\""

                        completedParts.add(CompletedPartDto(ETag = cleanEtag, PartNumber = partNumber))

                        val progress = Math.round((partNumber.toDouble() / totalParts) * 100).toInt()
                        _uploadState.value = UploadState.Uploading(index + 1, videoUris.size, progress)

                        partNumber++
                    }

                    inputStream?.close()

                    // 4. Complete Multipart Upload
                    StreamingApi.service.completeUpload(
                        CompleteUploadRequest(key = s3Key, uploadId = uploadId, parts = completedParts)
                    )

                    Log.d("IngestVM", "Successfully uploaded $fileName to s3://$s3Key")

                } catch (e: Exception) {
                    Log.e("IngestVM", "Upload failed for item $index", e)
                    _uploadState.value = UploadState.Error(e.localizedMessage ?: "Upload failed")
                    return@launch
                }
            }

            _uploadState.value = UploadState.Success
        }
    }

    fun resetState() {
        _uploadState.value = UploadState.Idle
    }
}
