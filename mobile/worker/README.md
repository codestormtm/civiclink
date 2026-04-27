# CivicLink Worker Android

Loads the worker React portal from the LAN and registers this Android device for native FCM updates.

Run with:

```powershell
flutter run --dart-define=CIVICLINK_PORTAL_URL=http://192.168.1.2:5175 --dart-define=CIVICLINK_API_BASE_URL=http://192.168.1.2:5002/api
```

Place the Firebase Android `google-services.json` for `lk.civiclink.worker` in `android/app/` before building with Firebase enabled.
