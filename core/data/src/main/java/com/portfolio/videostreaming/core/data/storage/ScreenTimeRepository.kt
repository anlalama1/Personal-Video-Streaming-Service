package com.portfolio.videostreaming.core.data.storage

import android.content.Context
import android.util.Log
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

    /**
     * Senior/Lead Strategy: Use Locale.US for persistent keys and data formatting.
     * Intermediate developers often use Locale.getDefault(), which can produce 
     * non-standard characters in certain regions, breaking database queries or logic.
     */
    val dailySeconds: Flow<Long> = context.dataStore.data.map { preferences ->
        val lastDate = preferences[LAST_DATE_KEY] ?: 0L
        val currentDate = getCurrentDateAsLong()
        
        Log.d(TAG, "Daily check (Read): Last=$lastDate, Now=$currentDate")

        // Senior Strategy: Defensively filter the flow. 
        // Even if the file on disk hasn't been updated yet, the UI will see 0.
        if (lastDate != currentDate) {
            Log.i(TAG, "New day detected on read. Returning 0.")
            0L 
        } else {
            preferences[DAILY_SECONDS_KEY] ?: 0L
        }
    }

    suspend fun updateDailySeconds(seconds: Long) {
        context.dataStore.edit { preferences ->
            val currentDate = getCurrentDateAsLong()
            val lastDate = preferences[LAST_DATE_KEY] ?: 0L

            if (lastDate != currentDate) {
                Log.w(TAG, "Resetting daily timer for new day: $currentDate")
                preferences[DAILY_SECONDS_KEY] = seconds
                preferences[LAST_DATE_KEY] = currentDate
            } else {
                val currentTotal = preferences[DAILY_SECONDS_KEY] ?: 0L
                preferences[DAILY_SECONDS_KEY] = currentTotal + seconds
            }
        }
    }

    private fun getCurrentDateAsLong(): Long {
        // Force US Locale to ensure numerals are 0-9 regardless of device language.
        val sdf = SimpleDateFormat("yyyyMMdd", Locale.US)
        return sdf.format(Date()).toLong()
    }

    companion object {
        private const val TAG = "ScreenTimeRepo"
        private val DAILY_SECONDS_KEY = longPreferencesKey("daily_seconds")
        private val LAST_DATE_KEY = longPreferencesKey("last_date")
    }
}
