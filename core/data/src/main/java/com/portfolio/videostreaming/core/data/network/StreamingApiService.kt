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
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.POST
import retrofit2.http.PUT
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
    val useAi: Boolean = false,
    val aiTitle: String? = null,
    val aiGenre: String? = null,
    val aiTags: List<String>? = null,
    val aiDescription: String? = null,
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
    val videoId: String? = null,
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

@Serializable
data class VaultMemberDto(
    val username: String,
    val email: String = "",
    val isAdmin: Boolean = false,
    val isApproved: Boolean = false,
    val isCurrentUser: Boolean = false,
    val enabled: Boolean = true,
    val status: String = ""
)

@Serializable
data class VaultMemberActionRequest(
    val username: String
)

@Serializable
data class VaultActionResponse(
    val success: Boolean = false,
    val isAdmin: Boolean = false,
    val isApproved: Boolean = false,
    val message: String = ""
)

@Serializable
data class VaultVideoMetadataRequest(
    val title: String,
    val genre: String,
    val releaseYear: String,
    val description: String,
    val tags: List<String>
)

/**
 * Retrofit Interface definition for Scribe API endpoints.
 */
interface StreamingApiService {
    @GET("catalog")
    suspend fun getCatalog(): List<MediaItemDto>

    @GET("catalog?adminView=true")
    suspend fun getVaultCatalog(): List<MediaItemDto>

    @GET("catalog?reviewQueue=true")
    suspend fun getReviewQueue(): List<MediaItemDto>

    @DELETE("catalog/{videoId}/{familyId}/reject")
    suspend fun rejectReviewItem(
        @Path("videoId") videoId: String,
        @Path("familyId") familyId: String
    )

    @POST("catalog/publish")
    suspend fun publishVideo(@Body request: PublishVideoRequest)

    @GET("vault/members")
    suspend fun getVaultMembers(): List<VaultMemberDto>

    @POST("vault/members")
    suspend fun registerVaultMember(): VaultActionResponse

    @POST("vault/members/approve")
    suspend fun approveVaultMember(@Body request: VaultMemberActionRequest): VaultActionResponse

    @POST("vault/members/promote")
    suspend fun promoteVaultMember(@Body request: VaultMemberActionRequest): VaultActionResponse

    @POST("vault/members/demote")
    suspend fun demoteVaultMember(@Body request: VaultMemberActionRequest): VaultActionResponse

    @POST("vault/members/ban")
    suspend fun banVaultMember(@Body request: VaultMemberActionRequest): VaultActionResponse

    @POST("vault/members/reject")
    suspend fun rejectVaultMember(@Body request: VaultMemberActionRequest): VaultActionResponse

    @PUT("vault/videos/{videoId}")
    suspend fun updateVaultVideo(
        @Path("videoId") videoId: String,
        @Body request: VaultVideoMetadataRequest
    ): VaultActionResponse

    @DELETE("catalog/{videoId}/{familyId}")
    suspend fun deleteVaultVideo(
        @Path("videoId") videoId: String,
        @Path("familyId") familyId: String
    ): VaultActionResponse

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
