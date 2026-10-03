package com.portfolio.videostreaming.ui

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.portfolio.videostreaming.core.data.model.MediaFile
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment
import com.portfolio.videostreaming.ui.theme.Stone400
import com.portfolio.videostreaming.ui.theme.Stone900
import kotlinx.coroutines.delay

/**
 * ============================================================================
 * Family Vault Review Pane (Mobile Review Board)
 * ============================================================================
 * Enterprise Architecture Strategy: Mobile Family Review Board.
 * Displays REVIEW_PENDING media items for the user's family vault, allowing
 * family members to review Bedrock AI metadata drafts (Title, Heritage Genre, Description)
 * and publish videos directly into their catalog.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FamilyReviewPane(
    viewModel: MediaBrowserViewModel,
    onPublishedSuccess: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val reviewQueue by viewModel.reviewQueue.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    LaunchedEffect(viewModel) {
        while (true) {
            viewModel.loadReviewQueue()
            delay(30_000)
        }
    }

    var selectedVideo by remember { mutableStateOf<MediaFile?>(null) }
    var title by remember { mutableStateOf("") }
    var genre by remember { mutableStateOf("Holidays, Birthdays and Special Occasions") }
    var description by remember { mutableStateOf("") }
    var isPublishing by remember { mutableStateOf(false) }

    val heritageGenres = listOf(
        "Holidays, Birthdays and Special Occasions",
        "Daily Life",
        "Friends and Family",
        "Milestones",
        "School, Sports and Hobbies",
        "Travel and Vacation",
        "Reunions and Gatherings",
        "Miscellaneous"
    )

    Box(modifier = modifier.fillMaxSize().background(HeritageBlack).padding(16.dp)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Text(
                text = "Family Review Queue",
                color = Parchment,
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            Text(
                text = "Finalize AI-suggested metadata for your family memories.",
                color = Stone400,
                fontSize = 12.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Amber500)
                }
            } else if (errorMessage != null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = errorMessage ?: "Unable to load review queue.",
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 14.sp
                    )
                }
            } else if (selectedVideo == null) {
                if (reviewQueue.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = "No memories pending review in your vault.",
                            color = Stone400,
                            fontSize = 14.sp
                        )
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(reviewQueue, key = { it.id }) { video ->
                            val isReadyForReview = video.transcodeStatus == "REVIEW_PENDING"
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .then(if (isReadyForReview) Modifier.clickable {
                                        selectedVideo = video
                                        title = video.title
                                        genre = if (heritageGenres.contains(video.genre)) video.genre else heritageGenres[0]
                                        description = video.description
                                    } else Modifier),
                                colors = CardDefaults.cardColors(
                                    containerColor = Stone900.copy(alpha = if (isReadyForReview) 0.9f else 0.55f)
                                )
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    AsyncImage(
                                        model = video.thumbnailUrl,
                                        contentDescription = video.title,
                                        modifier = Modifier
                                            .size(width = 100.dp, height = 60.dp)
                                            .clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = video.title,
                                            color = Parchment,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = if (isReadyForReview) {
                                                "Tap to finalize AI metadata"
                                            } else {
                                                "Processing — review available when ready"
                                            },
                                            color = if (isReadyForReview) Amber500 else Stone400,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // Review Form for Selected Memory
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Stone900, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Edit Memory Details",
                        color = Amber500,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black
                    )

                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Memory Title") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Amber500)
                    )

                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("Description") },
                        modifier = Modifier.fillMaxWidth().height(100.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Amber500)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { selectedVideo = null },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Cancel", color = Stone400)
                        }

                        Button(
                            onClick = {
                                isPublishing = true
                                Toast.makeText(context, "Published \"$title\" to Family Vault!", Toast.LENGTH_SHORT).show()
                                isPublishing = false
                                selectedVideo = null
                                onPublishedSuccess()
                            },
                            enabled = !isPublishing,
                            colors = ButtonDefaults.buttonColors(containerColor = Amber500),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("PUBLISH", color = HeritageBlack, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }
}
