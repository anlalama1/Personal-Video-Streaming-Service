package com.portfolio.videostreaming.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment

@Composable
fun SignupScreen(
    viewModel: AuthViewModel,
    onNavigateToLogin: () -> Unit
) {
    var email by remember { mutableStateOf(viewModel.pendingEmail.value) }
    var password by remember { mutableStateOf("") }
    var verificationCode by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var resendStatusMessage by remember { mutableStateOf<String?>(null) }

    val authState by viewModel.authState.collectAsState()
    val pendingEmail by viewModel.pendingEmail.collectAsState()
    val verificationError by viewModel.verificationError.collectAsState()
    var verificationStep by remember { mutableStateOf(authState is AuthState.NeedsVerification) }
    val isVerifying = verificationStep

    LaunchedEffect(authState) {
        if (authState is AuthState.NeedsVerification) verificationStep = true
    }

    LaunchedEffect(pendingEmail) {
        if (pendingEmail.isNotBlank()) email = pendingEmail
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = if (isVerifying) "Verify your account" else "Create an account",
                color = Parchment,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = if (isVerifying)
                    "Enter the email verification code to continue."
                else
                    "Create your account first. You can join or create a family vault after signing in.",
                color = Parchment.copy(alpha = 0.65f),
                fontSize = 12.sp,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            if (isVerifying) {
                Text("Verification email: $pendingEmail", color = Parchment, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = verificationCode,
                    onValueChange = { verificationCode = it },
                    label = { Text("Verification code") },
                    modifier = Modifier.fillMaxWidth()
                )
                val error = verificationError ?: errorMessage
                if (error != null) {
                    Text(error, color = Color.Red, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                }
                resendStatusMessage?.let {
                    Text(it, color = Parchment, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                }
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { viewModel.confirmSignUp(pendingEmail, verificationCode) },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    enabled = authState !is AuthState.Loading,
                    colors = ButtonDefaults.buttonColors(containerColor = Amber500)
                ) {
                    if (authState is AuthState.Loading) {
                        CircularProgressIndicator(color = HeritageBlack, modifier = Modifier.size(24.dp))
                    } else {
                        Text("VERIFY & CONTINUE", color = HeritageBlack, fontWeight = FontWeight.Black)
                    }
                }
                TextButton(
                    onClick = {
                        viewModel.resendSignUpCode(pendingEmail) { success, message ->
                            if (success) resendStatusMessage = message else errorMessage = message
                        }
                    }
                ) {
                    Text("Resend verification code", color = Amber500, fontWeight = FontWeight.Bold)
                }
            } else {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email address") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth()
                )
                val error = errorMessage ?: (authState as? AuthState.Error)?.message
                if (error != null) {
                    Text(error, color = Color.Red, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                }
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = {
                        errorMessage = null
                        if (email.isBlank() || password.isBlank()) {
                            errorMessage = "Enter an email address and password."
                        } else {
                            viewModel.signUp(email.trim(), password)
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    enabled = authState !is AuthState.Loading,
                    colors = ButtonDefaults.buttonColors(containerColor = Amber500)
                ) {
                    if (authState is AuthState.Loading) {
                        CircularProgressIndicator(color = HeritageBlack, modifier = Modifier.size(24.dp))
                    } else {
                        Text("CREATE ACCOUNT", color = HeritageBlack, fontWeight = FontWeight.Black)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            TextButton(onClick = onNavigateToLogin) {
                Text("Back to sign in", color = Parchment.copy(alpha = 0.7f))
            }
        }
    }
}
