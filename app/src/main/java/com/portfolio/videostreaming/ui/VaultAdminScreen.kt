package com.portfolio.videostreaming.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.portfolio.videostreaming.core.data.model.MediaFile
import com.portfolio.videostreaming.core.data.network.StreamingApi
import com.portfolio.videostreaming.core.data.network.VaultMemberActionRequest
import com.portfolio.videostreaming.core.data.network.VaultMemberDto
import com.portfolio.videostreaming.core.data.network.VaultVideoMetadataRequest
import com.portfolio.videostreaming.ui.auth.AuthViewModel
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.Parchment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private enum class VaultAdminTab(val label: String) {
    ROSTER("Members"),
    REQUESTS("Requests"),
    VIDEOS("Videos")
}

@Composable
fun VaultAdminScreen(
    authViewModel: AuthViewModel,
    mediaBrowserViewModel: MediaBrowserViewModel
) {
    val familyId by authViewModel.familyId.collectAsState()
    val scope = rememberCoroutineScope()
    var members by remember { mutableStateOf<List<VaultMemberDto>>(emptyList()) }
    var videos by remember { mutableStateOf<List<MediaFile>>(emptyList()) }
    var selectedTab by remember { mutableStateOf(VaultAdminTab.ROSTER) }
    var selectedVideo by remember { mutableStateOf<MediaFile?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }

    fun refresh() {
        scope.launch {
            isLoading = true
            error = null
            try {
                members = withContext(Dispatchers.IO) { StreamingApi.service.getVaultMembers() }
                videos = withContext(Dispatchers.IO) {
                    StreamingApi.service.getVaultCatalog()
                        .filter { it.familyId == familyId }
                        .map { dto ->
                            MediaFile(
                                id = dto.videoId,
                                title = dto.title,
                                genre = dto.genre,
                                releaseYear = dto.releaseYear.toIntOrNull() ?: 0,
                                thumbnailUrl = dto.thumbnailUrl,
                                videoUrl = dto.videoUrl,
                                description = dto.description.orEmpty(),
                                tags = dto.tags.orEmpty(),
                                transcodeStatus = dto.transcodeStatus,
                                useAi = dto.useAi,
                                familyId = dto.familyId,
                                videoKey = dto.videoKey
                            )
                        }
                }
                mediaBrowserViewModel.loadVideos()
            } catch (exception: Exception) {
                error = exception.localizedMessage ?: "Unable to load family vault governance data."
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(familyId) {
        refresh()
    }

    fun memberAction(member: VaultMemberDto, action: String) {
        scope.launch {
            error = null
            notice = null
            try {
                withContext(Dispatchers.IO) {
                    val request = VaultMemberActionRequest(member.username)
                    when (action) {
                        "approve" -> StreamingApi.service.approveVaultMember(request)
                        "promote" -> StreamingApi.service.promoteVaultMember(request)
                        "demote" -> StreamingApi.service.demoteVaultMember(request)
                        "reject" -> StreamingApi.service.rejectVaultMember(request)
                        else -> StreamingApi.service.banVaultMember(request)
                    }
                }
                notice = when (action) {
                    "approve" -> "Member access approved."
                    "promote" -> "Member promoted to administrator."
                    "demote" -> "Administrator privileges removed."
                    "reject" -> "Membership request rejected."
                    else -> "Member access disabled."
                }
                members = withContext(Dispatchers.IO) { StreamingApi.service.getVaultMembers() }
            } catch (exception: Exception) {
                error = exception.localizedMessage ?: "The member action failed."
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("VAULT ADMINISTRATION", color = Amber500, fontSize = 12.sp, fontWeight = FontWeight.Black)
                Text("Family: ${familyId ?: "Unknown"}", color = Parchment, fontSize = 14.sp)
            }
            TextButton(onClick = ::refresh) { Text("Refresh", color = Amber500) }
        }

        if (error != null) Text(error.orEmpty(), color = Color.Red, fontSize = 13.sp)
        if (notice != null) Text(notice.orEmpty(), color = Amber500, fontSize = 13.sp)
        if (isLoading) CircularProgressIndicator(color = Amber500)

        PrimaryTabRow(selectedTabIndex = selectedTab.ordinal) {
            VaultAdminTab.entries.forEachIndexed { index, tab ->
                Tab(
                    selected = selectedTab.ordinal == index,
                    onClick = { selectedTab = tab },
                    text = { Text(tab.label) }
                )
            }
        }

        when (selectedTab) {
            VaultAdminTab.ROSTER, VaultAdminTab.REQUESTS -> {
                val visibleMembers = members.filter { member ->
                    if (selectedTab == VaultAdminTab.REQUESTS) !member.isApproved && member.enabled
                    else true
                }
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(visibleMembers, key = { it.username }) { member ->
                        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                            Text(member.email.ifBlank { member.username }, color = Parchment, fontWeight = FontWeight.Bold)
                            Text(
                                when {
                                    !member.enabled -> "Disabled"
                                    member.isAdmin -> "Administrator"
                                    member.isApproved -> "Approved member"
                                    else -> "Awaiting approval"
                                },
                                color = Amber500,
                                fontSize = 12.sp
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (!member.isApproved && member.enabled) {
                                    OutlinedButton(onClick = { memberAction(member, "approve") }) { Text("Approve") }
                                    OutlinedButton(onClick = { memberAction(member, "reject") }) { Text("Reject") }
                                }
                                if (!member.isAdmin && member.isApproved && member.enabled) {
                                    OutlinedButton(onClick = { memberAction(member, "promote") }) { Text("Promote") }
                                } else if (member.isAdmin && !member.isCurrentUser && member.enabled) {
                                    OutlinedButton(onClick = { memberAction(member, "demote") }) { Text("Demote") }
                                }
                                if (!member.isCurrentUser && (member.isApproved || member.isAdmin) && member.enabled) {
                                    OutlinedButton(onClick = { memberAction(member, "ban") }) { Text("Ban") }
                                }
                            }
                        }
                    }
                }
            }
            VaultAdminTab.VIDEOS -> {
                val familyVideos = videos
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(familyVideos, key = { it.id }) { video ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(video.title, color = Parchment, fontWeight = FontWeight.Bold)
                                Text("${video.genre} · ${video.releaseYear}", color = Amber500, fontSize = 12.sp)
                            }
                            OutlinedButton(onClick = { selectedVideo = video }) { Text("Edit") }
                            TextButton(onClick = {
                                scope.launch {
                                    try {
                                        withContext(Dispatchers.IO) {
                                            StreamingApi.service.deleteVaultVideo(video.id, video.familyId)
                                        }
                                        notice = "Video moved to trash."
                                        refresh()
                                    } catch (exception: Exception) {
                                        error = exception.localizedMessage ?: "Unable to delete video."
                                    }
                                }
                            }) { Text("Delete", color = Color.Red) }
                        }
                    }
                }
            }
        }
    }

    selectedVideo?.let { video ->
        VideoMetadataDialog(
            video = video,
            onDismiss = { selectedVideo = null },
            onSave = { updated ->
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) {
                            StreamingApi.service.updateVaultVideo(
                                video.id,
                                VaultVideoMetadataRequest(
                                    title = updated.title,
                                    genre = updated.genre,
                                    releaseYear = updated.releaseYear.toString(),
                                    description = updated.description,
                                    tags = updated.tags
                                )
                            )
                        }
                        selectedVideo = null
                        notice = "Video metadata updated."
                        refresh()
                    } catch (exception: Exception) {
                        error = exception.localizedMessage ?: "Unable to update video metadata."
                    }
                }
            }
        )
    }
}

