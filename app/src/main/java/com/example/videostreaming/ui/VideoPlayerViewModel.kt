package com.example.videostreaming.ui

import android.app.Application
import android.os.Environment
import androidx.core.net.toUri
import androidx.lifecycle.AndroidViewModel
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The ViewModel acts as the "persistent brain" of our player.
 * We use AndroidViewModel because we need a Context to build the ExoPlayer.
 */
class VideoPlayerViewModel(application: Application) : AndroidViewModel(application) {

    // 1. Reactive State
    // This Flow will emit the current play/pause status to any observer (like our UI)
    private val _isPlaying = MutableStateFlow(true)
    val isPlaying = _isPlaying.asStateFlow()

    // This instance will survive screen rotations!
    val exoPlayer = ExoPlayer.Builder(application).build().apply {
        val videoPath = "${Environment.getExternalStorageDirectory().path}/Movies/all_the_stars_kendrick_lamar.mp4"
        val mediaItem = MediaItem.fromUri(videoPath.toUri())
        setMediaItem(mediaItem)
        prepare()
        playWhenReady = true
        
        // 2. Add a listener to keep our UI state in sync with the engine.
        // Even if the player is paused by the system (e.g., a phone call), 
        // our UI will react instantly because of this listener.
        addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _isPlaying.value = isPlaying
            }
        })
    }

    // 3. Handle User Intent
    // The UI calls this, and the ViewModel tells the engine what to do.
    fun togglePlay() {
        if (exoPlayer.isPlaying) {
            exoPlayer.pause()
        } else {
            exoPlayer.play()
        }
    }

    /**
     * onCleared is called when the user finishes the activity or the process is killed.
     * This is the correct place to release expensive resources like the player engine.
     */
    override fun onCleared() {
        exoPlayer.release()
    }
}
