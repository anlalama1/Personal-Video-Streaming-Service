package com.portfolio.videostreaming.core.data.network

import android.util.Log
import com.amplifyframework.auth.cognito.AWSCognitoAuthSession
import com.amplifyframework.core.Amplify
import com.portfolio.videostreaming.core.data.BuildConfig
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Senior/Lead Strategy: Use Data Transfer Objects (DTOs) for the API layer.
 * This keeps the API implementation details (JSON field names) from leaking into your UI logic.
 */
@Serializable
data class MediaItemDto(
    val videoId: String,
    val title: String,
    val genre: String,
    val releaseYear: String,
    val thumbnailUrl: String,
    val videoUrl: String,
    val description: String? = null,
    val tags: List<String>? = null
)

@Serializable
data class PlayEventRequest(
    val videoId: String
)

interface StreamingApiService {
    @GET("catalog")
    suspend fun getCatalog(): List<MediaItemDto>

    @POST("play")
    suspend fun logPlayEvent(
        @Body request: PlayEventRequest
    )
}

/**
 * Senior/Lead Strategy: Use a dedicated object or Dependency Injection (Hilt) to manage Singletons.
 */
object StreamingApi {
    private const val BASE_URL = BuildConfig.BASE_URL

    private val json = Json { 
        ignoreUnknownKeys = true 
        coerceInputValues = true 
        isLenient = true 
    }

    private val authInterceptor = Interceptor { chain ->
        val originalRequest = chain.request()
        
        // Principal Strategy: Direct JWT Injection
        // We fetch the current session synchronously to attach the token.
        val requestBuilder = originalRequest.newBuilder()
        
        try {
            var cognitoSession: AWSCognitoAuthSession? = null
            val latch = CountDownLatch(1)

            Amplify.Auth.fetchAuthSession(
                { session ->
                    cognitoSession = session as? AWSCognitoAuthSession
                    latch.countDown()
                },
                { error ->
                    Log.e("StreamingApi", "Failed to fetch auth session", error)
                    latch.countDown()
                }
            )

            latch.await(5, TimeUnit.SECONDS)

            val idToken = cognitoSession?.userPoolTokensResult?.value?.idToken
            if (idToken != null) {
                requestBuilder.addHeader("Authorization", "Bearer $idToken")
            }
        } catch (e: Exception) {
            Log.e("StreamingApi", "Failed to attach Auth Token", e)
        }

        chain.proceed(requestBuilder.build())
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val service: StreamingApiService by lazy {
        retrofit.create(StreamingApiService::class.java)
    }
}
