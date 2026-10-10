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
    coreLibraryDesugaring(libs.desugar.jdk.libs)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    
    // DataStore (Persistent Storage)
    implementation(libs.androidx.datastore.preferences)
    
    // Networking & Serialization
    implementation(libs.retrofit)
    implementation(libs.okhttp)
    implementation(libs.retrofit.kotlinx.serialization.converter)
    implementation(libs.kotlinx.serialization.json)

    // Authentication
    implementation(libs.aws.auth.cognito)

    testImplementation(libs.junit)
}