@Composable
private fun VideoMetadataDialog(
    video: MediaFile,
    onDismiss: () -> Unit,
    onSave: (MediaFile) -> Unit
) {
    var title by remember(video.id) { mutableStateOf(video.title) }
    var genre by remember(video.id) { mutableStateOf(video.genre) }
    var releaseYear by remember(video.id) { mutableStateOf(video.releaseYear.toString()) }
    var description by remember(video.id) { mutableStateOf(video.description) }
    var tags by remember(video.id) { mutableStateOf(video.tags.joinToString(", ")) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit video metadata") },
        text = {
            Column {
                OutlinedTextField(title, { title = it }, label = { Text("Title") })
                OutlinedTextField(genre, { genre = it }, label = { Text("Genre") })
                OutlinedTextField(releaseYear, { releaseYear = it }, label = { Text("Release year") })
                OutlinedTextField(description, { description = it }, label = { Text("Description") })
                OutlinedTextField(tags, { tags = it }, label = { Text("Tags, comma separated") })
                Spacer(Modifier.height(4.dp))
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(video.copy(
                        title = title,
                        genre = genre,
                        releaseYear = releaseYear.toIntOrNull() ?: video.releaseYear,
                        description = description,
                        tags = tags.split(',').map(String::trim).filter(String::isNotEmpty)
                    ))
                },
                enabled = title.isNotBlank() && genre.isNotBlank() && releaseYear.toIntOrNull() != null
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
