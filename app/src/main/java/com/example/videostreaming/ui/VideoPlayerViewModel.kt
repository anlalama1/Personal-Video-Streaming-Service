package com.example.videostreaming.ui

import android.app.Application
import android.os.Environment
import androidx.core.net.toUri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds

/**
 * The ViewModel acts as the "persistent brain" of our player.
 * We use AndroidViewModel because we need a Context to build the ExoPlayer.
 */
class VideoPlayerViewModel(application: Application) : AndroidViewModel(application) {

    // 1. Reactive State
    private val _isPlaying = MutableStateFlow(true)
    val isPlaying = _isPlaying.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration = _duration.asStateFlow()

    // This instance will survive screen rotations!
    val exoPlayer = ExoPlayer.Builder(application).build().apply {
        val videoPath = "${Environment.getExternalStorageDirectory().path}/Movies/all_the_stars_kendrick_lamar.mp4"
        val mediaItem = MediaItem.fromUri(videoPath.toUri())
        setMediaItem(mediaItem)
        prepare()
        playWhenReady = true
        
        addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _isPlaying.value = isPlaying
            }

            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    _duration.value = duration
                }
            }
        })
    }

    init {
        // Start polling for progress
        viewModelScope.launch {
            while (true) {
                if (exoPlayer.isPlaying) {
                    _currentPosition.value = exoPlayer.currentPosition
                }
                delay(200.milliseconds) // Poll every 200ms for smooth UI updates
            }
        }
    }

    // 2. Handle User Intents
    fun togglePlay() {
        if (exoPlayer.isPlaying) {
            exoPlayer.pause()
        } else {
            exoPlayer.play()
        }
    }

    fun seekTo(position: Long) {
        exoPlayer.seekTo(position)
        _currentPosition.value = position
    }

    fun rewind() {
        val newPos = (exoPlayer.currentPosition - SKIP_INCREMENT_MS).coerceAtLeast(0)
        seekTo(newPos)
    }

    fun forward() {
        val newPos = (exoPlayer.currentPosition + SKIP_INCREMENT_MS).coerceAtMost(exoPlayer.duration)
        seekTo(newPos)
    }

    /**
     * onCleared is called when the user finishes the activity or the process is killed.
     * This is the correct place to release expensive resources like the player engine.
     */
    override fun onCleared() {
        exoPlayer.release()
    }

    companion object {
        private const val SKIP_INCREMENT_MS = 10000L
    }
}
