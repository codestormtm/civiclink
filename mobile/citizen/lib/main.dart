import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

const String kDefaultPortalUrl = 'http://192.168.1.2:5173';
const String kDefaultApiBaseUrl = 'http://192.168.1.2:5002/api';
const String kDefaultAppRole = 'citizen';
const String kAppTitle = 'CivicLink Citizen';

enum _FileSelectionAction { camera, gallery, file }

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Firebase can be intentionally unconfigured during early LAN setup.
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  runApp(const CivicLinkMobileApp());
}

class CivicLinkMobileApp extends StatelessWidget {
  const CivicLinkMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: kAppTitle,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0C5B55)),
        useMaterial3: true,
      ),
      home: const CivicLinkWebViewShell(),
    );
  }
}

class CivicLinkWebViewShell extends StatefulWidget {
  const CivicLinkWebViewShell({super.key});

  @override
  State<CivicLinkWebViewShell> createState() => _CivicLinkWebViewShellState();
}

class _CivicLinkWebViewShellState extends State<CivicLinkWebViewShell> {
  static const String _portalUrl = String.fromEnvironment(
    'CIVICLINK_PORTAL_URL',
    defaultValue: kDefaultPortalUrl,
  );
  static const String _apiBaseUrl = String.fromEnvironment(
    'CIVICLINK_API_BASE_URL',
    defaultValue: kDefaultApiBaseUrl,
  );
  static const String _appRole = String.fromEnvironment(
    'CIVICLINK_APP_ROLE',
    defaultValue: kDefaultAppRole,
  );

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final ImagePicker _imagePicker = ImagePicker();
  final GoogleSignIn _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
  late final WebViewController _controller;
  bool _loading = true;
  bool _hasError = false;
  bool _firebaseReady = false;
  String? _lastJwt;
  String? _lastFcmToken;

  @override
  void initState() {
    super.initState();
    _configureWebView();
    _initializeFirebaseMessaging();
  }

