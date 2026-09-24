package com.portfolio.videostreaming

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.portfolio.videostreaming.ui.CatalogScreen
import com.portfolio.videostreaming.ui.MediaBrowserViewModel
import com.portfolio.videostreaming.ui.MediaDetailsScreen
import com.portfolio.videostreaming.ui.PlayerIntent
import com.portfolio.videostreaming.ui.ScreenTimeViewModel
import com.portfolio.videostreaming.ui.VideoPlayer
import com.portfolio.videostreaming.ui.VideoPlayerViewModel
import com.portfolio.videostreaming.ui.auth.AuthState
import com.portfolio.videostreaming.ui.auth.AuthViewModel
import com.portfolio.videostreaming.ui.auth.LoginScreen
import com.portfolio.videostreaming.ui.auth.SignupScreen
import com.portfolio.videostreaming.ui.components.AlexandriaNavbar
import com.portfolio.videostreaming.ui.theme.AlexandriaTheme
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import java.util.Locale
import java.util.concurrent.TimeUnit
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Navigation Destination Routes.
 */
sealed class Screen(val route: String) {
    object Catalog : Screen("catalog")
    object Details : Screen("details")
    object Login : Screen("login")
    object Signup : Screen("signup")
    object Player : Screen("player/{videoId}/{videoUri}") {
        fun createRoute(videoId: String, videoUri: String): String {
            val encoded = URLEncoder.encode(videoUri, StandardCharsets.UTF_8.toString())
            return "player/$videoId/$encoded"
        }
    }
}

/**
 * ============================================================================
 * MainActivity - Single-Activity Jetpack Compose Architecture
 * ============================================================================
 * Enterprise Architecture Strategy: Single-Activity Pattern.
 * Rather than hosting multiple traditional Android Activities or Fragments,
 * modern Jetpack Compose applications utilize a single Activity hosting
 * declarative Navigation graphs and Compose UI trees for reduced lifecycle complexity.
 */
class MainActivity : ComponentActivity() {

    private var hasPermission by mutableStateOf(false)

    // Modern ActivityResultContract for runtime media permissions
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        hasPermission = isGranted
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Enables Android 15 Edge-to-Edge window drawing behind system status & navigation bars
        enableEdgeToEdge()

        checkAndRequestPermission()

        setContent {
            AlexandriaTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = HeritageBlack
                ) {
                    if (hasPermission) {
                        val authViewModel: AuthViewModel = viewModel()
                        val authState by authViewModel.authState.collectAsState()

                        // Reactive Root State Machine
                        when (authState) {
                            is AuthState.SignedIn -> {
                                MainAppContent(authViewModel)
                            }
                            is AuthState.Loading -> {
                                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    CircularProgressIndicator(color = Amber500)
                                }
                            }
                            else -> {
                                val navController = rememberNavController()
                                NavHost(navController = navController, startDestination = Screen.Login.route) {
                                    composable(Screen.Login.route) {
                                        LoginScreen(
                                            viewModel = authViewModel,
                                            onNavigateToSignUp = { navController.navigate(Screen.Signup.route) }
                                        )
                                    }
                                    composable(Screen.Signup.route) {
                                        SignupScreen(
                                            viewModel = authViewModel,
                                            onNavigateToLogin = { navController.popBackStack() }
                                        )
                                    }
                                }
                            }
                        }
                    } else {
                        // Permission request state fallback
                    }
                }
            }
        }
    }

    /**
     * Authenticated Navigation Shell containing Global Header Navbar and Telemetry Overlays.
     */
    @Composable
    private fun MainAppContent(authViewModel: AuthViewModel) {
        val screenTimeViewModel: ScreenTimeViewModel = viewModel()
        val mediaBrowserViewModel: MediaBrowserViewModel = viewModel()
        val navController = rememberNavController()

        val sessionSeconds by screenTimeViewModel.sessionSeconds.collectAsState()
        val dailySeconds by screenTimeViewModel.dailySeconds.collectAsState()
        val isCounterVisible by screenTimeViewModel.isCounterVisible.collectAsState()

        // Observe current backstack destination to dynamically hide navbar during cinematic playback
        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = navBackStackEntry?.destination?.route
        val isPlayerScreen = currentRoute?.startsWith("player") == true

        Box(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Conditionally render global Alexandria Navbar (hidden on cinematic player)
                if (!isPlayerScreen) {
                    AlexandriaNavbar(onSignOut = { authViewModel.signOut() })
                }

                NavHost(
                    navController = navController,
                    startDestination = Screen.Catalog.route,
                    modifier = Modifier
                        .weight(1f)
                        .navigationBarsPadding() // Safe padding for Android navigation bar insets
                ) {
                    composable(Screen.Catalog.route) {
                        CatalogScreen(
                            viewModel = mediaBrowserViewModel,
                            onVideoSelected = { video ->
                                mediaBrowserViewModel.selectVideo(video)
                                navController.navigate(Screen.Details.route)
                            }
                        )
                    }
                    composable(Screen.Details.route) {
                        val selectedVideo by mediaBrowserViewModel.selectedVideo.collectAsState()
                        selectedVideo?.let { video ->
                            MediaDetailsScreen(
                                video = video,
                                onBack = { navController.popBackStack() },
                                onPlay = {
                                    navController.navigate(Screen.Player.createRoute(video.id, video.videoUrl))
                                }
                            )
                        }
                    }
                    composable(Screen.Player.route) { backStackEntry ->
                        val videoId = backStackEntry.arguments?.getString("videoId") ?: ""
                        val videoUri = backStackEntry.arguments?.getString("videoUri") ?: ""
                        val playerViewModel: VideoPlayerViewModel = viewModel()

                        val viewState by playerViewModel.viewState.collectAsState()

                        // Synchronize ExoPlayer playback state with Parental Screen Time tracker
                        LaunchedEffect(viewState.isPlaying) {
                            screenTimeViewModel.setTicking(viewState.isPlaying)
                        }

                        // Clean up screen time ticking when leaving player destination
                        DisposableEffect(Unit) {
                            onDispose {
                                screenTimeViewModel.setTicking(false)
                            }
                        }

                        // Load media source into ExoPlayer
                        LaunchedEffect(videoId, videoUri) {
                            playerViewModel.processIntent(PlayerIntent.LoadVideo(videoId, videoUri))
                        }

                        VideoPlayer(
                            player = playerViewModel.exoPlayer,
                            state = viewState,
                            onIntent = { playerViewModel.processIntent(it) },
                            isScreenTimeVisible = isCounterVisible,
                            onBack = { navController.popBackStack() },
                            onToggleScreenTime = { screenTimeViewModel.toggleVisibility() },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }

            // Parental Screen Time Overlay
            AnimatedVisibility(
                visible = isCounterVisible && isPlayerScreen,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 80.dp)
            ) {
                Text(
                    text = "Session: ${formatSeconds(sessionSeconds)} | Daily: ${formatSeconds(dailySeconds)}",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp
                )
            }
        }
    }

    /**
     * Checks and requests version-appropriate Android storage / media permissions.
     */
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

    /**
     * Formats raw seconds into human-readable MMm SSs format.
     */
    private fun formatSeconds(totalSeconds: Long): String {
        val minutes = TimeUnit.SECONDS.toMinutes(totalSeconds)
        val seconds = totalSeconds % 60
        return String.format(Locale.getDefault(), "%02dm %02ds", minutes, seconds)
    }
}
