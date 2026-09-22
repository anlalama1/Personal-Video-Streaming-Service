package com.portfolio.videostreaming.ui

import android.app.Application
import android.util.Log
import androidx.core.net.toUri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.portfolio.videostreaming.core.data.network.PlayEventRequest
import com.portfolio.videostreaming.core.data.network.StreamingApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds

class VideoPlayerViewModel(application: Application) : AndroidViewModel(application) {

    /**
     * Senior Strategy: Single State Management.
     * Instead of 3-4 separate flows, we have one. This makes the UI 
     * incredibly predictable and easy to test.
     */
    private val _viewState = MutableStateFlow(PlayerViewState())
    val viewState = _viewState.asStateFlow()

    // Internal engine state
    private var currentUri: String? = null

    val exoPlayer = ExoPlayer.Builder(application).build().apply {
        addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                // Update only the isPlaying part of the state
                _viewState.update { it.copy(isPlaying = isPlaying) }
            }

            override fun onPlaybackStateChanged(state: Int) {
                _viewState.update { 
                    it.copy(
                        isBuffering = state == Player.STATE_BUFFERING,
                        duration = if (state == Player.STATE_READY) duration else it.duration
                    )
                }
            }
        })
    }

    init {
        startProgressPolling()
    }

    /**
     * The ONLY entry point for the UI.
     * Senior Approach: Use a single "processIntent" function to centralize all logic.
     */
    fun processIntent(intent: PlayerIntent) {
        when (intent) {
            is PlayerIntent.LoadVideo -> handleLoadVideo(intent.videoId, intent.videoUri)
            is PlayerIntent.TogglePlay -> handleTogglePlay()
            is PlayerIntent.SeekTo -> handleSeekTo(intent.position)
            is PlayerIntent.Rewind -> handleRewind()
            is PlayerIntent.Forward -> handleForward()
        }
    }

    private fun handleLoadVideo(videoId: String, uriString: String) {
        if (currentUri == uriString) return
        
        currentUri = uriString
        _viewState.update { it.copy(videoId = videoId, videoUri = uriString) }
        
        // Log telemetry (BFF)
        viewModelScope.launch {
            try {
                StreamingApi.service.logPlayEvent(PlayEventRequest(videoId))
            } catch (e: Exception) {
                Log.e("VideoPlayerVM", "Failed to log play event", e)
            }
        }

        val mediaItem = MediaItem.fromUri(uriString.toUri())
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
    }

    private fun handleTogglePlay() {
        if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
    }

    private fun handleSeekTo(position: Long) {
        exoPlayer.seekTo(position)
        _viewState.update { it.copy(currentPosition = position) }
    }

    private fun handleRewind() {
        val newPos = (exoPlayer.currentPosition - SKIP_INCREMENT_MS).coerceAtLeast(0)
        handleSeekTo(newPos)
    }

    private fun handleForward() {
        val newPos = (exoPlayer.currentPosition + SKIP_INCREMENT_MS).coerceAtMost(exoPlayer.duration)
        handleSeekTo(newPos)
    }

    private fun startProgressPolling() {
        viewModelScope.launch {
            while (true) {
                if (exoPlayer.isPlaying) {
                    _viewState.update { it.copy(currentPosition = exoPlayer.currentPosition) }
                }
                delay(200.milliseconds)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        exoPlayer.release()
    }

    companion object {
        private const val SKIP_INCREMENT_MS = 10000L
    }
}
