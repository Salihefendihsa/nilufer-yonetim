import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Token ve kullanıcı bilgisini Android Keystore / iOS Keychain üzerinden
/// güvenli şekilde saklar (web'in aksine localStorage kullanılmaz).
class SecureStorage {
  SecureStorage._();
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _tokenKey = 'auth_token';
  static const _userKey = 'auth_user_json';
  static const _mustChangePasswordKey = 'auth_must_change_password';
  // OWNER'ın orijinal (impersonate öncesi) oturumu — "Çık" ile geri dönmek için.
  static const _ownerTokenKey = 'impersonation_owner_token';
  static const _ownerUserKey = 'impersonation_owner_user_json';
  static const _impersonationMetaKey = 'impersonation_meta_json';

  static Future<void> saveSession({
    required String token,
    required String userJson,
    bool mustChangePassword = false,
  }) async {
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _userKey, value: userJson);
    await _storage.write(
      key: _mustChangePasswordKey,
      value: mustChangePassword ? '1' : '0',
    );
  }

  static Future<String?> readToken() => _storage.read(key: _tokenKey);
  static Future<String?> readUserJson() => _storage.read(key: _userKey);

  static Future<bool> readMustChangePassword() async =>
      (await _storage.read(key: _mustChangePasswordKey)) == '1';

  static Future<void> setMustChangePassword(bool value) =>
      _storage.write(key: _mustChangePasswordKey, value: value ? '1' : '0');

  /// OWNER'ın kendi token'ını saklayıp hedef kullanıcının oturumuna geçer.
  static Future<void> beginImpersonation({
    required String targetToken,
    required String targetUserJson,
    required String impersonationMetaJson,
  }) async {
    final ownerToken = await readToken();
    final ownerUser = await readUserJson();
    if (ownerToken != null) {
      await _storage.write(key: _ownerTokenKey, value: ownerToken);
    }
    if (ownerUser != null) {
      await _storage.write(key: _ownerUserKey, value: ownerUser);
    }
    await _storage.write(
      key: _impersonationMetaKey,
      value: impersonationMetaJson,
    );
    await saveSession(token: targetToken, userJson: targetUserJson);
  }

  static Future<String?> readImpersonationMetaJson() =>
      _storage.read(key: _impersonationMetaKey);

  /// Sunucu tarafında oturumu sonlandırdıktan SONRA çağrılmalı.
  static Future<void> restoreOwnerSession() async {
    final ownerToken = await _storage.read(key: _ownerTokenKey);
    final ownerUser = await _storage.read(key: _ownerUserKey);
    await _storage.delete(key: _ownerTokenKey);
    await _storage.delete(key: _ownerUserKey);
    await _storage.delete(key: _impersonationMetaKey);
    if (ownerToken != null && ownerUser != null) {
      await saveSession(token: ownerToken, userJson: ownerUser);
    }
  }

  static Future<void> clear() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
    await _storage.delete(key: _mustChangePasswordKey);
    await _storage.delete(key: _ownerTokenKey);
    await _storage.delete(key: _ownerUserKey);
    await _storage.delete(key: _impersonationMetaKey);
  }
}
