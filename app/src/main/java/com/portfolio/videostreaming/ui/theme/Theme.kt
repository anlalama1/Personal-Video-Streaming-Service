package com.portfolio.videostreaming.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * ============================================================================
 * Jetpack Compose Material 3 Theme Wrapper
 * ============================================================================
 * Enterprise Architecture Strategy: Dynamic Dark Theme Scheme.
 * Binds custom Heritage Design Tokens to Material 3 ColorScheme slots.
 */
private val DarkColorScheme = darkColorScheme(
    primary = Amber500,
    onPrimary = Color.Black,
    background = HeritageBlack,
    onBackground = Parchment,
    surface = Stone900,
    onSurface = Parchment,
    surfaceVariant = Stone800,
    onSurfaceVariant = Stone400,
    outline = Stone800
)

@Composable
fun AlexandriaTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
