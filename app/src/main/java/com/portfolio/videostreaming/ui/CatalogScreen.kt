package com.portfolio.videostreaming.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.portfolio.videostreaming.core.data.model.MediaFile
import com.portfolio.videostreaming.ui.theme.Blue500
import com.portfolio.videostreaming.ui.theme.Slate900
import com.portfolio.videostreaming.ui.theme.Slate400

@Composable
fun CatalogScreen(
    onVideoSelected: (MediaFile) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: MediaBrowserViewModel = viewModel()
) {
    val videoList by viewModel.videoList.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    Box(modifier = modifier.fillMaxSize()) {
        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
        } else if (errorMessage != null) {
            Column(
                modifier = Modifier.align(Alignment.Center).padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(text = errorMessage!!, color = Color.Red, modifier = Modifier.padding(bottom = 16.dp))
                Button(onClick = { viewModel.loadVideos() }) {
                    Text("Retry")
                }
            }
        } else if (videoList.isEmpty()) {
            Text(
                text = "Cloud Catalog is Empty.",
                color = Color.White.copy(alpha = 0.6f),
                modifier = Modifier.align(Alignment.Center)
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(16.dp)
            ) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 24.dp)) {
                        // Cinematic Blue Glow indicator matching 'The Scroll'
                        Box(
                            modifier = Modifier
                                .width(4.dp)
                                .height(32.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(Blue500)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "Cloud Library",
                            style = MaterialTheme.typography.headlineMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            letterSpacing = (-0.5).sp
                        )
                    }
                }
                
                items(videoList) { video ->
                    VideoItem(
                        video = video,
                        onClick = { onVideoSelected(video) }
                    )
                }
            }
        }
    }
}

@Composable
fun VideoItem(
    video: MediaFile,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = Slate900.copy(alpha = 0.8f)
        ),
        border = null // Senior Strategy: Use shadow and color instead of hard borders
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            // Senior Strategy: Use Coil for optimized image loading
            AsyncImage(
                model = video.thumbnailUrl,
                contentDescription = "Thumbnail for ${video.title}",
                modifier = Modifier
                    .size(width = 120.dp, height = 68.dp)
                    .clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Crop
            )
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column {
                Text(
                    text = video.title,
                    color = Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.2.sp
                )
                Text(
                    text = "${video.genre.uppercase()} • ${video.releaseYear}",
                    color = Slate400,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.5.sp
                )
            }
        }
    }
}