  void _configureWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..addJavaScriptChannel(
        'CivicLinkMobile',
        onMessageReceived: _handleBridgeMessage,
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() {
              _loading = true;
              _hasError = false;
            });
          },
          onPageFinished: (_) {
            if (!mounted) return;
            setState(() => _loading = false);
            _injectNativeGeolocationBridge();
          },
          onWebResourceError: (error) {
            if (!mounted || error.isForMainFrame == false) return;
            setState(() {
              _loading = false;
              _hasError = true;
            });
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) {
              return NavigationDecision.prevent;
            }

            if (_isTrustedNavigation(uri)) {
              return NavigationDecision.navigate;
            }

            launchUrl(uri, mode: LaunchMode.externalApplication);
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(Uri.parse(_portalUrl));

    final platformController = _controller.platform;
    if (platformController is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(true);
      platformController.setMediaPlaybackRequiresUserGesture(false);
      platformController.setOnPlatformPermissionRequest((request) async {
        final cameraStatus = await Permission.camera.request();
        if (cameraStatus.isGranted) {
          await request.grant();
        } else {
          await request.deny();
        }
      });
      platformController.setMixedContentMode(MixedContentMode.alwaysAllow);
      platformController.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (_) async {
          final status = await Permission.locationWhenInUse.request();
          return GeolocationPermissionsResponse(
            allow: status.isGranted,
            retain: true,
          );
        },
      );
      platformController.setOnShowFileSelector(_handleAndroidFileSelection);
    }
  }

  bool _isTrustedNavigation(Uri uri) {
    final portal = Uri.parse(_portalUrl);
    final api = Uri.parse(_apiBaseUrl);
    final host = uri.host.toLowerCase();

    if (host == portal.host.toLowerCase() || host == api.host.toLowerCase()) {
      return true;
    }

    if (_isPrivateLanHost(host)) {
      return true;
    }

    return host.endsWith('firebaseapp.com') ||
        host.endsWith('googleapis.com') ||
        host.endsWith('gstatic.com') ||
        host == 'accounts.google.com' ||
        host == 'nominatim.openstreetmap.org' ||
        host.endsWith('openstreetmap.org');
  }

  bool _isPrivateLanHost(String host) {
    final parts = host.split('.').map(int.tryParse).toList();
    if (parts.length != 4 || parts.any((part) => part == null)) {
      return host == 'localhost';
    }

    final first = parts[0]!;
    final second = parts[1]!;
    return first == 10 ||
        (first == 172 && second >= 16 && second <= 31) ||
        (first == 192 && second == 168);
  }

  Future<List<String>> _handleAndroidFileSelection(
    FileSelectorParams params,
  ) async {
    final acceptTypes = params.acceptTypes
        .expand((type) => type.split(','))
        .map((type) => type.trim().toLowerCase())
        .where((type) => type.isNotEmpty)
        .toList();
    bool isImageType(String type) =>
        type == 'image/*' || type.startsWith('image/');
    final acceptsImage = acceptTypes.any(isImageType);
    final imageOnly = acceptTypes.isNotEmpty && acceptTypes.every(isImageType);

    if (params.isCaptureEnabled && acceptsImage) {
      final cameraFiles = await _pickCameraImage();
      if (cameraFiles.isNotEmpty) {
        return cameraFiles;
      }

      if (imageOnly) {
        return _pickGalleryImage();
      }
    }

    if (acceptsImage) {
      final action = await _chooseFileSelectionAction(allowAnyFile: !imageOnly);
      if (action == _FileSelectionAction.camera) {
        return _pickCameraImage();
      }
      if (action == _FileSelectionAction.gallery) {
        return _pickGalleryImage();
      }
      if (action == null) {
        return <String>[];
      }
    }

    return _pickFiles(params, type: imageOnly ? FileType.image : FileType.any);
  }

  String _toWebViewFileUri(String path) {
    final uri = Uri.tryParse(path);
    if (uri != null && uri.hasScheme) {
      return path;
    }
    return Uri.file(path).toString();
  }

  Future<List<String>> _pickCameraImage() async {
    final cameraStatus = await Permission.camera.request();
    if (!cameraStatus.isGranted) {
      _showSnack('Camera permission is required to take a photo.');
      return <String>[];
    }

    final image = await _imagePicker.pickImage(source: ImageSource.camera);
    return image == null ? <String>[] : <String>[_toWebViewFileUri(image.path)];
  }

  Future<List<String>> _pickGalleryImage() async {
    final image = await _imagePicker.pickImage(source: ImageSource.gallery);
    return image == null ? <String>[] : <String>[_toWebViewFileUri(image.path)];
  }

  Future<List<String>> _pickFiles(
    FileSelectorParams params, {
    required FileType type,
  }) async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: params.mode == FileSelectorMode.openMultiple,
      type: type,
    );

    return result?.paths.whereType<String>().map(_toWebViewFileUri).toList() ??
        <String>[];
  }

  Future<_FileSelectionAction?> _chooseFileSelectionAction({
    required bool allowAnyFile,
  }) async {
    if (!mounted) {
      return allowAnyFile
          ? _FileSelectionAction.file
          : _FileSelectionAction.gallery;
    }

    return showModalBottomSheet<_FileSelectionAction>(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Take photo'),
                onTap: () =>
                    Navigator.pop(context, _FileSelectionAction.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choose photo'),
                onTap: () =>
                    Navigator.pop(context, _FileSelectionAction.gallery),
              ),
              if (allowAnyFile)
                ListTile(
                  leading: const Icon(Icons.attach_file_outlined),
                  title: const Text('Choose file'),
                  onTap: () =>
                      Navigator.pop(context, _FileSelectionAction.file),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _initializeFirebaseMessaging() async {
    try {
      await Firebase.initializeApp();
      _firebaseReady = true;

      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      await _configureLocalNotifications();

      FirebaseMessaging.instance.onTokenRefresh.listen((token) {
        _lastFcmToken = token;
        final jwt = _lastJwt;
        if (jwt != null) {
          _registerDeviceToken(jwt, token);
        }
      });

      FirebaseMessaging.onMessage.listen(_showForegroundNotification);
      FirebaseMessaging.onMessageOpenedApp.listen(
        (message) => _openNotificationPath(message.data['url_path']),
      );

      final initialMessage = await FirebaseMessaging.instance
          .getInitialMessage();
      if (initialMessage != null) {
        _openNotificationPath(initialMessage.data['url_path']);
      }
    } catch (err) {
      debugPrint('Firebase setup skipped: $err');
    }
  }

  Future<void> _configureLocalNotifications() async {
    const channel = AndroidNotificationChannel(
      'civiclink_updates',
      'CivicLink updates',
      description: 'Task and complaint updates from CivicLink.',
      importance: Importance.high,
    );

    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await androidPlugin?.createNotificationChannel(channel);
    await androidPlugin?.requestNotificationsPermission();

    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (response) =>
          _openNotificationPath(response.payload),
    );
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? 'CivicLink';
    final body = notification?.body ?? 'You have a CivicLink update.';
    final payload = message.data['url_path'];

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'civiclink_updates',
        'CivicLink updates',
        channelDescription: 'Task and complaint updates from CivicLink.',
        importance: Importance.high,
        priority: Priority.high,
      ),
    );

    await _localNotifications.show(
      message.hashCode,
      title,
      body,
      details,
      payload: payload,
    );
  }

  void _handleBridgeMessage(JavaScriptMessage message) {
    try {
      final payload = jsonDecode(message.message) as Map<String, dynamic>;
      if (payload['app'] != _appRole) {
        return;
      }

      if (payload['type'] == 'logout') {
        _revokeDeviceToken();
        return;
      }

      if (payload['type'] == 'googleSignIn') {
        _handleNativeGoogleSignIn(payload);
        return;
      }

      if (payload['type'] == 'getLocation') {
        _handleNativeLocationRequest((payload['id'] ?? '').toString());
        return;
      }

      if (payload['type'] == 'session') {
        final jwt = (payload['token'] ?? '').toString();
        if (jwt.isNotEmpty) {
          _lastJwt = jwt;
          _registerCurrentDevice(jwt);
        }
      }
    } catch (err) {
      debugPrint('Ignoring malformed CivicLinkMobile message: $err');
    }
  }

  Future<void> _registerCurrentDevice(String jwt) async {
    if (!_firebaseReady) {
      return;
    }

    final token = await FirebaseMessaging.instance.getToken();
    if (token == null || token.isEmpty) {
      return;
    }

    _lastFcmToken = token;
    await _registerDeviceToken(jwt, token);
  }

  Future<void> _handleNativeGoogleSignIn(Map<String, dynamic> payload) async {
    try {
      if (!_firebaseReady) {
        await Firebase.initializeApp();
        _firebaseReady = true;
      }

      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        _showSnack('Google sign-in was cancelled.');
        return;
      }

      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final firebaseCredential = await FirebaseAuth.instance
          .signInWithCredential(credential);
      final firebaseUser = firebaseCredential.user;
      final idToken = await firebaseUser?.getIdToken(true);

      if (idToken == null || idToken.isEmpty) {
        _showSnack('Google sign-in did not return a Firebase token.');
        return;
      }

      final preferredLanguage = (payload['preferred_language'] ?? '')
          .toString()
          .trim();
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/auth/firebase/session'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'idToken': idToken,
          if (preferredLanguage.isNotEmpty)
            'preferred_language': preferredLanguage,
        }),
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        _showSnack(_extractErrorMessage(response.body));
        return;
      }

      final session = jsonDecode(response.body) as Map<String, dynamic>;
      final jwt = (session['token'] ?? '').toString();
      if (jwt.isEmpty) {
        _showSnack('CivicLink did not return a session token.');
        return;
      }

      _lastJwt = jwt;
      await _registerCurrentDevice(jwt);
      await _injectCitizenSession(session);
      _showSnack('Signed in with Google.');
    } catch (err) {
      debugPrint('Native Google sign-in failed: $err');
      _showSnack('Google sign-in failed. Check Firebase Android setup.');
    }
  }

  Future<void> _injectNativeGeolocationBridge() async {
    await _controller.runJavaScript(r'''
      (function () {
        if (!window.CivicLinkMobile || window.__civiclinkNativeGeoInstalled) {
          return;
        }

        window.__civiclinkNativeGeoInstalled = true;
        window.__civiclinkNativeGeoCallbacks = {};
        let nextLocationRequestId = 1;

        window.__civiclinkNativeLocationResolve = function (id, payload) {
          const callback = window.__civiclinkNativeGeoCallbacks[id];
          if (!callback) {
            return;
          }

          delete window.__civiclinkNativeGeoCallbacks[id];

          if (payload && payload.ok) {
            callback.success({
              coords: {
                latitude: payload.latitude,
                longitude: payload.longitude,
                accuracy: payload.accuracy || 0,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: payload.timestamp || Date.now()
            });
            return;
          }

          if (callback.error) {
            callback.error({
              code: 2,
              message: (payload && payload.message) || 'Location unavailable'
            });
          }
        };

        const geolocation = navigator.geolocation || {};
        geolocation.getCurrentPosition = function (success, error) {
          const id = String(nextLocationRequestId++);
          window.__civiclinkNativeGeoCallbacks[id] = { success, error };
          window.CivicLinkMobile.postMessage(JSON.stringify({
            type: 'getLocation',
            app: 'citizen',
            id
          }));
        };

        geolocation.watchPosition = function (success, error) {
          geolocation.getCurrentPosition(success, error);
          return 1;
        };

        geolocation.clearWatch = function () {};

        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: geolocation
        });
      })();
    ''');
  }

  Future<void> _handleNativeLocationRequest(String requestId) async {
    if (requestId.isEmpty) {
      return;
    }

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        await _resolveLocationRequest(requestId, {
          'ok': false,
          'message': 'Phone location services are disabled.',
        });
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        await _resolveLocationRequest(requestId, {
          'ok': false,
          'message': 'Location permission was denied.',
        });
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      await _resolveLocationRequest(requestId, {
        'ok': true,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
    } catch (err) {
      await _resolveLocationRequest(requestId, {
        'ok': false,
        'message': 'Could not read GPS location.',
      });
    }
  }

  Future<void> _resolveLocationRequest(
    String requestId,
    Map<String, Object?> payload,
  ) async {
    final idJson = jsonEncode(requestId);
    final payloadJson = jsonEncode(payload);
    await _controller.runJavaScript(
      'window.__civiclinkNativeLocationResolve && '
      'window.__civiclinkNativeLocationResolve($idJson, $payloadJson);',
    );
  }

  String _extractErrorMessage(String body) {
    try {
      final decoded = jsonDecode(body) as Map<String, dynamic>;
      return (decoded['message'] ??
              decoded['error'] ??
              'Google sign-in failed.')
          .toString();
    } catch (_) {
      return 'Google sign-in failed.';
    }
  }

  Future<void> _injectCitizenSession(Map<String, dynamic> session) async {
    final sessionJson = jsonEncode(session);
    await _controller.runJavaScript('''
      (function () {
        const session = $sessionJson;
        localStorage.setItem('token', session.token || '');
        localStorage.setItem('role', session.role || '');
        localStorage.setItem('name', session.name || 'Citizen');
        if (session.preferred_language) {
          localStorage.setItem('preferred_language', session.preferred_language);
        } else {
          localStorage.removeItem('preferred_language');
        }
        window.location.href = '/';
      })();
    ''');
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _registerDeviceToken(String jwt, String token) async {
    try {
      await http.post(
        Uri.parse('$_apiBaseUrl/mobile/device-tokens'),
        headers: {
          'Authorization': 'Bearer $jwt',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'fcm_token': token,
          'app': _appRole,
          'platform': 'android',
          'device_label': kAppTitle,
        }),
      );
    } catch (err) {
      debugPrint('Device token registration failed: $err');
    }
  }

  Future<void> _revokeDeviceToken() async {
    final jwt = _lastJwt;
    final token = _lastFcmToken;
    _lastJwt = null;

    if (jwt == null || token == null) {
      return;
    }

    try {
      await http.delete(
        Uri.parse('$_apiBaseUrl/mobile/device-tokens'),
        headers: {
          'Authorization': 'Bearer $jwt',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'fcm_token': token}),
      );
    } catch (err) {
      debugPrint('Device token revoke failed: $err');
    }
  }

  void _openNotificationPath(String? path) {
    if (path == null || path.trim().isEmpty) {
      return;
    }

    final target = Uri.parse(_portalUrl).resolve(path);
    _controller.loadRequest(target);
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _hasError = false;
    });
    await _controller.loadRequest(Uri.parse(_portalUrl));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          await _controller.goBack();
          return;
        }
        await SystemNavigator.pop();
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_loading) const LinearProgressIndicator(minHeight: 3),
              if (_hasError)
                _LanErrorView(portalUrl: _portalUrl, onRetry: _reload),
            ],
          ),
        ),
      ),
    );
  }
}

class _LanErrorView extends StatelessWidget {
  const _LanErrorView({required this.portalUrl, required this.onRetry});

  final String portalUrl;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.wifi_off_rounded,
                size: 52,
                color: Color(0xFF8A1538),
              ),
              const SizedBox(height: 18),
              const Text(
                'Cannot reach CivicLink on this network',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              Text(
                'Make sure the phone and laptop are on the same Wi-Fi, then check that this URL opens in the phone browser:\n$portalUrl',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              FilledButton(onPressed: onRetry, child: const Text('Retry')),
            ],
          ),
        ),
      ),
    );
  }
}
