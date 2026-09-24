package com.portfolio.videostreaming.ui

/**
 * ============================================================================
 * Player Unidirectional Data Flow (MVI) Contract
 * ============================================================================
 * Enterprise Architecture Strategy: Model-View-Intent (MVI) Contract.
 * Consolidating immutable ViewState and user Intent events in a single contract
 * creates predictable state transitions, eliminates UI race conditions,
 * and makes video playback interactions deterministic and testable.
 */

/**
 * Single Immutable Source of Truth for Player View State.
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
 * User Intents (Actions) that can be dispatched to the PlayerViewModel.
 */
sealed class PlayerIntent {
    data class LoadVideo(val videoId: String, val videoUri: String) : PlayerIntent()
    object TogglePlay : PlayerIntent()
    data class SeekTo(val position: Long) : PlayerIntent()
    object Rewind : PlayerIntent()
    object Forward : PlayerIntent()
}
