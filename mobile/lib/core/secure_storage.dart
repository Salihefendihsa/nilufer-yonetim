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

  static Future<void> saveSession({
    required String token,
    required String userJson,
  }) async {
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _userKey, value: userJson);
  }

  static Future<String?> readToken() => _storage.read(key: _tokenKey);
  static Future<String?> readUserJson() => _storage.read(key: _userKey);

  static Future<void> clear() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }
}
