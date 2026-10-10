package com.portfolio.videostreaming.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment

@Composable
fun VaultOnboardingScreen(
    viewModel: AuthViewModel,
    onSignOut: () -> Unit
) {
    var familyCode by remember { mutableStateOf("") }
    val loading by viewModel.onboardingLoading.collectAsState()
    val error by viewModel.onboardingError.collectAsState()
    val createdCode by viewModel.newFamilyCode.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Set up your family vault", color = Parchment, fontSize = 24.sp, fontWeight = FontWeight.Black)
        Spacer(modifier = Modifier.height(12.dp))

        if (createdCode != null) {
            Text(
                "Your vault is ready. You are its administrator. Share this family code with people you want to invite:",
                color = Parchment.copy(alpha = 0.75f),
                fontSize = 14.sp
            )
            Spacer(modifier = Modifier.height(20.dp))
            Text(createdCode!!, color = Amber500, fontSize = 28.sp, fontWeight = FontWeight.Black)
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = { viewModel.dismissNewFamilyCode() }) {
                Text("CONTINUE", color = HeritageBlack, fontWeight = FontWeight.Black)
            }
        } else {
            Text(
                "Your account is ready. Join a family vault or create a new one.",
                color = Parchment.copy(alpha = 0.75f),
                fontSize = 14.sp
            )
            Spacer(modifier = Modifier.height(24.dp))
            OutlinedTextField(
                value = familyCode,
                onValueChange = { familyCode = it.uppercase() },
                label = { Text("Existing family code") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = { viewModel.joinVault(familyCode) },
                enabled = !loading && familyCode.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Amber500)
            ) {
                Text("REQUEST TO JOIN", color = HeritageBlack, fontWeight = FontWeight.Black)
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text("OR", color = Parchment.copy(alpha = 0.6f), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(
                onClick = { viewModel.createVault() },
                enabled = !loading,
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                if (loading) CircularProgressIndicator(modifier = Modifier.size(22.dp), color = Amber500)
                else Text("CREATE A NEW VAULT", color = Parchment, fontWeight = FontWeight.Black)
            }
            if (error != null) {
                Text(error!!, color = Color.Red, fontSize = 12.sp, modifier = Modifier.padding(top = 16.dp))
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
        TextButton(onClick = onSignOut) {
            Text("Sign out", color = Parchment.copy(alpha = 0.7f))
        }
    }
}
