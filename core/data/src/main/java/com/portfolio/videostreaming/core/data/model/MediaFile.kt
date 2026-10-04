package com.portfolio.videostreaming.core.data.model

/**
 * Senior Approach: Shared Data Models.
 * By placing this in a core module, both the Consumer and Admin apps
 * stay perfectly in sync with the data structure.
 */
data class MediaFile(
    val id: String,
    val title: String,
    val genre: String,
    val releaseYear: Int,
    val thumbnailUrl: String,
    val videoUrl: String,
    val description: String = "",
    val tags: List<String> = emptyList(),
    val transcodeStatus: String = "",
    val useAi: Boolean = false,
    val aiTitle: String = "",
    val aiGenre: String = "",
    val aiTags: List<String> = emptyList(),
    val aiDescription: String = "",
    val familyId: String = "",
    val videoKey: String = ""
)
