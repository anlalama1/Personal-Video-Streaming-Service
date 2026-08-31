package com.example.videostreaming.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

/**
 * Our custom "Glass" controls.
 * This Composable demonstrates animations, transparency, and reactive UI.
 */
@Composable
fun PlayerControls(
    isPlaying: Boolean,
    onTogglePlay: () -> Unit,
    modifier: Modifier = Modifier
) {
    // 1. State for Visibility
    var isVisible by remember { mutableStateOf(true) }

    // 2. Auto-hide Logic
    // If the video is playing and the controls are shown, hide them after 3 seconds.
    LaunchedEffect(isVisible, isPlaying) {
        if (isVisible && isPlaying) {
            delay(3000)
            isVisible = false
        }
    }

    // 3. The Layout
    Box(
        modifier = modifier
            .background(if (isVisible) Color.Black.copy(alpha = 0.3f) else Color.Transparent)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null // No ripple when just tapping to show controls
            ) {
                isVisible = !isVisible
            },
        contentAlignment = Alignment.Center
    ) {
        // 4. Smooth Animations
        AnimatedVisibility(
            visible = isVisible,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            // The "Glass" Circle
            Surface(
                onClick = onTogglePlay,
                shape = CircleShape,
                color = Color.Black.copy(alpha = 0.5f), // Semi-transparent black
                modifier = Modifier.size(80.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        tint = Color.White,
                        modifier = Modifier.size(48.dp)
                    )
                }
            }
        }
    }
}
