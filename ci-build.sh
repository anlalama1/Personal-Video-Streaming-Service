#!/bin/bash
set -e # Exit immediately if a command fails

echo "BUILD LOG: --- Starting Android Cloud Build ---"

# 1. Setup paths
export ANDROID_HOME=$(pwd)/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

echo "BUILD LOG: ANDROID_HOME is set to $ANDROID_HOME"

# 2. Download and install Command Line Tools
if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo "BUILD LOG: Downloading Android Command Line Tools..."
    mkdir -p $ANDROID_HOME/cmdline-tools
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdline-tools.zip
    unzip -q /tmp/cmdline-tools.zip -d $ANDROID_HOME/cmdline-tools
    mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest
    echo "BUILD LOG: Tools installed."
fi

# 3. Accept Licenses and install required platform
echo "BUILD LOG: Installing SDK components (API 35)..."
yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses > /dev/null
sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-35" "build-tools;35.0.0"

# 4. Create local.properties
echo "sdk.dir=$ANDROID_HOME" > local.properties
echo "BUILD LOG: local.properties created:"
cat local.properties

# 5. Build the App
echo "BUILD LOG: Starting Gradle Build..."
chmod +x ./gradlew
./gradlew :app:assembleDebug --no-daemon

echo "BUILD LOG: Build Complete!"
