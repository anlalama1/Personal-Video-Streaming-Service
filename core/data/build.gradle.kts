plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.portfolio.videostreaming.core.data"
    compileSdk = 37

    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        // Lead Strategy: Inject the API URL through Gradle.
        // Note: Custom Domain mapping (api.alexandria-plus.com) maps stage 'prod' directly to root '/', so NO '/prod/' prefix is needed.
        buildConfigField("String", "BASE_URL", "\"https://api.alexandria-plus.com/\"")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
        isCoreLibraryDesugaringEnabled = true
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation("androidx.core:core-ktx:1.19.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.11.0")
    
    // DataStore (Persistent Storage)
    implementation("androidx.datastore:datastore-preferences:1.2.1")
    
    // Networking & Serialization
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Authentication
    implementation("com.amplifyframework:aws-auth-cognito:2.42.0")

    testImplementation("junit:junit:4.13.2")
}
