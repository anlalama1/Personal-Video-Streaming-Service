package com.portfolio.videostreaming.ui

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.portfolio.videostreaming.MainActivity
import com.portfolio.videostreaming.R
import com.portfolio.videostreaming.core.data.network.RegisterDeviceTokenRequest
import com.portfolio.videostreaming.core.data.network.StreamingApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.URL

/**
 * ============================================================================
 * Alexandria Firebase Cloud Messaging (FCM) Service
 * ============================================================================
 * Enterprise Architecture Strategy: FCM Push Notification Receiver.
 * Receives FCM push notification payloads from AWS Lambda, extracts notification
 * metadata, and invokes AlexandriaPushNotificationManager to construct system notifications.
 */
class AlexandriaFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCMService", "New FCM registration token received: $token")
        AlexandriaPushNotificationManager.registerDeviceToken(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d("FCMService", "FCM push message received: ${remoteMessage.data}")

        val data = remoteMessage.data
        val title = data["title"] ?: remoteMessage.notification?.title ?: "New Family Memory Added"
        val publisherEmail = data["publisherEmail"] ?: "A family member"
        val videoTitle = data["title"] ?: "New Video"
        val imageUrl = data["imageUrl"] ?: remoteMessage.notification?.imageUrl?.toString()

        AlexandriaPushNotificationManager.showPublishNotification(
            context = applicationContext,
            title = title,
            publisherEmail = publisherEmail,
            videoTitle = videoTitle,
            imageUrl = imageUrl
        )
    }
}

/**
 * ============================================================================
 * Alexandria Push Notification Manager (Rich System Notifications)
 * ============================================================================
 * Enterprise Architecture Strategy: System Notification Builder.
 * Pre-fetches the CloudFront CDN thumbnail image on a background thread
 * and constructs an Android system notification using BigPictureStyle.
 */
object AlexandriaPushNotificationManager {

    private const val CHANNEL_ID = "alexandria_publish_channel"
    private const val CHANNEL_NAME = "Family Vault Video Updates"

    /**
     * Registers active FCM device token with Scribe Lambda.
     */
    fun registerDeviceToken(deviceToken: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                StreamingApi.service.registerDeviceToken(RegisterDeviceTokenRequest(deviceToken))
                Log.d("PushNotification", "Device token registered with Scribe Lambda: $deviceToken")
            } catch (e: Exception) {
                Log.e("PushNotification", "Failed to register device token", e)
            }
        }
    }

    /**
     * Renders a rich system notification bar item with BigPictureStyle thumbnail.
     */
    fun showPublishNotification(
        context: Context,
        title: String,
        publisherEmail: String,
        videoTitle: String,
        imageUrl: String? = null
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create Notification Channel
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications when a family member publishes a new video to your vault"
        }
        notificationManager.createNotificationChannel(channel)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        CoroutineScope(Dispatchers.IO).launch {
            var bitmap: Bitmap? = null
            if (!imageUrl.isNullOrBlank()) {
                try {
                    val url = URL(imageUrl)
                    bitmap = BitmapFactory.decodeStream(url.openConnection().getInputStream())
                } catch (e: Exception) {
                    Log.w("PushNotification", "Could not fetch notification thumbnail image", e)
                }
            }

            val bodyText = "$publisherEmail uploaded a new video: $videoTitle"

            val notificationBuilder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.logo_flat)
                .setContentTitle(title.ifBlank { "New Family Memory Added" })
                .setContentText(bodyText)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)

            if (bitmap != null) {
                notificationBuilder.setStyle(
                    NotificationCompat.BigPictureStyle()
                        .bigPicture(bitmap)
                        .setSummaryText(bodyText)
                )
            } else {
                notificationBuilder.setStyle(
                    NotificationCompat.BigTextStyle().bigText(bodyText)
                )
            }

            val notificationId = (System.currentTimeMillis() % 10000).toInt()
            notificationManager.notify(notificationId, notificationBuilder.build())
        }
    }
}
