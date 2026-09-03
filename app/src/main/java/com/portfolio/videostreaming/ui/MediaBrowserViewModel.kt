package com.portfolio.videostreaming.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.portfolio.videostreaming.core.data.model.MediaFile
import com.portfolio.videostreaming.core.data.network.StreamingApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MediaBrowserViewModel(application: Application) : AndroidViewModel(application) {

    private val _videoList = MutableStateFlow<List<MediaFile>>(emptyList())
    val videoList = _videoList.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage = _errorMessage.asStateFlow()

    init {
        loadVideos()
    }

    /**
     * Senior/Lead Approach: Fetch from remote API instead of local disk.
     */
    fun loadVideos() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                // Call the Lambda-backed API Gateway
                val dtos = withContext(Dispatchers.IO) {
                    StreamingApi.service.getCatalog()
                }
                
                // Map DTOs to UI Models
                _videoList.value = dtos.map { dto ->
                    MediaFile(
                        id = dto.videoId,
                        title = dto.title,
                        genre = dto.genre,
                        releaseYear = dto.releaseYear.toIntOrNull() ?: 0,
                        thumbnailUrl = dto.thumbnailUrl,
                        videoUrl = dto.videoUrl
                    )
                }
            } catch (e: Exception) {
                Log.e("MediaBrowserVM", "Error loading catalog", e)
                _errorMessage.value = "Failed to connect to AWS catalog. Ensure API is deployed."
            } finally {
                _isLoading.value = false
            }
        }
    }
}
