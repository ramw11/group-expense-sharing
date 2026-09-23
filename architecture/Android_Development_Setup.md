# Android Development Setup

## Required tools

- Node.js 22.13 or newer is recommended by the current JavaScript toolchain.
- Android Studio with its bundled JDK 21.
- Android SDK Platform 36 and Build Tools 35/36.
- An API 24 or newer physical device or emulator.

The project does not require a separate global Java installation when Android Studio is installed.

## Windows session setup

Run these commands in PowerShell before invoking Gradle directly:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:Path"
```

Prepending Android Studio's `platform-tools` is important if another, older `adb.exe` exists elsewhere on the machine.

## Web and native synchronization

```powershell
npm install
npm run android:sync
```

`android:sync` builds the web application and copies the resulting assets and plugin configuration into the native project.

## Open in Android Studio

```powershell
npm run android:open
```

Open the `android` project, choose an API 24+ emulator or connected phone, and use Android Studio's Run action.

## Command-line debug build

```powershell
npm run android:sync
./android/gradlew.bat -p ./android assembleDebug
```

The ignored APK is generated at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Quality gates

```powershell
npm run build
npm run lint
npm test
./android/gradlew.bat -p ./android :app:testDebugUnitTest :app:connectedDebugAndroidTest
```

Target the `:app` module for connected tests. The generated Capacitor project includes dependency modules with their own upstream test configurations; running the root `connectedDebugAndroidTest` task attempts to test those third-party modules too.

## Signing safety

- Debug builds use the normal local Android debug key.
- Do not commit `.jks`, `.keystore`, signing properties, passwords, APKs, or AABs.
- Create the stable private-release/upload key before the first distributed Phase A APK and back it up outside the repository.
