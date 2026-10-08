package com.portfolio.videostreaming.ui.auth

import android.app.Activity
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.amplifyframework.auth.AuthException
import com.amplifyframework.auth.AuthUserAttributeKey
import com.amplifyframework.auth.options.AuthFetchSessionOptions
import com.amplifyframework.auth.options.AuthSignUpOptions
import com.amplifyframework.auth.result.AuthSignInResult
import com.amplifyframework.core.Amplify
import com.portfolio.videostreaming.core.data.network.StreamingApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

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

    private val _familyId = MutableStateFlow<String?>(null)
    val familyId = _familyId.asStateFlow()

    private val _isAdmin = MutableStateFlow(false)
    val isAdmin = _isAdmin.asStateFlow()

    private val _isApproved = MutableStateFlow(false)
    val isApproved = _isApproved.asStateFlow()

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
     * Fetches authenticated user email and family vault partition code from Cognito User Pool attributes.
     */
    private fun fetchUserAttributes(registerMembership: Boolean = true) {
        Amplify.Auth.fetchUserAttributes(
            { attributes ->
                val email = attributes.find { it.key == AuthUserAttributeKey.email() }?.value
                val famId = attributes.find { it.key.keyString == "custom:familyId" }?.value
                _userEmail.value = email
                _familyId.value = famId
                _isAdmin.value = attributes.find { it.key.keyString == "custom:isAdmin" }?.value == "true"
                _isApproved.value = attributes.find { it.key.keyString == "custom:isApproved" }?.value == "true"
                if (registerMembership && !famId.isNullOrBlank()) {
                    viewModelScope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                StreamingApi.service.registerVaultMember()
                            }
                            Amplify.Auth.fetchAuthSession(
                                AuthFetchSessionOptions.builder().forceRefresh(true).build(),
                                { fetchUserAttributes(registerMembership = false) },
                                { error -> Log.e("AuthVM", "Failed to refresh vault membership claims", error) }
                            )
                        } catch (error: Exception) {
                            Log.e("AuthVM", "Failed to initialize family vault membership", error)
                        }
                    }
                }
            },
            { error -> Log.e("AuthVM", "Failed to fetch attributes", error) }
        )
    }

    /**
     * Authenticates user via email and password using Cognito SRP / UserPassword auth.
     * Intercepts unconfirmed account state and automatically re-routes to verification code screen.
     */
    fun signIn(email: String, pword: String) {
        _authState.value = AuthState.Loading
        Amplify.Auth.signIn(email, pword,
            { result ->
                if (result.isSignedIn) {
                    _authState.value = AuthState.SignedIn
                    fetchUserAttributes()
                } else {
                    val stepName = result.nextStep.signInStep.name
                    if (stepName.contains("CONFIRM", ignoreCase = true) || stepName.contains("VERIF", ignoreCase = true)) {
                        _authState.value = AuthState.NeedsVerification
                    } else {
                        _authState.value = AuthState.Error("Sign in incomplete: ${result.nextStep}")
                    }
                }
            },
            { error ->
                val errMessage = error.message ?: ""
                if (errMessage.contains("UserNotConfirmedException", ignoreCase = true) ||
                    errMessage.contains("not confirmed", ignoreCase = true)) {
                    Log.w("AuthVM", "Unconfirmed user sign in attempt -> Rerouting to Verification Screen")
                    _authState.value = AuthState.NeedsVerification
                } else {
                    _authState.value = AuthState.Error(errMessage.ifBlank { "Sign in failed" })
                }
            }
        )
    }

    /**
     * Triggers Google OAuth 2.0 federated social sign-in via AWS Amplify Auth Hosted UI.
     */
    fun signInWithGoogle(activity: Activity) {
        _authState.value = AuthState.Loading
        Amplify.Auth.signInWithWebUI(
            activity,
            { result: AuthSignInResult ->
                if (result.isSignedIn) {
                    _authState.value = AuthState.SignedIn
                    fetchUserAttributes()
                } else {
                    _authState.value = AuthState.Error("Google sign-in incomplete: ${result.nextStep}")
                }
            },
            { error: AuthException ->
                Log.e("AuthVM", "Google social sign in failed", error)
                _authState.value = AuthState.Error(error.message ?: "Google sign in failed")
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
            { _ ->
                _authState.value = AuthState.NeedsVerification
            },
            { error ->
                Log.e("AuthVM", "Cognito sign-up failed", error)
                val errMessage = error.message ?: ""
                if (errMessage.contains("UsernameExistsException", ignoreCase = true) ||
                    errMessage.contains("already exists", ignoreCase = true)) {
                    signIn(email, pword)
                } else {
                    _authState.value = AuthState.Error(errMessage.ifBlank { "Sign up failed" })
                }
            }
        )
    }

    /**
     * Resends 6-digit confirmation code via Cognito email.
     */
    fun resendSignUpCode(email: String, onComplete: (Boolean, String) -> Unit) {
        Amplify.Auth.resendSignUpCode(email,
            { _ ->
                onComplete(true, "New 6-digit code sent to $email (Expires in 15 mins)")
            },
            { error ->
                Log.e("AuthVM", "Failed to resend verification code", error)
                onComplete(false, error.message ?: "Failed to resend code")
            }
        )
    }

    /**
     * Confirms registration with 6-digit email verification code, automatically signing in upon completion.
     */
    fun confirmSignUp(email: String, code: String, password: String? = null) {
        _authState.value = AuthState.Loading
        Amplify.Auth.confirmSignUp(email, code,
            { _ ->
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
            _familyId.value = null
            _isAdmin.value = false
            _isApproved.value = false
        }
    }
}
