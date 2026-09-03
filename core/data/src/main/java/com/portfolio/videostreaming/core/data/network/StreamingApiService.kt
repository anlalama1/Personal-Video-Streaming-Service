package com.portfolio.videostreaming.core.data.network

import com.portfolio.videostreaming.core.data.BuildConfig
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Senior/Lead Strategy: Use Data Transfer Objects (DTOs) for the API layer.
 * This keeps the API implementation details (JSON field names) from leaking into your UI logic.
 */
@Serializable
data class MediaItemDto(
    val videoId: String,
    val title: String,
    val genre: String,
    val releaseYear: String, // Switched to String to match your DynamoDB entry
    val thumbnailUrl: String,
    val videoUrl: String
)

@Serializable
data class PlayEventRequest(
    val videoId: String
)

interface StreamingApiService {
    @GET("catalog")
    suspend fun getCatalog(): List<MediaItemDto>

    @POST("play")
    suspend fun logPlayEvent(@Body request: PlayEventRequest)
}

/**
 * Senior/Lead Strategy: Use a dedicated object or Dependency Injection (Hilt) to manage Singletons.
 */
object StreamingApi {
    // Lead Strategy: URL is now injected from build.gradle.kts
    private const val BASE_URL = BuildConfig.BASE_URL

    private val json = Json { 
        ignoreUnknownKeys = true 
        coerceInputValues = true 
        isLenient = true // Senior Strategy: Be more forgiving of malformed JSON from the cloud
    }

    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val service: StreamingApiService by lazy {
        retrofit.create(StreamingApiService::class.java)
    }
}
