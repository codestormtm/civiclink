# CivicLink Mobile Apps

This folder contains two Android-first Flutter WebView shells for LAN testing:

- `citizen`: package `lk.civiclink.citizen`, default portal `http://192.168.1.2:5173`
- `worker`: package `lk.civiclink.worker`, default portal `http://192.168.1.2:5175`

Both apps expect the backend API at `http://192.168.1.2:5002/api` unless overridden with `--dart-define`.

If Gradle uses system Java 25, point builds at Android Studio's bundled Java 21 first:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

## Run

```powershell
cd mobile\citizen
flutter pub get
flutter run --dart-define=CIVICLINK_PORTAL_URL=http://192.168.1.2:5173 --dart-define=CIVICLINK_API_BASE_URL=http://192.168.1.2:5002/api

cd ..\worker
flutter pub get
flutter run --dart-define=CIVICLINK_PORTAL_URL=http://192.168.1.2:5175 --dart-define=CIVICLINK_API_BASE_URL=http://192.168.1.2:5002/api
```

## Firebase

Create Android apps in the Firebase project for:

- `lk.civiclink.citizen`
- `lk.civiclink.worker`

Place each matching `google-services.json` in the app's `android/app/` directory before building with Firebase enabled.

The citizen APK does not use WebView OAuth for Google login because Google blocks embedded WebView sign-in with `403: disallowed_useragent`. The portal Google button is bridged to native Flutter Google/Firebase sign-in, so the citizen Firebase Android app, SHA fingerprints, and backend Firebase Admin credentials must all be configured before testing Google login.
