import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../models/user.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// backend/src/controllers/authController.ts ile birebir akış:
/// - login: POST /auth/login (7 günlük token, yenileme endpoint'i yok)
/// - logout: POST /auth/logout (yalnızca UserSession.logoutAt işaretler,
///   token'ı sunucu tarafında GEÇERSİZ KILMAZ — bkz. PROJECT_HANDOFF_TR.md §6).
///   Bu yüzden logout'ta token'ı cihazdan silmek asıl güvenlik sınırıdır.
class AuthProvider extends ChangeNotifier {
  AuthStatus status = AuthStatus.unknown;
  AppUser? user;
  String? loginError;
  bool isBusy = false;

  Timer? _heartbeatTimer;

  AuthProvider() {
    ApiClient.instance.onUnauthorized = _handleUnauthorized;
  }

  Future<void> restoreSession() async {
    final token = await SecureStorage.readToken();
    final userJson = await SecureStorage.readUserJson();
    if (token == null || userJson == null) {
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    try {
      user = AppUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
      status = AuthStatus.authenticated;
      _startHeartbeat();
    } catch (_) {
      await SecureStorage.clear();
      status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  /// web/src/lib/AuthProvider.tsx ile aynı desen: her ~2 dakikada bir
  /// UserSession.lastActiveAt günceller (oturum süre takibi için).
  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(minutes: 2), (_) {
      ApiClient.instance.post('/auth/heartbeat').catchError((_) => null);
    });
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    super.dispose();
  }

  Future<bool> login(
    String email,
    String password, {
    String? recaptchaToken,
  }) async {
    isBusy = true;
    loginError = null;
    notifyListeners();
    try {
      final res = await ApiClient.instance.post<Map<String, dynamic>>(
        '/auth/login',
        body: {
          'email': email,
          'password': password,
          if (recaptchaToken != null) 'recaptchaToken': recaptchaToken,
        },
      );
      final token = res['token'] as String;
      final userJson = res['user'] as Map<String, dynamic>;
      await SecureStorage.saveSession(
        token: token,
        userJson: jsonEncode(userJson),
      );
      user = AppUser.fromJson(userJson);
      status = AuthStatus.authenticated;
      _startHeartbeat();
      return true;
    } on ApiException catch (e) {
      loginError = e.message;
      return false;
    } finally {
      isBusy = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await ApiClient.instance.post('/auth/logout');
    } catch (_) {
      // best-effort: sunucu ulaşılamaz olsa bile cihazdaki oturum temizlenir
    }
    await _clearLocalSession();
  }

  Future<void> _handleUnauthorized() async {
    await _clearLocalSession();
  }

  Future<void> _clearLocalSession() async {
    _heartbeatTimer?.cancel();
    await SecureStorage.clear();
    user = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
