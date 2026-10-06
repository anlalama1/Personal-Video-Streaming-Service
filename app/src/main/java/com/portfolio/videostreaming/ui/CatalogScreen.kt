package com.portfolio.videostreaming.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.portfolio.videostreaming.core.data.Config
import com.portfolio.videostreaming.core.data.model.MediaFile
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment
import com.portfolio.videostreaming.ui.theme.Stone400
import com.portfolio.videostreaming.ui.theme.Stone900

/**
 * ============================================================================
 * Netflix-Style Heritage Catalog Screen
 * ============================================================================
 * Enterprise Architecture Strategy: Nested Lazy Rows & Category Grouping.
 * Dynamically groups published family media files into horizontal scrolling
 * category rows using the genres configured in the DynamoDB registry, featuring
 * a premier top "Recently Added" category row for newly published memories.
 */
@Composable
fun CatalogScreen(
    onVideoSelected: (MediaFile) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: MediaBrowserViewModel = viewModel()
) {
    val videoList by viewModel.videoList.collectAsState()
    val genres by viewModel.genres.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    Box(modifier = modifier.fillMaxSize()) {
        if (isLoading) {
            CircularProgressIndicator(color = Amber500, modifier = Modifier.align(Alignment.Center))
        } else if (errorMessage != null) {
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(text = errorMessage!!, color = Color.Red, modifier = Modifier.padding(bottom = 16.dp))
                Button(onClick = { viewModel.loadVideos() }) {
                    Text("Retry")
                }
            }
        } else if (videoList.isEmpty()) {
            Text(
                text = "Cloud Family Vault is Empty.",
                color = Parchment.copy(alpha = 0.6f),
                modifier = Modifier.align(Alignment.Center)
            )
        } else {
            // Clock-Drift Proof Recency Filter: Evaluated relative to the latest upload in the vault
            val maxLastUpdated = videoList.maxOfOrNull { it.lastUpdated } ?: 0L
            val recencyThresholdMs = Config.RECENTLY_ADDED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000L

            val recentlyAddedVideos = if (maxLastUpdated > 0L) {
                videoList.filter { video ->
                    video.lastUpdated > 0L && (maxLastUpdated - video.lastUpdated) <= recencyThresholdMs
                }.sortedByDescending { it.lastUpdated }
            } else {
                videoList.take(5)
            }

            // Resilient Category Grouping: Ensure all published videos are grouped by genre
            val allGenres = (genres + videoList.map { it.genre }).distinct().filter { it.isNotBlank() }
            val groupedVideos = allGenres.mapNotNull { genreName ->
                videoList.filter { it.genre == genreName }
                    .takeIf { it.isNotEmpty() }
                    ?.let { genreName to it }
            }

            if (groupedVideos.isEmpty() && recentlyAddedVideos.isEmpty()) {
                Text(
                    text = "No videos match the configured genres.",
                    color = Parchment.copy(alpha = 0.6f),
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(vertical = 16.dp)
                ) {
                    // Premier Top Category Row: Recently Added
                    if (recentlyAddedVideos.isNotEmpty()) {
                        item {
                            Column(modifier = Modifier.padding(vertical = 12.dp)) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(width = 4.dp, height = 20.dp)
                                            .clip(RoundedCornerShape(2.dp))
                                            .background(Amber500)
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(
                                        text = "Recently Added",
                                        color = Parchment,
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = (-0.5).sp
                                    )
                                }

                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 24.dp),
                                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                                ) {
                                    items(recentlyAddedVideos, key = { "recent_${it.id}" }) { video ->
                                        CategoryVideoCard(
                                            video = video,
                                            onClick = { onVideoSelected(video) }
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Heritage Genre Category Rows
                    groupedVideos.forEach { (genreName, videosInGenre) ->
                        item {
                            Column(modifier = Modifier.padding(vertical = 12.dp)) {
                                // Category Row Header Title
                                Row(
                                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(width = 4.dp, height = 20.dp)
                                            .clip(RoundedCornerShape(2.dp))
                                            .background(Amber500)
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(
                                        text = genreName,
                                        color = Parchment,
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = (-0.5).sp
                                    )
                                }

                                // Horizontal Scrollable Category Row (LazyRow)
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 24.dp),
                                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                                ) {
                                    items(videosInGenre) { video ->
                                        CategoryVideoCard(
                                            video = video,
                                            onClick = { onVideoSelected(video) }
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
}

/**
 * Individual Category Video Card rendered inside horizontal LazyRow carousels.
 */
@Composable
fun CategoryVideoCard(
    video: MediaFile,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .width(220.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = Stone900.copy(alpha = 0.9f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(124.dp)
            ) {
                AsyncImage(
                    model = video.thumbnailUrl,
                    contentDescription = "Thumbnail for ${video.title}",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color.Transparent, HeritageBlack.copy(alpha = 0.8f))
                            )
                        )
                )
            }
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = video.title,
                    color = Parchment,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = video.releaseYear.toString(),
                        color = Stone400,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}
