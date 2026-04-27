# CivicLink Citizen Android

Loads the citizen React portal from the LAN and registers this Android device for native FCM updates.

Run with:

```powershell
flutter run --dart-define=CIVICLINK_PORTAL_URL=http://192.168.1.2:5173 --dart-define=CIVICLINK_API_BASE_URL=http://192.168.1.2:5002/api
```

Place the Firebase Android `google-services.json` for `lk.civiclink.citizen` in `android/app/` before building with Firebase enabled.

## Google sign-in in APK

Google blocks OAuth inside Android WebView with `403: disallowed_useragent`. The citizen app therefore intercepts the portal Google button and uses native Firebase/Google sign-in, then writes the CivicLink session back into the WebView.

For this to work:

1. Enable Google sign-in in Firebase Authentication.
2. Add Android app `lk.civiclink.citizen` in Firebase.
3. Add the debug/release SHA fingerprints in Firebase project settings.
4. Download the updated `google-services.json` and place it at `android/app/google-services.json`.
5. Configure backend Firebase Admin credentials in `backend/.env`, then rebuild the APK.
