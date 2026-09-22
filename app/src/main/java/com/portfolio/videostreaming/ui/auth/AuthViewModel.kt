package com.portfolio.videostreaming.ui.auth

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.amplifyframework.auth.AuthUserAttributeKey
import com.amplifyframework.auth.options.AuthSignUpOptions
import com.amplifyframework.core.Amplify
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

sealed class AuthState {
    object Loading : AuthState()
    object SignedOut : AuthState()
    object SignedIn : AuthState()
    object NeedsVerification : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthViewModel : ViewModel() {
    private val _authState = MutableStateFlow<AuthState>(AuthState.Loading)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _userEmail = MutableStateFlow<String?>(null)
    val userEmail = _userEmail.asStateFlow()

    init {
        checkSession()
    }

    fun checkSession() {
        Amplify.Auth.fetchAuthSession(
            { session ->
                if (session.isSignedIn) {
                    _authState.value = AuthState.SignedIn
                    fetchUserAttributes()
                } else {
                    _authState.value = AuthState.SignedOut
                }
            },
            { error ->
                Log.e("AuthVM", "Session check failed", error)
                _authState.value = AuthState.SignedOut
            }
        )
    }

    private fun fetchUserAttributes() {
        Amplify.Auth.fetchUserAttributes(
            { attributes ->
                val email = attributes.find { it.key == AuthUserAttributeKey.email() }?.value
                _userEmail.value = email
            },
            { error -> Log.e("AuthVM", "Failed to fetch attributes", error) }
        )
    }

    fun signIn(email: String, pword: String) {
        _authState.value = AuthState.Loading
        Amplify.Auth.signIn(email, pword,
            { result ->
                if (result.isSignedIn) {
                    _authState.value = AuthState.SignedIn
                    fetchUserAttributes()
                } else {
                    // Could be CHALLENGE_REQUIRED etc.
                    _authState.value = AuthState.Error("Sign in incomplete: ${result.nextStep}")
                }
            },
            { error ->
                _authState.value = AuthState.Error(error.message ?: "Sign in failed")
            }
        )
    }

    fun signUp(email: String, pword: String, familyId: String) {
        _authState.value = AuthState.Loading
        
        val options = AuthSignUpOptions.builder()
            .userAttribute(AuthUserAttributeKey.email(), email)
            .userAttribute(AuthUserAttributeKey.custom("custom:familyId"), familyId)
            .build()

        Amplify.Auth.signUp(email, pword, options,
            { result ->
                _authState.value = AuthState.NeedsVerification
            },
            { error ->
                _authState.value = AuthState.Error(error.message ?: "Sign up failed")
            }
        )
    }

    fun confirmSignUp(email: String, code: String) {
        _authState.value = AuthState.Loading
        Amplify.Auth.confirmSignUp(email, code,
            { result ->
                _authState.value = AuthState.SignedOut // Now they can sign in
            },
            { error ->
                _authState.value = AuthState.Error(error.message ?: "Verification failed")
            }
        )
    }

    fun signOut() {
        Amplify.Auth.signOut {
            _authState.value = AuthState.SignedOut
            _userEmail.value = null
        }
    }
}
