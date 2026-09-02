package com.portfolio.videostreaming.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.Player
import androidx.media3.ui.PlayerView

/**
 * A UI component that layers the video engine and our custom controls.
 */
@Composable
fun VideoPlayer(
    player: Player,
    isPlaying: Boolean,
    currentPosition: Long,
    duration: Long,
    isScreenTimeVisible: Boolean,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onRewind: () -> Unit,
    onForward: () -> Unit,
    onBack: () -> Unit,
    onToggleScreenTime: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier) {
        // Bottom Layer: The Video
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = player
                    useController = false 
                }
            },
            modifier = Modifier.fillMaxSize()
        )
        
        // Top Layer: Our Custom "Glass" Controls
        PlayerControls(
            isPlaying = isPlaying,
            currentPosition = currentPosition,
            duration = duration,
            isScreenTimeVisible = isScreenTimeVisible,
            onTogglePlay = onTogglePlay,
            onSeek = onSeek,
            onRewind = onRewind,
            onForward = onForward,
            onBack = onBack,
            onToggleScreenTime = onToggleScreenTime,
            modifier = Modifier.fillMaxSize()
        )
    }
}
