package com.portfolio.videostreaming

import android.app.Application
import android.util.Log
import com.amplifyframework.AmplifyException
import com.amplifyframework.auth.cognito.AWSCognitoAuthPlugin
import com.amplifyframework.core.Amplify

/**
 * ============================================================================
 * Application Root Entry Point (Process-Level Initialization)
 * ============================================================================
 * Enterprise Architecture Strategy: Process-Level Dependency Bootstrap.
 * The Application class executes before any Activity, Service, or ViewModel.
 * Bootstrapping SDK plugins (AWS Amplify Auth) here ensures global initialization
 * occurs exactly once during application startup.
 */
class AlexandriaApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        try {
            // Register AWS Cognito Auth Plugin for Amplify SDK
            Amplify.addPlugin(AWSCognitoAuthPlugin())
            Amplify.configure(applicationContext)
            Log.i("AlexandriaApp", "Initialized Amplify")
        } catch (error: AmplifyException) {
            Log.e("AlexandriaApp", "Could not initialize Amplify", error)
        }
    }
}
