package com.portfolio.videostreaming.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment

/**
 * ============================================================================
 * Registration & Family Code Validation Screen
 * ============================================================================
 * Enterprise Architecture Strategy: Mandatory Tenancy Validation.
 * Enforces mandatory Family Code inputs provided by digitization shop operators,
 * preventing unassigned consumer sign-ups and guaranteeing vault data isolation.
 */
@Composable
fun SignupScreen(
    viewModel: AuthViewModel,
    onNavigateToLogin: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var familyId by remember { mutableStateOf("") }
    var verificationCode by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val authState by viewModel.authState.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = if (authState is AuthState.NeedsVerification) "Verify your Account" else "Join Family Vault",
                color = Parchment,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = if (authState is AuthState.NeedsVerification)
                    "Enter the code sent to your email address."
                else
                    "Enter the Family Code provided by your digitization shop operator.",
                color = Parchment.copy(alpha = 0.6f),
                fontSize = 12.sp,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            if (authState is AuthState.NeedsVerification) {
                // Email Verification Pass
                OutlinedTextField(
                    value = verificationCode,
                    onValueChange = { verificationCode = it },
                    label = { Text("Verification Code") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Amber500)
                )

                Spacer(modifier = Modifier.height(32.dp))

                Button(
                    onClick = { viewModel.confirmSignUp(email, verificationCode, password) },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Amber500)
                ) {
                    Text("VERIFY & LAUNCH", color = HeritageBlack, fontWeight = FontWeight.Black)
                }

            } else {
                // User Credentials & Mandatory Family Code Input
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email Address") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Amber500)
                )

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                                contentDescription = if (passwordVisible) "Hide password" else "Show password",
                                tint = Parchment.copy(alpha = 0.6f)
                            )
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Amber500)
                )

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = familyId,
                    onValueChange = { familyId = it },
                    label = { Text("Family Code (Required)") },
                    placeholder = { Text("e.g. FAM_LALAMA") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Amber500)
                )

                Spacer(modifier = Modifier.height(24.dp))

                val displayError = errorMessage ?: (authState as? AuthState.Error)?.message
                if (displayError != null) {
                    Text(
                        text = displayError,
                        color = Color.Red,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )
                }

                Button(
                    onClick = {
                        if (familyId.isBlank()) {
                            errorMessage = "A valid Family Code from your shop operator is required."
                            return@Button
                        }
                        errorMessage = null
                        viewModel.signUp(email, password, familyId.trim().uppercase())
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    enabled = authState !is AuthState.Loading,
                    colors = ButtonDefaults.buttonColors(containerColor = Amber500)
                ) {
                    if (authState is AuthState.Loading) {
                        CircularProgressIndicator(color = HeritageBlack, modifier = Modifier.size(24.dp))
                    } else {
                        Text("JOIN VAULT", color = HeritageBlack, fontWeight = FontWeight.Black)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                TextButton(onClick = onNavigateToLogin) {
                    Text("Already registered? Sign In", color = Amber500)
                }
            }
        }
    }
}
