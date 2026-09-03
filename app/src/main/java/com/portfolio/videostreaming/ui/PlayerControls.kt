package com.portfolio.videostreaming.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.time.Duration.Companion.seconds

/**
 * Senior/Lead Strategy: MVI UI.
 * This component is now a "Pure Function". It doesn't perform logic; 
 * it only displays state and emits Intents.
 */
@Composable
fun PlayerControls(
    state: PlayerViewState,
    onIntent: (PlayerIntent) -> Unit,
    isScreenTimeVisible: Boolean,
    onBack: () -> Unit,
    onToggleScreenTime: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isVisible by remember { mutableStateOf(true) }

    // Auto-hide logic
    LaunchedEffect(isVisible, state.isPlaying) {
        if (isVisible && state.isPlaying) {
            delay(3.seconds)
            isVisible = false
        }
    }

    Box(
        modifier = modifier
            .background(if (isVisible) Color.Black.copy(alpha = 0.3f) else Color.Transparent)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {
                isVisible = !isVisible
            },
        contentAlignment = Alignment.Center
    ) {
        // Buffering Indicator (Added as a Senior refinement)
        if (state.isBuffering) {
            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(64.dp))
        }

        AnimatedVisibility(
            visible = isVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize()
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                // Back Button (Top Left)
                Surface(
                    onClick = onBack,
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.5f),
                    modifier = Modifier
                        .padding(32.dp)
                        .size(48.dp)
                        .align(Alignment.TopStart)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Go Back",
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }

                // Control Buttons in the Center
                Row(
                    modifier = Modifier.align(Alignment.Center),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(32.dp)
                ) {
                    // Rewind Button
                    ControlIconButton(
                        icon = Icons.Default.Replay10,
                        contentDescription = "Rewind 10s",
                        onClick = { onIntent(PlayerIntent.Rewind) },
                        size = 56.dp,
                        iconSize = 32.dp
                    )

                    // Play/Pause Button
                    ControlIconButton(
                        icon = if (state.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (state.isPlaying) "Pause" else "Play",
                        onClick = { onIntent(PlayerIntent.TogglePlay) },
                        size = 80.dp,
                        iconSize = 48.dp
                    )

                    // Forward Button
                    ControlIconButton(
                        icon = Icons.Default.Forward10,
                        contentDescription = "Forward 10s",
                        onClick = { onIntent(PlayerIntent.Forward) },
                        size = 56.dp,
                        iconSize = 32.dp
                    )
                }

                // Progress Bar and Time at the Bottom
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .padding(bottom = 32.dp, start = 16.dp, end = 16.dp)
                ) {
                    Slider(
                        value = if (state.duration > 0) state.currentPosition.toFloat() else 0f,
                        onValueChange = { onIntent(PlayerIntent.SeekTo(it.toLong())) },
                        valueRange = 0f..(if (state.duration > 0) state.duration.toFloat() else 1f),
                        colors = SliderDefaults.colors(
                            thumbColor = Color.White,
                            activeTrackColor = Color.White,
                            inactiveTrackColor = Color.White.copy(alpha = 0.3f)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = formatTime(state.currentPosition),
                            color = Color.White,
                            fontSize = 14.sp
                        )
                        Text(
                            text = formatTime(state.duration),
                            color = Color.White,
                            fontSize = 14.sp
                        )
                    }

                    // Screen Time Toggle Button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        ControlIconButton(
                            icon = if (isScreenTimeVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = "Toggle Screen Time",
                            onClick = onToggleScreenTime,
                            size = 40.dp,
                            iconSize = 20.dp
                        )
                    }
                }
            }
        }
    }
}

/**
 * Senior Approach: Reusable UI components.
 */
@Composable
private fun ControlIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    size: androidx.compose.ui.unit.Dp,
    iconSize: androidx.compose.ui.unit.Dp
) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = Color.Black.copy(alpha = 0.5f),
        modifier = Modifier.size(size)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = Color.White,
                modifier = Modifier.size(iconSize)
            )
        }
    }
}

private fun formatTime(ms: Long): String {
    val minutes = TimeUnit.MILLISECONDS.toMinutes(ms)
    val seconds = TimeUnit.MILLISECONDS.toSeconds(ms) % 60
    return String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds)
}
