package com.portfolio.videostreaming.ui.components

import android.content.ClipData
import android.content.Context
import android.widget.Toast
import androidx.core.content.edit
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Help
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.nativeClipboardManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.portfolio.videostreaming.R
import com.portfolio.videostreaming.ui.auth.AuthViewModel
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment
import com.portfolio.videostreaming.ui.theme.Stone400

/**
 * ============================================================================
 * Global Heritage Header Navbar & Account Details Context Dialog
 * ============================================================================
 * Enterprise Architecture Strategy: Cross-Platform UI Ergonomics Parity.
 * Renders top brand header navigation lockup, top-right Search Button trigger,
 * Account Details Modal, AI Privacy Toggle, and AWS Zero-Training Guarantee.
 */
@Composable
fun AlexandriaNavbar(
    authViewModel: AuthViewModel,
    showAccountDialog: Boolean,
    onAccountDialogDismiss: () -> Unit,
    onOpenSearch: () -> Unit,
    onOpenVaultAdmin: () -> Unit,
    modifier: Modifier = Modifier
) {
    val userEmail by authViewModel.userEmail.collectAsState()
    val familyId by authViewModel.familyId.collectAsState()
    val isAdmin by authViewModel.isAdmin.collectAsState()

    var showAiDisclosureDialog by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val clipboard = LocalClipboard.current
    var enableAi by remember(context) {
        mutableStateOf(
            context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
                .getBoolean(PREFERENCE_ENABLE_AI, false)
        )
    }

    val initial = if (!userEmail.isNullOrBlank()) {
        userEmail!!.first().uppercaseChar().toString()
    } else {
        "A"
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = HeritageBlack.copy(alpha = 0.85f),
        shadowElevation = 8.dp
    ) {
        Column(modifier = Modifier.statusBarsPadding()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp)
                    .padding(horizontal = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Logo Glyph and Integrated Wordmark Lockup
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.logo_flat),
                        contentDescription = "Alexandria+ Logo",
                        modifier = Modifier
                            .height(52.dp)
                            .offset(x = 3.dp, y = 1.dp),
                        contentScale = ContentScale.Fit
                    )
                    Text(
                        text = "LEXANDRIA+",
                        color = Parchment,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-0.5).sp,
                        modifier = Modifier.offset(x = (-12).dp)
                    )
                }

                // Search & Account Avatar Actions
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    if (isAdmin) {
                        IconButton(onClick = onOpenVaultAdmin) {
                            Icon(
                                imageVector = Icons.Default.AdminPanelSettings,
                                contentDescription = "Vault Administration",
                                tint = Amber500
                            )
                        }
                    }
                    IconButton(onClick = onOpenSearch) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Search Vault Media",
                            tint = Parchment
                        )
                    }
                }
            }
            
            // Subtle Heritage divider line
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Parchment.copy(alpha = 0.1f))
            )
        }
    }

    // Account Details Context Modal
    if (showAccountDialog) {
        AlertDialog(
            onDismissRequest = onAccountDialogDismiss,
            containerColor = HeritageBlack,
            shape = RoundedCornerShape(24.dp),
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(Amber500),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initial,
                            color = HeritageBlack,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                    Column {
                        Text(
                            text = "Family Vault Member",
                            color = Parchment,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = "AUTHENTICATED USER",
                            color = Amber500,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                    }
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Authenticated Email Section
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "AUTHENTICATED EMAIL",
                            color = Stone400,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = userEmail ?: "Loading email...",
                            color = Parchment,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    // Family Vault Partition Code Section
                    if (!familyId.isNullOrBlank()) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = "FAMILY VAULT PARTITION",
                                color = Stone400,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = familyId!!,
                                    color = Amber500,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.5.sp
                                )
                                Button(
                                    onClick = {
                                        clipboard.nativeClipboardManager.setPrimaryClip(
                                            ClipData.newPlainText("Family Vault Code", familyId)
                                        )
                                        Toast.makeText(context, "Copied Vault Code (${familyId}) to clipboard!", Toast.LENGTH_SHORT).show()
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Amber500.copy(alpha = 0.2f)),
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                    modifier = Modifier.height(32.dp)
                                ) {
                                    Text("Copy", color = Amber500, fontSize = 10.sp, fontWeight = FontWeight.Black)
                                }
                            }
                        }
                    }

                    // AI Privacy & Ingestion Mode Control Row
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "AI TITLES & SUMMARIES",
                                    color = Stone400,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    letterSpacing = 1.sp
                                )
                                IconButton(
                                    onClick = { showAiDisclosureDialog = true },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.Help,
                                        contentDescription = "AI Privacy Info",
                                        tint = Amber500,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }

                            Switch(
                                checked = enableAi,
                                onCheckedChange = { enabled ->
                                    enableAi = enabled
                                    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
                                        .edit {
                                            putBoolean(PREFERENCE_ENABLE_AI, enabled)
                                        }
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = HeritageBlack,
                                    checkedTrackColor = Amber500,
                                    uncheckedThumbColor = Stone400,
                                    uncheckedTrackColor = HeritageBlack
                                )
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onAccountDialogDismiss()
                        authViewModel.signOut()
                    }
                ) {
                    Text(
                        text = "SIGN OUT",
                        color = Color.Red,
                        fontWeight = FontWeight.Black,
                        fontSize = 12.sp,
                        letterSpacing = 1.sp
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = onAccountDialogDismiss) {
                    Text(
                        text = "CLOSE",
                        color = Stone400,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                }
            }
        )
    }

    // AWS Zero AI Training Guarantee Disclosure Dialog
    if (showAiDisclosureDialog) {
        AlertDialog(
            onDismissRequest = { showAiDisclosureDialog = false },
            containerColor = HeritageBlack,
            shape = RoundedCornerShape(24.dp),
            title = {
                Text(
                    text = "AI Privacy & Safety Guarantee",
                    color = Parchment,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black
                )
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "🔒 AWS Zero-Training Guarantee\nAmazon Web Services (AWS Bedrock) 100% guarantees that your personal family photos, videos, and keyframe thumbnails are NEVER used to train public AI models. Your memories remain 100% private to your vault.",
                        color = Parchment.copy(alpha = 0.9f),
                        fontSize = 12.sp,
                        lineHeight = 18.sp
                    )
                    Text(
                        text = "✨ What AI Mode Does (When Enabled)\nWhen enabled, a single video thumbnail frame is briefly analyzed by Amazon Bedrock Claude Vision to automatically draft a suggested title, summary, tags, and Heritage Genre for your review.",
                        color = Amber500,
                        fontSize = 12.sp,
                        lineHeight = 18.sp
                    )
                    Text(
                        text = "🛡️ Manual Privacy Mode (Default - When Disabled)\nWhen disabled, your media is uploaded with 100% manual privacy. No images leave your vault or enter AI models, saving cloud compute and making your video immediately ready for manual review.",
                        color = Stone400,
                        fontSize = 12.sp,
                        lineHeight = 18.sp
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { showAiDisclosureDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = Amber500)
                ) {
                    Text("UNDERSTOOD", color = HeritageBlack, fontWeight = FontWeight.Black, fontSize = 12.sp)
                }
            }
        )
    }
}

private const val PREFERENCES_NAME = "alexandria_settings"
private const val PREFERENCE_ENABLE_AI = "enable_ai"
