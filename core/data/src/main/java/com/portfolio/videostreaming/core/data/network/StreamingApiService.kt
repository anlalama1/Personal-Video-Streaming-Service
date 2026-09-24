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
 * ============================================================================
 * Network Data Transfer Objects (DTOs)
 * ============================================================================
 * Enterprise Architecture Strategy: Data Transfer Objects.
 * Separating Network DTOs from UI Domain Models prevents external API schema changes
 * (e.g. field renames or nullability shifts) from cascading into Compose UI layers.
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

/**
 * Retrofit Interface definition for Scribe API endpoints.
 */
interface StreamingApiService {
    @GET("catalog")
    suspend fun getCatalog(): List<MediaItemDto>

    @POST("play")
    suspend fun logPlayEvent(
        @Body request: PlayEventRequest
    )
}

/**
 * ============================================================================
 * Retrofit Network Client Singleton & Synchronous Auth Interceptor
 * ============================================================================
 * Enterprise Architecture Strategy: Transparent Auth Token Injection.
 * OkHttp Interceptors intercept all outgoing HTTP requests and automatically
 * attach the user's cryptographically signed Cognito JWT ID Token in the
 * 'Authorization: Bearer <token>' header without polluting UI ViewModels with auth logic.
 */
object StreamingApi {
    private const val BASE_URL = BuildConfig.BASE_URL

    // Explicit Kotlinx Serialization JSON configuration
    private val json = Json { 
        ignoreUnknownKeys = true // Resilient parsing: ignores unexpected backend JSON fields
        coerceInputValues = true // Coerces nulls to defaults where possible
        isLenient = true 
    }

    /**
     * OkHttp Interceptor: Synchronously fetches active Cognito Auth Session
     * on the background I/O thread before releasing the HTTP request.
     */
    private val authInterceptor = Interceptor { chain ->
        val originalRequest = chain.request()
        val requestBuilder = originalRequest.newBuilder()
        
        try {
            var cognitoSession: AWSCognitoAuthSession? = null
            val latch = CountDownLatch(1)

            // Asynchronously fetch session from AWS Amplify Auth Plugin
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

            // Block OkHttp network thread up to 5 seconds waiting for Amplify Auth callback
            latch.await(5, TimeUnit.SECONDS)

            // Extract JWT ID Token and inject Bearer header
            val idToken = cognitoSession?.userPoolTokensResult?.value?.idToken
            if (idToken != null) {
                requestBuilder.addHeader("Authorization", "Bearer $idToken")
            }
        } catch (e: Exception) {
            Log.e("StreamingApi", "Failed to attach Auth Token", e)
        }

        chain.proceed(requestBuilder.build())
    }

    // OkHttp Client configured with automated Auth Interceptor
    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .build()

    // Retrofit Instance lazy initialization
    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val service: StreamingApiService by lazy {
        retrofit.create(StreamingApiService::class.java)
    }
}
