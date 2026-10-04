package com.portfolio.videostreaming.ui

import android.content.Context
import android.net.Uri
import androidx.lifecycle.LiveData
import androidx.lifecycle.ViewModel
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import java.util.UUID

class IngestViewModel : ViewModel() {
    fun getUploadWorkInfos(context: Context): LiveData<List<WorkInfo>> =
        WorkManager.getInstance(context).getWorkInfosByTagLiveData(S3UploadWorker.WORK_TAG)

    fun uploadSelectedVideos(
        context: Context,
        videoUris: List<Uri>,
        familyId: String? = null,
        useAi: Boolean = false
    ): UUID {
        val inputData = Data.Builder()
            .putStringArray(S3UploadWorker.KEY_VIDEO_URIS, videoUris.map(Uri::toString).toTypedArray())
            .putString(S3UploadWorker.KEY_FAMILY_ID, familyId)
            .putBoolean(S3UploadWorker.KEY_USE_AI, useAi)
            .build()
        val request = OneTimeWorkRequestBuilder<S3UploadWorker>()
            .setInputData(inputData)
            .addTag(S3UploadWorker.WORK_TAG)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            S3UploadWorker.UNIQUE_WORK_NAME,
            ExistingWorkPolicy.KEEP,
            request
        )
        return request.id
    }
}
