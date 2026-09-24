package com.portfolio.videostreaming.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.portfolio.videostreaming.core.data.storage.ScreenTimeRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

/**
 * ============================================================================
 * Screen Time Telemetry ViewModel
 * ============================================================================
 * Enterprise Architecture Strategy: Persistent & In-Memory Heartbeat Coordination.
 * Separates transient session state (resets on process kill) from persistent
 * daily usage state (persisted in Jetpack DataStore across process restarts).
 */
class ScreenTimeViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ScreenTimeRepository(application)

    // 1. Transient Session Time (In-Memory)
    private val _sessionSeconds = MutableStateFlow(0L)
    val sessionSeconds = _sessionSeconds.asStateFlow()

    // 2. Persistent Daily Time (Jetpack DataStore backed via StateFlow)
    val dailySeconds: StateFlow<Long> = repository.dailySeconds.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000), // Keeps flow active 5s after last subscriber unmounts
        initialValue = 0L
    )

    // 3. Telemetry Overlay Visibility State
    private val _isCounterVisible = MutableStateFlow(true)
    val isCounterVisible = _isCounterVisible.asStateFlow()

    // 4. Playback Gate: Only increments when video playback is active
    private var isTicking = false

    init {
        startHeartbeat()
    }

    /**
     * Heartbeat Coroutine Loop: Increments session and persistent daily timers every second.
     */
    private fun startHeartbeat() {
        viewModelScope.launch {
            while (true) {
                delay(1.seconds)
                if (isTicking) {
                    _sessionSeconds.value += 1
                    repository.updateDailySeconds(1)
                }
            }
        }
    }

    fun setTicking(active: Boolean) {
        isTicking = active
    }

    fun toggleVisibility() {
        _isCounterVisible.value = !_isCounterVisible.value
    }
}
