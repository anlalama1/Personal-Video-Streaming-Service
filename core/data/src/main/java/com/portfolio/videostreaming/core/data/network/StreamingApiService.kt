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
 * from cascading into Compose UI layers.
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
    val tags: List<String>? = null,
    val transcodeStatus: String = "",
    val aiTitle: String? = null,
    val aiGenre: String? = null,
    val familyId: String = "",
    val videoKey: String = ""
)

@Serializable
data class PublishVideoRequest(
    val videoId: String,
    val familyId: String,
    val oldFamilyId: String? = null,
    val videoKey: String,
    val title: String,
    val genre: String,
    val releaseYear: String,
    val description: String? = null,
    val tags: List<String>? = null
)

@Serializable
data class GenreDto(
    val genreName: String
)

@Serializable
data class PlayEventRequest(
    val videoId: String
)

@Serializable
data class IngestRequest(
    val title: String,
    val genre: String,
    val releaseYear: String,
    val familyId: String? = null,
    val videoFileName: String,
    val useAi: Boolean = false,
    val status: String? = null
)

@Serializable
data class IngestResponse(
    val message: String,
    val videoKey: String
)

@Serializable
data class StartUploadRequest(
    val key: String,
    val contentType: String
)

@Serializable
data class StartUploadResponse(
    val uploadId: String
)

@Serializable
data class PartUrlRequest(
    val key: String,
    val uploadId: String,
    val partNumber: Int,
    val totalParts: Int
)

@Serializable
data class PartUrlResponse(
    val uploadUrl: String
)

@Serializable
data class CompletedPartDto(
    val ETag: String,
    val PartNumber: Int
)

@Serializable
data class CompleteUploadRequest(
    val key: String,
    val uploadId: String,
    val parts: List<CompletedPartDto>
)

@Serializable
data class CompleteUploadResponse(
    val message: String
)

/**
 * Retrofit Interface definition for Scribe API endpoints.
 */
interface StreamingApiService {
    @GET("catalog")
    suspend fun getCatalog(): List<MediaItemDto>

    @GET("catalog?adminView=true")
    suspend fun getReviewQueue(): List<MediaItemDto>

    @POST("catalog/publish")
    suspend fun publishVideo(@Body request: PublishVideoRequest)

    @GET("genres")
    suspend fun getGenres(): List<GenreDto>

    @POST("ingest")
    suspend fun ingestMedia(@Body request: IngestRequest): IngestResponse

    @POST("upload/start")
    suspend fun startUpload(@Body request: StartUploadRequest): StartUploadResponse

    @POST("upload/part")
    suspend fun getPartUrl(@Body request: PartUrlRequest): PartUrlResponse

    @POST("upload/complete")
    suspend fun completeUpload(@Body request: CompleteUploadRequest): CompleteUploadResponse

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

    private val json = Json { 
        ignoreUnknownKeys = true
        coerceInputValues = true
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
            } else {
                Log.w("StreamingApi", "No ID Token found in Cognito session. Auth header omitted.")
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
