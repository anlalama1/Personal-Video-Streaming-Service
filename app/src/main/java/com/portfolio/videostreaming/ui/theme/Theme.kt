package com.portfolio.videostreaming.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

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
        // Using default typography for now, but configured to scale with tokens
        content = content
    )
}
