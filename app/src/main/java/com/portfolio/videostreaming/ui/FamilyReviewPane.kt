package com.portfolio.videostreaming.ui

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
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
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

/**
 * ============================================================================
 * Family Vault Review Pane (Mobile Review Board)
 * ============================================================================
 * Enterprise Architecture Strategy: Mobile Family Review Board.
 * Displays REVIEW_PENDING media items for the user's family vault, allowing
 * family members to review upload metadata (Title, Heritage Genre, Description)
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
    val registeredGenres by viewModel.genres.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(viewModel) {
        while (true) {
            viewModel.loadReviewQueue()
            delay(30.seconds)
        }
    }

    var selectedVideo by remember { mutableStateOf<MediaFile?>(null) }
    var title by remember { mutableStateOf("") }
    var genre by remember { mutableStateOf("Holidays, Birthdays and Special Occasions") }
    var description by remember { mutableStateOf("") }
    var isPublishing by remember { mutableStateOf(false) }
    var isGenreMenuExpanded by remember { mutableStateOf(false) }
    var showRejectConfirmation by remember { mutableStateOf(false) }

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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Family Review Queue",
                    color = Parchment,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black
                )
                IconButton(
                    onClick = { viewModel.loadReviewQueue() },
                    enabled = !isLoading
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Amber500,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh review queue",
                            tint = Amber500
                        )
                    }
                }
            }
            Text(
                text = "Review and finalize metadata for your family memories.",
                color = Stone400,
                fontSize = 12.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            if (isLoading && reviewQueue.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Amber500)
                }
            } else if (errorMessage != null && reviewQueue.isEmpty()) {
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
                                        title = if (video.useAi) video.aiTitle.ifBlank { video.title } else video.title
                                        val suggestedGenre = if (video.useAi) {
                                            video.aiGenre.ifBlank { video.genre }
                                        } else {
                                            video.genre
                                        }
                                        genre = when {
                                            registeredGenres.contains(suggestedGenre) -> suggestedGenre
                                            registeredGenres.isNotEmpty() -> registeredGenres.first()
                                            heritageGenres.contains(suggestedGenre) -> suggestedGenre
                                            else -> heritageGenres.first()
                                        }
                                        description = if (video.useAi) {
                                            video.aiDescription.ifBlank { video.description }
                                        } else {
                                            video.description
                                        }
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
                                            text = if (video.useAi) video.aiTitle.ifBlank { video.title } else video.title,
                                            color = Parchment,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = if (isReadyForReview) {
                                                if (video.useAi) "Tap to review AI metadata" else "Tap to review memory"
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
                // Review Form for Selected Memory (Scrollable so buttons are never clipped)
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Stone900, RoundedCornerShape(16.dp))
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Edit Memory Details",
                        color = Amber500,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )

                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Memory Title") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Amber500,
                            unfocusedBorderColor = Stone400,
                            focusedLabelColor = Amber500,
                            unfocusedLabelColor = Stone400,
                            focusedTextColor = Parchment,
                            unfocusedTextColor = Parchment
                        )
                    )

                    Box {
                        OutlinedButton(
                            onClick = { isGenreMenuExpanded = true },
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            border = BorderStroke(1.dp, Stone400)
                        ) {
                            Text(
                                text = "Genre: $genre",
                                color = Parchment,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f)
                            )
                            Text("▼", color = Amber500)
                        }
                        DropdownMenu(
                            expanded = isGenreMenuExpanded,
                            onDismissRequest = { isGenreMenuExpanded = false }
                        ) {
                            (registeredGenres.ifEmpty { heritageGenres }).forEach { option ->
                                DropdownMenuItem(
                                    text = { Text(option) },
                                    onClick = {
                                        genre = option
                                        isGenreMenuExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("Description (Optional)") },
                        modifier = Modifier.fillMaxWidth().height(110.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Amber500,
                            unfocusedBorderColor = Stone400,
                            focusedLabelColor = Amber500,
                            unfocusedLabelColor = Stone400,
                            focusedTextColor = Parchment,
                            unfocusedTextColor = Parchment
                        )
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Highly Visible Action Button Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // REJECT BUTTON
                        OutlinedButton(
                            onClick = { showRejectConfirmation = true },
                            enabled = !isPublishing,
                            modifier = Modifier.weight(1f).height(50.dp),
                            border = BorderStroke(1.dp, Color.Red.copy(alpha = 0.7f)),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = Color.Red.copy(alpha = 0.1f)
                            ),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text(
                                "REJECT",
                                color = Color.Red,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black
                            )
                        }

                        // CANCEL BUTTON
                        OutlinedButton(
                            onClick = { selectedVideo = null },
                            enabled = !isPublishing,
                            modifier = Modifier.weight(1f).height(50.dp),
                            border = BorderStroke(1.dp, Parchment.copy(alpha = 0.4f)),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = HeritageBlack.copy(alpha = 0.5f)
                            ),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text(
                                "CANCEL",
                                color = Parchment,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // PUBLISH BUTTON
                        Button(
                            onClick = {
                                val videoToPublish = selectedVideo ?: return@Button
                                coroutineScope.launch {
                                    isPublishing = true
                                    try {
                                        viewModel.publishReview(
                                            video = videoToPublish,
                                            title = title.trim(),
                                            genre = genre,
                                            releaseYear = videoToPublish.releaseYear.toString(),
                                            description = description.trim()
                                        )
                                        Toast.makeText(
                                            context,
                                            "Published \"$title\" to Family Vault!",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                        selectedVideo = null
                                        onPublishedSuccess()
                                    } catch (exception: Exception) {
                                        Toast.makeText(
                                            context,
                                            "Publish failed: ${exception.localizedMessage ?: "Please try again."}",
                                            Toast.LENGTH_LONG
                                        ).show()
                                    } finally {
                                        isPublishing = false
                                    }
                                }
                            },
                            enabled = !isPublishing && title.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Amber500,
                                contentColor = HeritageBlack,
                                disabledContainerColor = Stone400.copy(alpha = 0.3f),
                                disabledContentColor = Parchment.copy(alpha = 0.4f)
                            ),
                            modifier = Modifier.weight(1f).height(50.dp),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            if (isPublishing) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    color = HeritageBlack,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(
                                    "PUBLISH",
                                    color = HeritageBlack,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }

                if (showRejectConfirmation) {
                    AlertDialog(
                        onDismissRequest = { showRejectConfirmation = false },
                        containerColor = HeritageBlack,
                        shape = RoundedCornerShape(20.dp),
                        title = { Text("Reject this memory?", color = Parchment, fontWeight = FontWeight.Black) },
                        text = { Text("This permanently removes the review entry from your family vault.", color = Stone400) },
                        confirmButton = {
                            TextButton(
                                enabled = !isPublishing,
                                onClick = {
                                    val videoToReject = selectedVideo ?: return@TextButton
                                    coroutineScope.launch {
                                        isPublishing = true
                                        try {
                                            viewModel.rejectReview(videoToReject)
                                            Toast.makeText(context, "Memory rejected.", Toast.LENGTH_SHORT).show()
                                            selectedVideo = null
                                            showRejectConfirmation = false
                                            viewModel.loadReviewQueue()
                                        } catch (exception: Exception) {
                                            Toast.makeText(
                                                context,
                                                "Reject failed: ${exception.localizedMessage ?: "Please try again."}",
                                                Toast.LENGTH_LONG
                                            ).show()
                                        } finally {
                                            isPublishing = false
                                        }
                                    }
                                }
                            ) {
                                Text("REJECT", color = Color.Red, fontWeight = FontWeight.Black)
                            }
                        },
                        dismissButton = {
                            TextButton(onClick = { showRejectConfirmation = false }) {
                                Text("CANCEL", color = Stone400, fontWeight = FontWeight.Bold)
                            }
                        }
                    )
                }
            }
        }
    }
}
