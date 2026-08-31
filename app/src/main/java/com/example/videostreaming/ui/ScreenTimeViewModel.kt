package com.example.videostreaming.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.videostreaming.data.ScreenTimeRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

class ScreenTimeViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ScreenTimeRepository(application)

    // 1. Session Time (Resets on app kill)
    private val _sessionSeconds = MutableStateFlow(0L)
    val sessionSeconds = _sessionSeconds.asStateFlow()

    // 2. Daily Time (Persists across restarts)
    val dailySeconds: StateFlow<Long> = repository.dailySeconds.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 0L
    )

    // 3. Visibility State
    private val _isCounterVisible = MutableStateFlow(true)
    val isCounterVisible = _isCounterVisible.asStateFlow()

    init {
        startHeartbeat()
    }

    private fun startHeartbeat() {
        viewModelScope.launch {
            while (true) {
                delay(1.seconds)
                _sessionSeconds.value += 1
                repository.updateDailySeconds(1)
            }
        }
    }

    fun toggleVisibility() {
        _isCounterVisible.value = !_isCounterVisible.value
    }
}
