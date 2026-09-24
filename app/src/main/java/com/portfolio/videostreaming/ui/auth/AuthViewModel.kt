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

/**
 * Sealed class representing discrete Auth Lifecycle States.
 */
sealed class AuthState {
    object Loading : AuthState()
    object SignedOut : AuthState()
    object SignedIn : AuthState()
    object NeedsVerification : AuthState()
    data class Error(val message: String) : AuthState()
}

/**
 * ============================================================================
 * Authentication ViewModel (AWS Amplify Cognito Bridge)
 * ============================================================================
 * Enterprise Architecture Strategy: SDK Isolation Layer.
 * ViewModel encapsulates AWS Amplify SDK calls, exposing reactive AuthState StateFlow
 * to composable screens without leaking Amplify SDK dependencies into UI components.
 */
class AuthViewModel : ViewModel() {
    private val _authState = MutableStateFlow<AuthState>(AuthState.Loading)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _userEmail = MutableStateFlow<String?>(null)
    val userEmail = _userEmail.asStateFlow()

    init {
        checkSession()
    }

    /**
     * Checks if an active AWS Cognito Auth session exists.
     */
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

    /**
     * Fetches authenticated user email from Cognito User Pool attributes.
     */
    private fun fetchUserAttributes() {
        Amplify.Auth.fetchUserAttributes(
            { attributes ->
                val email = attributes.find { it.key == AuthUserAttributeKey.email() }?.value
                _userEmail.value = email
            },
            { error -> Log.e("AuthVM", "Failed to fetch attributes", error) }
        )
    }

    /**
     * Authenticates user via email and password using Cognito SRP / UserPassword auth.
     */
    fun signIn(email: String, pword: String) {
        _authState.value = AuthState.Loading
        Amplify.Auth.signIn(email, pword,
            { result ->
                if (result.isSignedIn) {
                    _authState.value = AuthState.SignedIn
                    fetchUserAttributes()
                } else {
                    _authState.value = AuthState.Error("Sign in incomplete: ${result.nextStep}")
                }
            },
            { error ->
                _authState.value = AuthState.Error(error.message ?: "Sign in failed")
            }
        )
    }

    /**
     * Registers a new user with email and custom:familyId tenancy attribute.
     */
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

    /**
     * Confirms registration with 6-digit email verification code, automatically signing in upon completion.
     */
    fun confirmSignUp(email: String, code: String, password: String? = null) {
        _authState.value = AuthState.Loading
        Amplify.Auth.confirmSignUp(email, code,
            { result ->
                if (!password.isNullOrBlank()) {
                    signIn(email, password)
                } else {
                    _authState.value = AuthState.SignedOut
                }
            },
            { error ->
                _authState.value = AuthState.Error(error.message ?: "Verification failed")
            }
        )
    }

    /**
     * Signs out active user and clears cached state.
     */
    fun signOut() {
        Amplify.Auth.signOut {
            _authState.value = AuthState.SignedOut
            _userEmail.value = null
        }
    }
}
