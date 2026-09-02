package com.portfolio.videostreaming.ui

import android.app.Application
import android.content.ContentUris
import android.provider.MediaStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Senior Approach: Use a robust Data Class instead of just raw Strings.
 * This makes it easy to add thumbnails or metadata (duration, size) later.
 */
data class MediaFile(
    val id: Long,
    val name: String,
    val uri: String
)

class MediaBrowserViewModel(application: Application) : AndroidViewModel(application) {

    private val _videoList = MutableStateFlow<List<MediaFile>>(emptyList())
    val videoList = _videoList.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    init {
        loadVideos()
    }

    /**
     * Senior Approach: Offload heavy I/O to Dispatchers.IO.
     * Intermediate developers often query ContentResolvers on the Main thread,
     * which causes "Jank" (UI stutter) if the device has many files.
     */
    fun loadVideos() {
        viewModelScope.launch {
            _isLoading.value = true
            val videos = withContext(Dispatchers.IO) {
                queryMediaStore()
            }
            _videoList.value = videos
            _isLoading.value = false
        }
    }

    private fun queryMediaStore(): List<MediaFile> {
        val list = mutableListOf<MediaFile>()
        
        // We only care about videos in the "Movies" directory
        val selection = "${MediaStore.Video.Media.RELATIVE_PATH} LIKE ?"
        val selectionArgs = arrayOf("%Movies%")
        
        val projection = arrayOf(
            MediaStore.Video.Media._ID,
            MediaStore.Video.Media.DISPLAY_NAME
        )

        // The ContentResolver acts as a gateway to the system-wide media database.
        getApplication<Application>().contentResolver.query(
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            "${MediaStore.Video.Media.DISPLAY_NAME} ASC"
        )?.use { cursor ->
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
            val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)

            while (cursor.moveToNext()) {
                val id = cursor.getLong(idColumn)
                val name = cursor.getString(nameColumn)
                val contentUri = ContentUris.withAppendedId(
                    MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                    id
                ).toString()

                list.add(MediaFile(id, name, contentUri))
            }
        }
        return list
    }
}
