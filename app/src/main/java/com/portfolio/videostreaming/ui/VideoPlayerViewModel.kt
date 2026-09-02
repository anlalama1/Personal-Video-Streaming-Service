package com.portfolio.videostreaming.ui

import android.app.Application
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

class VideoPlayerViewModel(application: Application) : AndroidViewModel(application) {

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying = _isPlaying.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration = _duration.asStateFlow()

    // Single source of truth for the player engine
    val exoPlayer = ExoPlayer.Builder(application).build().apply {
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
        startProgressPolling()
    }

    /**
     * Senior Approach: Dynamic loading.
     * The player doesn't care WHERE the video is from (Local, HLS, DASH).
     * It just takes a URI and works its magic.
     */
    fun playVideo(uriString: String) {
        val mediaItem = MediaItem.fromUri(uriString.toUri())
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
    }

    private fun startProgressPolling() {
        viewModelScope.launch {
            while (true) {
                if (exoPlayer.isPlaying) {
                    _currentPosition.value = exoPlayer.currentPosition
                }
                delay(200.milliseconds)
            }
        }
    }

    fun togglePlay() {
        if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
    }

    fun seekTo(position: Long) {
        exoPlayer.seekTo(position)
        _currentPosition.value = position
    }

    fun rewind() {
        seekTo((exoPlayer.currentPosition - SKIP_INCREMENT_MS).coerceAtLeast(0))
    }

    fun forward() {
        seekTo((exoPlayer.currentPosition + SKIP_INCREMENT_MS).coerceAtMost(exoPlayer.duration))
    }

    override fun onCleared() {
        super.onCleared()
        exoPlayer.release()
    }

    companion object {
        private const val SKIP_INCREMENT_MS = 10000L
    }
}
