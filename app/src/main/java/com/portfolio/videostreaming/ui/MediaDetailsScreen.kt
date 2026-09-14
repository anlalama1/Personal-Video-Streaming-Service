package com.portfolio.videostreaming.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.portfolio.videostreaming.core.data.model.MediaFile

@Composable
fun MediaDetailsScreen(
    video: MediaFile,
    onBack: () -> Unit,
    onPlay: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier.fillMaxSize().background(Color.Black)) {
        // Cinematic Background Backdrop
        AsyncImage(
            model = video.thumbnailUrl,
            contentDescription = null,
            modifier = Modifier
                .fillMaxSize()
                .alpha(0.4f)
                .blur(8.dp),
            contentScale = ContentScale.Crop
        )

        // Gradient Overlays for Readability
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.8f), Color.Black),
                        startY = 0f
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        ) {
            // Navigation Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.background(Color.Black.copy(alpha = 0.3f), MaterialTheme.shapes.extraLarge)
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(200.dp))

            // Content Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
            ) {
                // Metadata Badges
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF0055FF).copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = video.genre.uppercase(),
                            color = Color(0xFF4488FF),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = video.releaseYear.toString(),
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Title
                Text(
                    text = video.title,
                    style = MaterialTheme.typography.headlineLarge,
                    color = Color.White,
                    fontWeight = FontWeight.Black,
                    lineHeight = 42.sp
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Description
                Text(
                    text = video.description.ifEmpty { 
                        "Experience the digital resurrection of family heritage. A professionally preserved digital scroll, now streaming in high fidelity across your entire ecosystem."
                    },
                    color = Color.White.copy(alpha = 0.8f),
                    fontSize = 16.sp,
                    lineHeight = 24.sp,
                    modifier = Modifier.fillMaxWidth(0.9f)
                )

                Spacer(modifier = Modifier.height(40.dp))

                // Play Button
                Button(
                    onClick = onPlay,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(64.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = Color.Black,
                            modifier = Modifier.size(32.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "PLAY NOW",
                            color = Color.Black,
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp,
                            letterSpacing = 1.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Spacer(modifier = Modifier.height(100.dp))
            }
        }
    }
}
