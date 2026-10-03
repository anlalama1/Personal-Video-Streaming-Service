package com.portfolio.videostreaming.ui

import android.content.ContentUris
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.provider.MediaStore
import android.util.Log
import android.util.Size
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment
import com.portfolio.videostreaming.ui.theme.Stone400
import com.portfolio.videostreaming.ui.theme.Stone900
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale
import java.util.concurrent.TimeUnit

data class LocalVideoMedia(
    val id: Long,
    val uri: Uri,
    val name: String,
    val durationMs: Long
)

/**
 * ============================================================================
 * Local Gallery Video Picker (FamilyAlbum Style)
 * ============================================================================
 * Enterprise Architecture Strategy: Android MediaStore Querying & Batch Upload.
 * Queries device MediaStore.Video.Media to display local phone videos in a 3-column
 * previewable grid with multi-selection checkmarks for batch family vault uploads.
 */
@Composable
fun LocalVideoPicker(
    onUploadSuccess: () -> Unit,
    modifier: Modifier = Modifier,
    ingestViewModel: IngestViewModel = viewModel()
) {
    val context = LocalContext.current
    var localVideos by remember { mutableStateOf<List<LocalVideoMedia>>(emptyList()) }
    var selectedVideoIds by remember { mutableStateOf<Set<Long>>(emptySet()) }
    var isLoading by remember { mutableStateOf(true) }
    var previewVideo by remember { mutableStateOf<LocalVideoMedia?>(null) }
    val previewPlayer = remember(context) {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_ONE
        }
    }
    val currentPreviewVideoId by rememberUpdatedState(previewVideo?.id)
    val currentSelectedVideoIds by rememberUpdatedState(selectedVideoIds)

    val uploadState by ingestViewModel.uploadState.collectAsState()

    LaunchedEffect(previewVideo?.uri) {
        val uri = previewVideo?.uri
        if (uri == null) {
            previewPlayer.pause()
            previewPlayer.clearMediaItems()
        } else {
            previewPlayer.setMediaItem(MediaItem.fromUri(uri))
            previewPlayer.prepare()
            previewPlayer.playWhenReady = true
        }
    }

    DisposableEffect(previewPlayer) {
        onDispose { previewPlayer.release() }
    }

    LaunchedEffect(uploadState) {
        if (uploadState is UploadState.Success) {
            Toast.makeText(context, "All selected memories uploaded successfully!", Toast.LENGTH_LONG).show()
            ingestViewModel.resetState()
            selectedVideoIds = emptySet()
            onUploadSuccess()
        }
    }

    // Query Android MediaStore ContentResolver for local MP4 videos
    LaunchedEffect(Unit) {
        val videos = mutableListOf<LocalVideoMedia>()
        val projection = arrayOf(
            MediaStore.Video.Media._ID,
            MediaStore.Video.Media.DISPLAY_NAME,
            MediaStore.Video.Media.DURATION
        )

        try {
            context.contentResolver.query(
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                "${MediaStore.Video.Media.DATE_ADDED} DESC"
            )?.use { cursor ->
                val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
                val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)
                val durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION)

                while (cursor.moveToNext()) {
                    val id = cursor.getLong(idColumn)
                    val name = cursor.getString(nameColumn) ?: "Video_$id"
                    val duration = cursor.getLong(durationColumn)
                    val contentUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)

                    videos.add(LocalVideoMedia(id, contentUri, name, duration))
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        localVideos = videos
        isLoading = false
    }

    Box(modifier = modifier.fillMaxSize().background(HeritageBlack).padding(16.dp)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                    Text(
                        text = "Pick Local Memories",
                        color = Parchment,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "${selectedVideoIds.size} of ${localVideos.size} videos selected (hold to preview)",
                        color = Stone400,
                        fontSize = 12.sp
                    )
                }

                if (selectedVideoIds.isNotEmpty()) {
                    Button(
                        onClick = {
                            val selectedUris = localVideos.filter { selectedVideoIds.contains(it.id) }.map { it.uri }
                            ingestViewModel.uploadSelectedVideos(context, selectedUris)
                        },
                        enabled = uploadState !is UploadState.Uploading,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Amber500)
                    ) {
                        if (uploadState is UploadState.Uploading) {
                            val state = uploadState as UploadState.Uploading
                            Text(
                                "Uploading ${state.currentFile}/${state.totalFiles} (${state.progressPercent}%)",
                                color = HeritageBlack,
                                fontWeight = FontWeight.Black,
                                fontSize = 9.sp,
                                maxLines = 1
                            )
                        } else {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Upload, contentDescription = null, tint = HeritageBlack, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("UPLOAD", color = HeritageBlack, fontWeight = FontWeight.Black, fontSize = 10.sp, maxLines = 1)
                            }
                        }
                    }
                }
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Amber500)
                }
            } else if (localVideos.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No local videos found on device storage.", color = Stone400, fontSize = 14.sp)
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(localVideos, key = { it.id }) { video ->
                        val isSelected = selectedVideoIds.contains(video.id)

                        Box(
                            modifier = Modifier
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Stone900)
                                .border(
                                    width = if (isSelected) 3.dp else 1.dp,
                                    color = if (isSelected) Amber500 else Stone900,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .semantics {
                                    role = Role.Checkbox
                                    onClick(label = "Select ${video.name}") {
                                        selectedVideoIds = if (selectedVideoIds.contains(video.id)) {
                                            selectedVideoIds - video.id
                                        } else {
                                            selectedVideoIds + video.id
                                        }
                                        true
                                    }
                                }
                                .pointerInput(video.id) {
                                    detectTapGestures(
                                        onTap = {
                                            selectedVideoIds = if (currentSelectedVideoIds.contains(video.id)) {
                                                currentSelectedVideoIds - video.id
                                            } else {
                                                currentSelectedVideoIds + video.id
                                            }
                                        },
                                        onLongPress = { previewVideo = video },
                                        onPress = {
                                            try {
                                                tryAwaitRelease()
                                            } finally {
                                                if (currentPreviewVideoId == video.id) {
                                                    previewPlayer.pause()
                                                    previewVideo = null
                                                }
                                            }
                                        }
                                    )
                                }
                        ) {
                            if (previewVideo?.id == video.id) {
                                AndroidView(
                                    factory = { viewContext ->
                                        PlayerView(viewContext).apply {
                                            player = previewPlayer
                                            useController = false
                                            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                                        }
                                    },
                                    update = { it.player = previewPlayer },
                                    onRelease = { it.player = null },
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                LocalVideoThumbnail(video)
                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = "Hold to preview ${video.name}",
                                    tint = Parchment,
                                    modifier = Modifier
                                        .align(Alignment.Center)
                                        .size(36.dp)
                                )
                            }

                            Box(
                                modifier = Modifier
                                    .align(Alignment.BottomStart)
                                    .padding(4.dp)
                                    .background(HeritageBlack.copy(alpha = 0.8f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = formatDuration(video.durationMs),
                                    color = Parchment,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(6.dp)
                                    .size(22.dp)
                                    .clip(CircleShape)
                                    .background(if (isSelected) Amber500 else HeritageBlack.copy(alpha = 0.6f))
                                    .border(1.dp, if (isSelected) Amber500 else Parchment.copy(alpha = 0.5f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                if (isSelected) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = HeritageBlack, modifier = Modifier.size(14.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LocalVideoThumbnail(video: LocalVideoMedia) {
    val context = LocalContext.current
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = video.uri) {
        value = withContext(Dispatchers.IO) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    context.contentResolver.loadThumbnail(
                        video.uri,
                        Size(512, 512),
                        CancellationSignal()
                    )
                } else {
                    val retriever = android.media.MediaMetadataRetriever()
                    try {
                        context.contentResolver.openFileDescriptor(video.uri, "r")?.use { descriptor ->
                            retriever.setDataSource(descriptor.fileDescriptor)
                            retriever.getFrameAtTime(
                                0,
                                android.media.MediaMetadataRetriever.OPTION_CLOSEST_SYNC
                            )
                        }
                    } finally {
                        retriever.release()
                    }
                }
            } catch (exception: Exception) {
                Log.w("LocalVideoPicker", "Unable to load a video thumbnail", exception)
                null
            }
        }
    }

    if (bitmap != null) {
        androidx.compose.foundation.Image(
            bitmap = bitmap!!.asImageBitmap(),
            contentDescription = "Thumbnail for ${video.name}",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
    } else {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Stone900),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.PlayArrow,
                contentDescription = "Video thumbnail unavailable for ${video.name}",
                tint = Stone400,
                modifier = Modifier.size(36.dp)
            )
        }
    }
}

private fun formatDuration(durationMs: Long): String {
    val minutes = TimeUnit.MILLISECONDS.toMinutes(durationMs)
    val seconds = TimeUnit.MILLISECONDS.toSeconds(durationMs) % 60
    return String.format(Locale.getDefault(), "%d:%02d", minutes, seconds)
}
