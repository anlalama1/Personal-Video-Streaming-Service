package com.portfolio.videostreaming.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.portfolio.videostreaming.core.data.model.MediaFile
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment
import com.portfolio.videostreaming.ui.theme.Stone400
import com.portfolio.videostreaming.ui.theme.Stone900

data class RankedVideoMatch(
    val video: MediaFile,
    val priority: Int, // 1 = Title Prefix, 2 = Title Substring, 3 = Description Match
    val matchType: String
)

/**
 * ============================================================================
 * Ranked Video Search Engine Overlay Dialog
 * ============================================================================
 * Enterprise Architecture Strategy: Client-Side Ranked Search Engine.
 * Evaluates live search queries over the family vault catalog with 3-tier priority ranking:
 * Priority 1: Title Prefix Match
 * Priority 2: Title Substring Match
 * Priority 3: Description Match
 * Constrained by 3-character minimum query gating and bounded to top 10 matches.
 */
@Composable
fun VideoSearchDialog(
    catalog: List<MediaFile>,
    onDismiss: () -> Unit,
    onVideoSelected: (MediaFile) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }

    // Priority Search Ranking Evaluation
    val rankedResults = remember(searchQuery, catalog) {
        val q = searchQuery.trim().lowercase()
        if (q.length < 3) return@remember emptyList()

        val matches = mutableListOf<RankedVideoMatch>()

        catalog.forEach { video ->
            val titleLower = video.title.lowercase()
            val descLower = video.description.lowercase()

            when {
                titleLower.startsWith(q) -> matches.add(RankedVideoMatch(video, 1, "Title Start Match"))
                titleLower.contains(q) -> matches.add(RankedVideoMatch(video, 2, "Title Substring Match"))
                descLower.contains(q) -> matches.add(RankedVideoMatch(video, 3, "Description Match"))
            }
        }

        matches.sortedWith(compareBy<RankedVideoMatch> { it.priority }.thenBy { it.video.title })
            .take(10)
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = HeritageBlack
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .padding(20.dp)
            ) {
                // Header Bar & Close Button
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Search, contentDescription = null, tint = Amber500, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Live Vault Media Search",
                            color = Parchment,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black
                        )
                    }

                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close Search", tint = Stone400)
                    }
                }

                // Search Input TextField
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search titles or descriptions (min 3 letters)...", color = Stone400) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", tint = Stone400)
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Amber500,
                        unfocusedBorderColor = Stone900,
                        focusedContainerColor = Stone900,
                        unfocusedContainerColor = Stone900,
                        focusedTextColor = Parchment,
                        unfocusedTextColor = Parchment
                    ),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Type at least 3 letters to view live ranked matches (Prefix > Title > Description).",
                    color = Stone400,
                    fontSize = 11.sp
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Results Container Area
                Box(modifier = Modifier.fillMaxSize()) {
                    val trimmedLen = searchQuery.trim().length

                    when {
                        trimmedLen in 1..2 -> {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Please type at least ${3 - trimmedLen} more letter(s) to evaluate vault matches.",
                                    color = Amber500,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        trimmedLen >= 3 && rankedResults.isEmpty() -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No media titles or descriptions matched \"$searchQuery\".",
                                    color = Stone400,
                                    fontSize = 13.sp
                                )
                            }
                        }
                        trimmedLen >= 3 -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                item {
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "RANKED MATCHES (${rankedResults.size} OF 10 MAX)",
                                            color = Stone400,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Black,
                                            letterSpacing = 1.sp
                                        )
                                        Text(
                                            text = "KEYSTROKE LIVE",
                                            color = Amber500,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            letterSpacing = 1.sp
                                        )
                                    }
                                }

                                items(rankedResults, key = { it.video.id }) { match ->
                                    Card(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(16.dp))
                                            .clickable {
                                                onVideoSelected(match.video)
                                            },
                                        colors = CardDefaults.cardColors(containerColor = Stone900)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            AsyncImage(
                                                model = match.video.thumbnailUrl,
                                                contentDescription = match.video.title,
                                                modifier = Modifier
                                                    .size(width = 90.dp, height = 54.dp)
                                                    .clip(RoundedCornerShape(8.dp)),
                                                contentScale = ContentScale.Crop
                                            )

                                            Spacer(modifier = Modifier.width(12.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = match.video.title,
                                                    color = Parchment,
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )

                                                Spacer(modifier = Modifier.height(4.dp))

                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Box(
                                                        modifier = Modifier
                                                            .background(Amber500.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                                            .border(1.dp, Amber500.copy(alpha = 0.3f), RoundedCornerShape(4.dp))
                                                    ) {
                                                        Text(
                                                            text = match.matchType,
                                                            color = Amber500,
                                                            fontSize = 9.sp,
                                                            fontWeight = FontWeight.Black
                                                        )
                                                    }

                                                    Spacer(modifier = Modifier.width(8.dp))

                                                    Text(
                                                        text = "${match.video.genre} • ${match.video.releaseYear}",
                                                        color = Stone400,
                                                        fontSize = 11.sp
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
        }
    }
}
