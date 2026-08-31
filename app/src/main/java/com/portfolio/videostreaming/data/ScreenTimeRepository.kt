package com.portfolio.videostreaming.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val Context.dataStore by preferencesDataStore(name = "screen_time_prefs")

class ScreenTimeRepository(private val context: Context) {

    private val DAILY_SECONDS_KEY = longPreferencesKey("daily_seconds")
    private val LAST_DATE_KEY = longPreferencesKey("last_date")

    val dailySeconds: Flow<Long> = context.dataStore.data.map { preferences ->
        val lastDate = preferences[LAST_DATE_KEY] ?: 0L
        val currentDate = getCurrentDateAsLong()
        
        // If the day has changed, return 0
        if (lastDate != currentDate) 0L else preferences[DAILY_SECONDS_KEY] ?: 0L
    }

    suspend fun updateDailySeconds(seconds: Long) {
        context.dataStore.edit { preferences ->
            val currentDate = getCurrentDateAsLong()
            val lastDate = preferences[LAST_DATE_KEY] ?: 0L

            if (lastDate != currentDate) {
                // New day: Reset counter
                preferences[DAILY_SECONDS_KEY] = seconds
                preferences[LAST_DATE_KEY] = currentDate
            } else {
                // Same day: Add to existing total
                val currentTotal = preferences[DAILY_SECONDS_KEY] ?: 0L
                preferences[DAILY_SECONDS_KEY] = currentTotal + seconds
            }
        }
    }

    private fun getCurrentDateAsLong(): Long {
        val sdf = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        return sdf.format(Date()).toLong()
    }
}
