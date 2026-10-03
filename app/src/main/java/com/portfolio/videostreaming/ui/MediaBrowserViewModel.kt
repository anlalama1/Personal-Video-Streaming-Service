package com.portfolio.videostreaming.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.portfolio.videostreaming.core.data.model.MediaFile
import com.portfolio.videostreaming.core.data.network.PublishVideoRequest
import com.portfolio.videostreaming.core.data.network.StreamingApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * ============================================================================
 * Media Browser ViewModel (MVVM Architecture Layer)
 * ============================================================================
 * Enterprise Architecture Strategy: ViewModel State Flow Encapsulation.
 * Exposes immutable StateFlow to the UI layer while keeping MutableStateFlow private.
 * Coroutines dispatched to Dispatchers.IO handle asynchronous network I/O
 * off the Main UI Thread.
 */
class MediaBrowserViewModel(application: Application) : AndroidViewModel(application) {

    // Immutable state encapsulation pattern
    private val _videoList = MutableStateFlow<List<MediaFile>>(emptyList())
    val videoList = _videoList.asStateFlow()

    private val _reviewQueue = MutableStateFlow<List<MediaFile>>(emptyList())
    val reviewQueue = _reviewQueue.asStateFlow()

    private val _genres = MutableStateFlow<List<String>>(emptyList())
    val genres = _genres.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage = _errorMessage.asStateFlow()

    private val _selectedVideo = MutableStateFlow<MediaFile?>(null)
    val selectedVideo = _selectedVideo.asStateFlow()

    init {
        loadVideos()
    }

    fun selectVideo(video: MediaFile) {
        _selectedVideo.value = video
    }

    /**
     * Fetches catalog media items from Lambda-backed API Gateway via Retrofit DTOs.
     * Enforces cryptographically signed JWT auth via OkHttp interceptor.
     */
    fun loadVideos() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                // Network I/O offloaded to Dispatchers.IO thread pool
                val (dtos, genreDtos) = withContext(Dispatchers.IO) {
                    val catalog = StreamingApi.service.getCatalog()
                    val genres = StreamingApi.service.getGenres()
                    catalog to genres
                }
                _genres.value = genreDtos.map { it.genreName }.distinct()
                
                // Map Network DTOs to UI Domain Models (MediaFile)
                _videoList.value = dtos.map { dto ->
                    MediaFile(
                        id = dto.videoId,
                        title = dto.title,
                        genre = dto.genre,
                        releaseYear = dto.releaseYear.toIntOrNull() ?: 0,
                        thumbnailUrl = dto.thumbnailUrl,
                        videoUrl = dto.videoUrl,
                        description = dto.description ?: "",
                        tags = dto.tags ?: emptyList(),
                        transcodeStatus = dto.transcodeStatus,
                        aiTitle = dto.aiTitle.orEmpty(),
                        aiGenre = dto.aiGenre.orEmpty(),
                        familyId = dto.familyId,
                        videoKey = dto.videoKey
                    )
                }
            } catch (e: Exception) {
                Log.e("MediaBrowserVM", "Error loading catalog", e)
                _errorMessage.value = "Connection Error: ${e.localizedMessage ?: "Unknown error"}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun loadReviewQueue() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val dtos = withContext(Dispatchers.IO) {
                    StreamingApi.service.getReviewQueue()
                }
                _reviewQueue.value = dtos.map { dto ->
                    MediaFile(
                        id = dto.videoId,
                        title = dto.title,
                        genre = dto.genre,
                        releaseYear = dto.releaseYear.toIntOrNull() ?: 0,
                        thumbnailUrl = dto.thumbnailUrl,
                        videoUrl = dto.videoUrl,
                        description = dto.description ?: "",
                        tags = dto.tags ?: emptyList(),
                        transcodeStatus = dto.transcodeStatus,
                        aiTitle = dto.aiTitle.orEmpty(),
                        aiGenre = dto.aiGenre.orEmpty(),
                        familyId = dto.familyId,
                        videoKey = dto.videoKey
                    )
                }
            } catch (e: Exception) {
                Log.e("MediaBrowserVM", "Error loading family review queue", e)
                _errorMessage.value = "Connection Error: ${e.localizedMessage ?: "Unknown error"}"
            } finally {
                _isLoading.value = false
            }
        }

    }

    suspend fun publishReview(
        video: MediaFile,
        title: String,
        genre: String,
        releaseYear: String,
        description: String
    ) = withContext(Dispatchers.IO) {
        StreamingApi.service.publishVideo(
            PublishVideoRequest(
                videoId = video.id,
                familyId = video.familyId,
                oldFamilyId = video.familyId,
                videoKey = video.videoKey,
                title = title,
                genre = genre,
                releaseYear = releaseYear,
                description = description,
                tags = video.tags
            )
        )
    }
}
