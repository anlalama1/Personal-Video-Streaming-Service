package com.portfolio.videostreaming

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.portfolio.videostreaming.ui.CatalogScreen
import com.portfolio.videostreaming.ui.ScreenTimeViewModel
import com.portfolio.videostreaming.ui.VideoPlayer
import com.portfolio.videostreaming.ui.VideoPlayerViewModel
import java.util.Locale
import java.util.concurrent.TimeUnit
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Senior/Lead Approach: A Sealed Class or Object for Routes.
 * This eliminates "Magic Strings" and provides a single source of truth for the whole app.
 */
sealed class Screen(val route: String) {
    object Catalog : Screen("catalog")
    object Player : Screen("player/{videoId}/{videoUri}") {
        fun createRoute(videoId: String, videoUri: String): String {
            val encoded = URLEncoder.encode(videoUri, StandardCharsets.UTF_8.toString())
            return "player/$videoId/$encoded"
        }
    }
}

class MainActivity : ComponentActivity() {

    private var hasPermission by mutableStateOf(false)

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        hasPermission = isGranted
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkAndRequestPermission()

        setContent {
            MaterialTheme {
                Box(modifier = Modifier.fillMaxSize()) {
                    Image(
                        painter = painterResource(id = R.drawable.pixel9pro_background),
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                        alpha = 0.5f
                    )
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = Color.Transparent
                    ) {
                        if (hasPermission) {
                            val screenTimeViewModel: ScreenTimeViewModel = viewModel()
                            val navController = rememberNavController()

                            val sessionSeconds by screenTimeViewModel.sessionSeconds.collectAsState()
                            val dailySeconds by screenTimeViewModel.dailySeconds.collectAsState()
                            val isCounterVisible by screenTimeViewModel.isCounterVisible.collectAsState()

                            Box(modifier = Modifier.fillMaxSize()) {
                                NavHost(navController = navController, startDestination = Screen.Catalog.route) {
                                    composable(Screen.Catalog.route) {
                                        CatalogScreen(
                                            onVideoSelected = { videoId, videoUri ->
                                                navController.navigate(Screen.Player.createRoute(videoId, videoUri))
                                            }
                                        )
                                    }
                                    composable(Screen.Player.route) { backStackEntry ->
                                        val videoId = backStackEntry.arguments?.getString("videoId") ?: ""
                                        val videoUri = backStackEntry.arguments?.getString("videoUri") ?: ""
                                        val playerViewModel: VideoPlayerViewModel = viewModel()

                                        // 1. Sync the global timer with this specific player's state
                                        val isPlaying by playerViewModel.isPlaying.collectAsState()
                                        
                                        LaunchedEffect(isPlaying) {
                                            screenTimeViewModel.setTicking(isPlaying)
                                        }

                                        // 2. Stop the timer immediately when this screen is destroyed
                                        DisposableEffect(Unit) {
                                            onDispose {
                                                screenTimeViewModel.setTicking(false)
                                            }
                                        }

                                        // Start playing as soon as we enter this screen
                                        LaunchedEffect(videoId, videoUri) {
                                            playerViewModel.playVideo(videoId, videoUri)
                                        }

                                        val currentPosition by playerViewModel.currentPosition.collectAsState()
                                        val duration by playerViewModel.duration.collectAsState()

                                        VideoPlayer(
                                            player = playerViewModel.exoPlayer,
                                            isPlaying = isPlaying,
                                            currentPosition = currentPosition,
                                            duration = duration,
                                            isScreenTimeVisible = isCounterVisible,
                                            onTogglePlay = { playerViewModel.togglePlay() },
                                            onSeek = { playerViewModel.seekTo(it) },
                                            onRewind = { playerViewModel.rewind() },
                                            onForward = { playerViewModel.forward() },
                                            onBack = { navController.popBackStack() },
                                            onToggleScreenTime = { screenTimeViewModel.toggleVisibility() },
                                            modifier = Modifier.fillMaxSize()
                                        )
                                    }
                                }

                                // Parental Screen Time Overlay
                                AnimatedVisibility(
                                    visible = isCounterVisible,
                                    enter = fadeIn(),
                                    exit = fadeOut(),
                                    modifier = Modifier
                                        .align(Alignment.TopCenter)
                                        .padding(16.dp)
                                ) {
                                    Text(
                                        text = "Session: ${formatSeconds(sessionSeconds)} | Daily: ${formatSeconds(dailySeconds)}",
                                        color = Color.White.copy(alpha = 0.5f),
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        } else {
                            // In a real app, we'd show a UI to explain why we need permission
                        }
                    }
                }
            }
        }
    }

    private fun checkAndRequestPermission() {
        val permission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_VIDEO
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }

        if (ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED) {
            hasPermission = true
        } else {
            requestPermissionLauncher.launch(permission)
        }
    }

    private fun formatSeconds(totalSeconds: Long): String {
        val minutes = TimeUnit.SECONDS.toMinutes(totalSeconds)
        val seconds = totalSeconds % 60
        return String.format(Locale.getDefault(), "%02dm %02ds", minutes, seconds)
    }
}
