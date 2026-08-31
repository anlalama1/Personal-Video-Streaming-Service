package com.example.videostreaming.ui

import android.app.Application
import android.os.Environment
import androidx.core.net.toUri
import androidx.lifecycle.AndroidViewModel
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer

/**
 * The ViewModel acts as the "persistent brain" of our player.
 * We use AndroidViewModel because we need a Context to build the ExoPlayer.
 */
class VideoPlayerViewModel(application: Application) : AndroidViewModel(application) {

    // This instance will survive screen rotations!
    val exoPlayer = ExoPlayer.Builder(application).build().apply {
        val videoPath = "${Environment.getExternalStorageDirectory().path}/Movies/all_the_stars_kendrick_lamar.mp4"
        val mediaItem = MediaItem.fromUri(videoPath.toUri())
        setMediaItem(mediaItem)
        prepare()
        playWhenReady = true
    }

    /**
     * onCleared is called when the user finishes the activity or the process is killed.
     * This is the correct place to release expensive resources like the player engine.
     */
    override fun onCleared() {
        exoPlayer.release()
    }
}
