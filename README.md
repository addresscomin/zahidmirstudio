# PhantomGuard

Privacy-first Android security dashboard starter.

## Build APK
GitHub Actions builds a debug APK on every push to `main` and on manual workflow dispatch.

1. Open the **Actions** tab.
2. Select **Build PhantomGuard APK**.
3. Open the latest successful run.
4. Download the **PhantomGuard-debug-apk** artifact.

## App scope
- Local WebView dashboard.
- User-triggered display of device model, Android version and battery percentage.
- No IMEI collection, installed-app inventory, bank-app inspection, location tracking, remote camera/microphone, contacts access, hidden service, or background data upload.

## Build locally
Open this repository in Android Studio (JDK 17, Android SDK 34), sync Gradle, then build the debug APK.
