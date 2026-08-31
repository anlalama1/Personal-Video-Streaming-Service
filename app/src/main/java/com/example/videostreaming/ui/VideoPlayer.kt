package com.example.videostreaming.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.Player
import androidx.media3.ui.PlayerView

/**
 * A "dumb" UI component that simply displays whatever player we give it.
 * It no longer manages lifecycle or initialization—that is now the ViewModel's job.
 */
@Composable
fun VideoPlayer(
    player: Player,
    modifier: Modifier = Modifier
) {
    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                this.player = player
                useController = true
            }
        },
        modifier = modifier
    )
}
