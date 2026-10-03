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
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.portfolio.videostreaming.ui.CatalogScreen
import com.portfolio.videostreaming.ui.FamilyReviewPane
import com.portfolio.videostreaming.ui.IngestViewModel
import com.portfolio.videostreaming.ui.LocalVideoPicker
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
import com.portfolio.videostreaming.ui.components.AlexandriaBottomBar
import com.portfolio.videostreaming.ui.components.AlexandriaNavbar
import com.portfolio.videostreaming.ui.components.BottomNavItem
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
    object LocalPicker : Screen("local_picker")
    object FamilyReview : Screen("family_review")
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
 * Hosts declarative navigation graph, bottom navigation bar, and screen routing.
 */
class MainActivity : ComponentActivity() {

    private var hasPermission by mutableStateOf(false)

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        hasPermission = isGranted
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
                    }
                }
            }
        }
    }

    /**
     * Authenticated Navigation Shell containing Global Header Navbar, Bottom Bar, and Screen Graph.
     */
    @Composable
    private fun MainAppContent(authViewModel: AuthViewModel) {
        val screenTimeViewModel: ScreenTimeViewModel = viewModel()
        val mediaBrowserViewModel: MediaBrowserViewModel = viewModel()
        val ingestViewModel: IngestViewModel = viewModel()
        val navController = rememberNavController()

        val sessionSeconds by screenTimeViewModel.sessionSeconds.collectAsState()
        val dailySeconds by screenTimeViewModel.dailySeconds.collectAsState()
        val isCounterVisible by screenTimeViewModel.isCounterVisible.collectAsState()

        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = navBackStackEntry?.destination?.route
        val isPlayerScreen = currentRoute?.startsWith("player") == true

        DisposableEffect(isPlayerScreen) {
            val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
            windowInsetsController.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

            if (isPlayerScreen) {
                windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                windowInsetsController.show(WindowInsetsCompat.Type.systemBars())
            }

            onDispose {
                windowInsetsController.show(WindowInsetsCompat.Type.systemBars())
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.fillMaxSize()) {
                if (!isPlayerScreen) {
                    AlexandriaNavbar(
                        authViewModel = authViewModel,
                        onNavigateHome = {
                            if (currentRoute != Screen.Catalog.route) {
                                navController.navigate(Screen.Catalog.route) {
                                    popUpTo(Screen.Catalog.route) { inclusive = true }
                                }
                            }
                        }
                    )
                }

                NavHost(
                    navController = navController,
                    startDestination = Screen.Catalog.route,
                    modifier = Modifier
                        .weight(1f)
                        .then(if (isPlayerScreen) Modifier else Modifier.navigationBarsPadding())
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
                    composable(Screen.LocalPicker.route) {
                        LocalVideoPicker(
                            onUploadSuccess = {
                                navController.navigate(Screen.FamilyReview.route)
                            },
                            ingestViewModel = ingestViewModel
                        )
                    }
                    composable(Screen.FamilyReview.route) {
                        FamilyReviewPane(
                            viewModel = mediaBrowserViewModel,
                            onPublishedSuccess = {
                                mediaBrowserViewModel.loadVideos()
                                navController.navigate(Screen.Catalog.route)
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

                        LaunchedEffect(viewState.isPlaying) {
                            screenTimeViewModel.setTicking(viewState.isPlaying)
                        }

                        DisposableEffect(Unit) {
                            onDispose {
                                screenTimeViewModel.setTicking(false)
                            }
                        }

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

                // Render Bottom Navigation Bar (hidden on cinematic player)
                if (!isPlayerScreen) {
                    AlexandriaBottomBar(
                        currentRoute = currentRoute,
                        onNavigate = { item ->
                            when (item) {
                                is BottomNavItem.Home -> {
                                    if (currentRoute != Screen.Catalog.route) {
                                        navController.navigate(Screen.Catalog.route) {
                                            popUpTo(Screen.Catalog.route) { inclusive = true }
                                        }
                                    }
                                }
                                is BottomNavItem.Add -> {
                                    if (currentRoute != Screen.LocalPicker.route) {
                                        navController.navigate(Screen.LocalPicker.route)
                                    }
                                }
                                is BottomNavItem.Review -> {
                                    if (currentRoute != Screen.FamilyReview.route) {
                                        navController.navigate(Screen.FamilyReview.route)
                                    }
                                }
                                is BottomNavItem.Profile -> {
                                    // Profile opens account modal
                                }
                            }
                        }
                    )
                }
            }

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
