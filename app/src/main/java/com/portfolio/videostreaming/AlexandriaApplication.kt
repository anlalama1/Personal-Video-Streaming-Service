package com.portfolio.videostreaming

import android.app.Application
import android.util.Log
import com.amplifyframework.AmplifyException
import com.amplifyframework.auth.cognito.AWSCognitoAuthPlugin
import com.amplifyframework.core.Amplify

class AlexandriaApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        try {
            Amplify.addPlugin(AWSCognitoAuthPlugin())
            Amplify.configure(applicationContext)
            Log.i("AlexandriaApp", "Initialized Amplify")
        } catch (error: AmplifyException) {
            Log.e("AlexandriaApp", "Could not initialize Amplify", error)
        }
    }
}
