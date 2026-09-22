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
import java.util.UUID

@Composable
fun SignupScreen(
    viewModel: AuthViewModel,
    onNavigateToLogin: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var familyId by remember { mutableStateOf("") }
    var verificationCode by remember { mutableStateOf("") }
    
    // Requirement 3: Create new vs Join existing
    var isNewFamily by remember { mutableStateOf(true) }

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
                text = if (authState is AuthState.NeedsVerification) "Verify your Identity" else "Create your Vault",
                color = Parchment,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black
            )

            Spacer(modifier = Modifier.height(32.dp))

            if (authState is AuthState.NeedsVerification) {
                Text(
                    text = "Please enter the code sent to your email.",
                    color = Parchment.copy(alpha = 0.6f),
                    fontSize = 14.sp,
                    modifier = Modifier.padding(bottom = 24.dp)
                )

                OutlinedTextField(
                    value = verificationCode,
                    onValueChange = { verificationCode = it },
                    label = { Text("Verification Code") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Amber500)
                )

                Spacer(modifier = Modifier.height(32.dp))

                Button(
                    onClick = { viewModel.confirmSignUp(email, verificationCode) },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Amber500)
                ) {
                    Text("VERIFY", color = HeritageBlack, fontWeight = FontWeight.Black)
                }

            } else {
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
                    visualTransformation = PasswordVisualTransformation(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Amber500)
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Requirement 3: Family Selection
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(selected = isNewFamily, onClick = { isNewFamily = true })
                    Text("Create New Family", color = Parchment, fontSize = 14.sp)
                    Spacer(modifier = Modifier.width(16.dp))
                    RadioButton(selected = !isNewFamily, onClick = { isNewFamily = false })
                    Text("Join Family", color = Parchment, fontSize = 14.sp)
                }

                if (!isNewFamily) {
                    OutlinedTextField(
                        value = familyId,
                        onValueChange = { familyId = it },
                        label = { Text("Family Code") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Amber500)
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                if (authState is AuthState.Error) {
                    Text(
                        text = (authState as AuthState.Error).message,
                        color = Color.Red,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )
                }

                Button(
                    onClick = { 
                        val finalFamilyId = if (isNewFamily) "FAM_${UUID.randomUUID().toString().take(8)}" else familyId
                        viewModel.signUp(email, password, finalFamilyId) 
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    enabled = authState !is AuthState.Loading,
                    colors = ButtonDefaults.buttonColors(containerColor = Amber500)
                ) {
                    if (authState is AuthState.Loading) {
                        CircularProgressIndicator(color = HeritageBlack, modifier = Modifier.size(24.dp))
                    } else {
                        Text("SIGN UP", color = HeritageBlack, fontWeight = FontWeight.Black)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                TextButton(onClick = onNavigateToLogin) {
                    Text("Already have an account? Sign In", color = Amber500)
                }
            }
        }
    }
}
