import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../models/user.dart';

enum AuthStatus { unknown, authenticated, unauthenticated, twoFactorRequired }

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
  bool mustChangePassword = false;
  Map<String, dynamic>? impersonationMeta;
  /// /auth/login "twoFactorRequired" döndüğünde yalnızca /auth/2fa/verify'de
  /// kullanılabilecek kısa ömürlü kimlik — bkz. docs/NEW_FEATURES_TOUR.md Bölüm D.
  String? twoFactorPreToken;

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
      mustChangePassword = await SecureStorage.readMustChangePassword();
      final metaJson = await SecureStorage.readImpersonationMetaJson();
      impersonationMeta = metaJson != null
          ? jsonDecode(metaJson) as Map<String, dynamic>
          : null;
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
      if (res['twoFactorRequired'] == true) {
        twoFactorPreToken = res['preToken'] as String;
        status = AuthStatus.twoFactorRequired;
        return true;
      }
      final token = res['token'] as String;
      final userJson = res['user'] as Map<String, dynamic>;
      mustChangePassword = res['mustChangePassword'] as bool? ?? false;
      await SecureStorage.saveSession(
        token: token,
        userJson: jsonEncode(userJson),
        mustChangePassword: mustChangePassword,
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

  /// /auth/login "twoFactorRequired" döndükten sonraki ikinci adım —
  /// authenticator kodu VEYA kurtarma kodu ile gerçek oturumu açar.
  Future<bool> verifyTwoFactor({String? code, String? recoveryCode}) async {
    if (twoFactorPreToken == null) return false;
    isBusy = true;
    loginError = null;
    notifyListeners();
    try {
      final res = await ApiClient.instance.post<Map<String, dynamic>>(
        '/auth/2fa/verify',
        body: {
          'preToken': twoFactorPreToken,
          if (code != null) 'code': code,
          if (recoveryCode != null) 'recoveryCode': recoveryCode,
        },
      );
      final token = res['token'] as String;
      final userJson = res['user'] as Map<String, dynamic>;
      mustChangePassword = res['mustChangePassword'] as bool? ?? false;
      await SecureStorage.saveSession(
        token: token,
        userJson: jsonEncode(userJson),
        mustChangePassword: mustChangePassword,
      );
      user = AppUser.fromJson(userJson);
      twoFactorPreToken = null;
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

  /// 2FA ekranından "Vazgeç, tekrar giriş yap" — login ekranına döner.
  void cancelTwoFactor() {
    twoFactorPreToken = null;
    loginError = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  /// Zorunlu (OWNER tarafından sıfırlanan) veya isteğe bağlı şifre değişimi —
  /// backend/src/controllers/authController.ts:changePassword.
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    isBusy = true;
    loginError = null;
    notifyListeners();
    try {
      final res = await ApiClient.instance.post<Map<String, dynamic>>(
        '/auth/change-password',
        body: {'currentPassword': currentPassword, 'newPassword': newPassword},
      );
      final token = res['token'] as String;
      final userJson = res['user'] as Map<String, dynamic>;
      mustChangePassword = false;
      await SecureStorage.saveSession(
        token: token,
        userJson: jsonEncode(userJson),
        mustChangePassword: false,
      );
      user = AppUser.fromJson(userJson);
      return true;
    } on ApiException catch (e) {
      loginError = e.message;
      return false;
    } finally {
      isBusy = false;
      notifyListeners();
    }
  }

  /// OWNER'ın kendi oturumunu saklayıp hedef kullanıcının oturumuna geçmesi —
  /// backend/src/controllers/adminController.ts:startImpersonation.
  Future<void> beginImpersonation({
    required String token,
    required Map<String, dynamic> targetUserJson,
    required Map<String, dynamic> impersonationMetaJson,
  }) async {
    await SecureStorage.beginImpersonation(
      targetToken: token,
      targetUserJson: jsonEncode(targetUserJson),
      impersonationMetaJson: jsonEncode(impersonationMetaJson),
    );
    user = AppUser.fromJson(targetUserJson);
    impersonationMeta = impersonationMetaJson;
    mustChangePassword = false;
    _startHeartbeat();
    notifyListeners();
  }

  /// Sunucu tarafı /admin/impersonate/end çağrısı yapıldıktan SONRA çağrılmalı.
  Future<void> endImpersonation() async {
    await SecureStorage.restoreOwnerSession();
    final userJson = await SecureStorage.readUserJson();
    if (userJson != null) {
      user = AppUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
    }
    impersonationMeta = null;
    notifyListeners();
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
