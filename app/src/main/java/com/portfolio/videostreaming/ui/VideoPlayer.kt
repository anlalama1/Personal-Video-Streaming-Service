package com.portfolio.videostreaming.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.Player
import androidx.media3.ui.PlayerView

/**
 * ============================================================================
 * Video Player Surface Composable (ExoPlayer Interop Layer)
 * ============================================================================
 * Enterprise Architecture Strategy: AndroidView Interoperability.
 * Uses AndroidView to bridge Android's native Media3 PlayerView surface with
 * Jetpack Compose, overlaying custom glassmorphic Compose controls on top.
 */
@Composable
fun VideoPlayer(
    player: Player,
    state: PlayerViewState,
    onIntent: (PlayerIntent) -> Unit,
    isScreenTimeVisible: Boolean,
    onBack: () -> Unit,
    onToggleScreenTime: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier) {
        // Bottom Layer: Native ExoPlayer Video Surface
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = player
                    useController = false // Disable native controls to use custom Compose controls
                }
            },
            modifier = Modifier.fillMaxSize()
        )
        
        // Top Layer: Custom Glassmorphic Controls
        PlayerControls(
            state = state,
            onIntent = onIntent,
            isScreenTimeVisible = isScreenTimeVisible,
            onBack = onBack,
            onToggleScreenTime = onToggleScreenTime,
            modifier = Modifier.fillMaxSize()
        )
    }
}
