package com.portfolio.videostreaming.ui

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
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
import com.portfolio.videostreaming.core.data.network.VaultMemberActionRequest
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
        val messageType = data["type"] ?: ""

        when (messageType) {
            "VAULT_APPROVAL_REQUEST" -> {
                val requestorEmail = data["requestorEmail"] ?: "A user"
                val requestorUsername = data["requestorUsername"] ?: ""
                val familyId = data["familyId"] ?: ""
                AlexandriaPushNotificationManager.showVaultApprovalRequestNotification(
                    context = applicationContext,
                    requestorEmail = requestorEmail,
                    requestorUsername = requestorUsername,
                    familyId = familyId
                )
            }
            "VAULT_APPROVAL_CONFIRMED" -> {
                val familyId = data["familyId"] ?: ""
                AlexandriaPushNotificationManager.showMemberApprovedNotification(
                    context = applicationContext,
                    familyId = familyId
                )
            }
            else -> {
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
    }
}

/**
 * BroadcastReceiver for handling interactive "Approve" / "Reject" actions directly from System Notification buttons.
 */
class VaultActionBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val username = intent.getStringExtra(EXTRA_USERNAME) ?: return
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (notificationId != -1) {
            notificationManager.cancel(notificationId)
        }

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                if (action == ACTION_APPROVE_MEMBER) {
                    StreamingApi.service.approveVaultMember(VaultMemberActionRequest(username))
                    Log.d("VaultActionReceiver", "Member approved successfully: $username")
                } else if (action == ACTION_REJECT_MEMBER) {
                    StreamingApi.service.rejectVaultMember(VaultMemberActionRequest(username))
                    Log.d("VaultActionReceiver", "Member rejected successfully: $username")
                }
            } catch (e: Exception) {
                Log.e("VaultActionReceiver", "Failed to process vault action: $action for user $username", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        const val ACTION_APPROVE_MEMBER = "com.portfolio.videostreaming.ACTION_APPROVE_MEMBER"
        const val ACTION_REJECT_MEMBER = "com.portfolio.videostreaming.ACTION_REJECT_MEMBER"
        const val EXTRA_USERNAME = "extra_username"
        const val EXTRA_NOTIFICATION_ID = "extra_notification_id"
    }
}

/**
 * ============================================================================
 * Alexandria Push Notification Manager (Rich System Notifications)
 * ============================================================================
 * Enterprise Architecture Strategy: System Notification Builder.
 * Pre-fetches CloudFront thumbnails and constructs system notifications
 * with interactive approval action buttons.
 */
object AlexandriaPushNotificationManager {

    private const val CHANNEL_ID = "alexandria_publish_channel"
    private const val CHANNEL_NAME = "Family Vault Video Updates"

    private const val APPROVAL_CHANNEL_ID = "alexandria_vault_approval_channel"
    private const val APPROVAL_CHANNEL_NAME = "Vault Membership Requests"

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
     * Displays a system notification for incoming Vault Membership Requests with "Approve" and "Reject" action buttons.
     */
    fun showVaultApprovalRequestNotification(
        context: Context,
        requestorEmail: String,
        requestorUsername: String,
        familyId: String
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channel = NotificationChannel(
            APPROVAL_CHANNEL_ID,
            APPROVAL_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications when a user requests to join your family vault"
        }
        notificationManager.createNotificationChannel(channel)

        val notificationId = (System.currentTimeMillis() % 10000).toInt()

        val mainIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val mainPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val approveIntent = Intent(context, VaultActionBroadcastReceiver::class.java).apply {
            action = VaultActionBroadcastReceiver.ACTION_APPROVE_MEMBER
            putExtra(VaultActionBroadcastReceiver.EXTRA_USERNAME, requestorUsername)
            putExtra(VaultActionBroadcastReceiver.EXTRA_NOTIFICATION_ID, notificationId)
        }
        val approvePendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId * 10 + 1,
            approveIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val rejectIntent = Intent(context, VaultActionBroadcastReceiver::class.java).apply {
            action = VaultActionBroadcastReceiver.ACTION_REJECT_MEMBER
            putExtra(VaultActionBroadcastReceiver.EXTRA_USERNAME, requestorUsername)
            putExtra(VaultActionBroadcastReceiver.EXTRA_NOTIFICATION_ID, notificationId)
        }
        val rejectPendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId * 10 + 2,
            rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val bodyText = "$requestorEmail requested to join Vault $familyId"

        val notificationBuilder = NotificationCompat.Builder(context, APPROVAL_CHANNEL_ID)
            .setSmallIcon(R.drawable.logo_flat)
            .setContentTitle("New Vault Membership Request")
            .setContentText(bodyText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bodyText))
            .setAutoCancel(true)
            .setContentIntent(mainPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .addAction(0, "Approve", approvePendingIntent)
            .addAction(0, "Reject", rejectPendingIntent)

        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    /**
     * Displays a system notification to the requestor when their membership is approved.
     */
    fun showMemberApprovedNotification(
        context: Context,
        familyId: String
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channel = NotificationChannel(
            APPROVAL_CHANNEL_ID,
            APPROVAL_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications when your vault membership status changes"
        }
        notificationManager.createNotificationChannel(channel)

        val mainIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val mainPendingIntent = PendingIntent.getActivity(
            context,
            0,
            mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val bodyText = "Your request to join Vault $familyId has been approved."

        val notificationBuilder = NotificationCompat.Builder(context, APPROVAL_CHANNEL_ID)
            .setSmallIcon(R.drawable.logo_flat)
            .setContentTitle("Vault Access Approved!")
            .setContentText(bodyText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bodyText))
            .setAutoCancel(true)
            .setContentIntent(mainPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        val notificationId = (System.currentTimeMillis() % 10000).toInt()
        notificationManager.notify(notificationId, notificationBuilder.build())
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
