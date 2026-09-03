package com.portfolio.videostreaming.ui

/**
 * Senior/Lead Strategy: The "Contract".
 * By defining State and Intent in one place, we create a clear documentation 
 * of how this screen behaves. 
 */

/**
 * The Single Source of Truth for the UI.
 * This is immutable—the UI cannot change it directly.
 */
data class PlayerViewState(
    val videoId: String = "",
    val videoUri: String = "",
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val currentPosition: Long = 0L,
    val duration: Long = 0L,
    val error: String? = null
)

/**
 * Everything the user can "Intend" to do on this screen.
 */
sealed class PlayerIntent {
    data class LoadVideo(val videoId: String, val videoUri: String) : PlayerIntent()
    object TogglePlay : PlayerIntent()
    data class SeekTo(val position: Long) : PlayerIntent()
    object Rewind : PlayerIntent()
    object Forward : PlayerIntent()
}
