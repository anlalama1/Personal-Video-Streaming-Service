package com.portfolio.videostreaming.ui.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.portfolio.videostreaming.R
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment

/**
 * ============================================================================
 * Login Screen Composable
 * ============================================================================
 * Enterprise Architecture Strategy: Declarative Auth Input UI.
 * Renders high-fidelity branded inputs for email/password authentication
 * and observes AuthViewModel state machine for loading spinners & error banners.
 */
@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onNavigateToSignUp: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val authState by viewModel.authState.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Branded 3D Hero Logo
            Image(
                painter = painterResource(id = R.drawable.logo_hero_3d),
                contentDescription = "Alexandria+ Logo",
                modifier = Modifier.size(180.dp),
                contentScale = ContentScale.Fit
            )

            Spacer(modifier = Modifier.height(48.dp))

            Text(
                text = "Welcome to the Vault",
                color = Parchment,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black
            )

            Spacer(modifier = Modifier.height(32.dp))

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email Address") },
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Amber500,
                    unfocusedBorderColor = Parchment.copy(alpha = 0.3f),
                    focusedLabelColor = Amber500,
                    unfocusedLabelColor = Parchment.copy(alpha = 0.6f),
                    cursorColor = Amber500
                )
            )

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Amber500,
                    unfocusedBorderColor = Parchment.copy(alpha = 0.3f),
                    focusedLabelColor = Amber500,
                    unfocusedLabelColor = Parchment.copy(alpha = 0.6f),
                    cursorColor = Amber500
                )
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Error Banner Display
            if (authState is AuthState.Error) {
                Text(
                    text = (authState as AuthState.Error).message,
                    color = Color.Red,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }

            // Sign In Action Button
            Button(
                onClick = { viewModel.signIn(email, password) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                enabled = authState !is AuthState.Loading,
                colors = ButtonDefaults.buttonColors(containerColor = Amber500)
            ) {
                if (authState is AuthState.Loading) {
                    CircularProgressIndicator(color = HeritageBlack, modifier = Modifier.size(24.dp))
                } else {
                    Text("SIGN IN", color = HeritageBlack, fontWeight = FontWeight.Black)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            TextButton(onClick = onNavigateToSignUp) {
                Text(
                    text = "Don't have an account? Sign Up",
                    color = Amber500,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
