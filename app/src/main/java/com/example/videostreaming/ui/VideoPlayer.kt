package com.example.videostreaming.ui

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
    onTogglePlay: () -> Unit,
    modifier: Modifier = Modifier
) {
    // 1. Layering with Box
    // In Compose, a Box stacks its children on top of each other.
    Box(modifier = modifier) {
        // Bottom Layer: The Video
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = player
                    // 2. Disable default Media3 controls so they don't fight with ours.
                    useController = false 
                }
            },
            modifier = Modifier.fillMaxSize()
        )
        
        // Top Layer: Our Custom "Glass" Controls
        PlayerControls(
            isPlaying = isPlaying,
            onTogglePlay = onTogglePlay,
            modifier = Modifier.fillMaxSize()
        )
    }
}
