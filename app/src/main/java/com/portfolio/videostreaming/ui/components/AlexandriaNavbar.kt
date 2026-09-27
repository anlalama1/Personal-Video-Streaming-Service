package com.portfolio.videostreaming.ui.components

import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
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
 * Renders the top brand header navigation lockup with Home catalog navigation
 * and an interactive Account Details Modal displaying authenticated email,
 * Family Vault Code with 1-click clipboard copy, and explicit Sign Out confirmation.
 */
@Composable
fun AlexandriaNavbar(
    authViewModel: AuthViewModel,
    onNavigateHome: () -> Unit,
    modifier: Modifier = Modifier
) {
    val userEmail by authViewModel.userEmail.collectAsState()
    val familyId by authViewModel.familyId.collectAsState()
    var showAccountDialog by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

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
                // Logo Glyph and Integrated Wordmark Lockup (Clickable -> Home)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onNavigateHome() }
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

                // Desktop-style Navigation Items & Account Avatar
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    // Home Button Action
                    Text(
                        text = "HOME",
                        color = Parchment,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp,
                        modifier = Modifier.clickable { onNavigateHome() }
                    )
                    
                    // User Profile Avatar (Clickable -> Opens Account Details Modal)
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Amber500)
                            .border(1.dp, Amber500.copy(alpha = 0.5f), CircleShape)
                            .clickable { showAccountDialog = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initial,
                            color = HeritageBlack,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black
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

    // Account Details Context Modal (Parity with Desktop Viewer)
    if (showAccountDialog) {
        AlertDialog(
            onDismissRequest = { showAccountDialog = false },
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
                                        clipboardManager.setText(AnnotatedString(familyId!!))
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
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showAccountDialog = false
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
                TextButton(onClick = { showAccountDialog = false }) {
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
}
