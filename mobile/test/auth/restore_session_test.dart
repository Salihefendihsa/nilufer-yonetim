import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nilufer_mobile/auth/auth_provider.dart';
import 'package:nilufer_mobile/core/api_client.dart';
import 'package:nilufer_mobile/core/secure_storage.dart';
import 'package:nilufer_mobile/models/user.dart';

class FakeSessionStorage implements SessionStorage {
  FakeSessionStorage(this.values, {this.failingKey});

  final Map<String, String> values;
  final String? failingKey;
  int clearCalls = 0;

  Future<String?> _read(String key) async {
    if (key == failingKey) throw StateError('Okuma başarısız');
    return values[key];
  }

  @override
  Future<String?> readToken() => _read('auth_token');

  @override
  Future<String?> readUserJson() => _read('auth_user_json');

  @override
  Future<bool> readMustChangePassword() async =>
      (await _read('auth_must_change_password')) == '1';

  @override
  Future<String?> readImpersonationMetaJson() =>
      _read('impersonation_meta_json');

  @override
  Future<void> clear() async {
    clearCalls++;
    values.clear();
  }
}

void main() {
  final savedSession = <String, String>{
    'auth_token': 'test-token',
    'auth_user_json': jsonEncode({
      'id': 'user-1',
      'email': 'test@example.invalid',
      'fullName': 'Test Kullanıcı',
      'role': 'STAFF',
    }),
    'auth_must_change_password': '1',
    'impersonation_meta_json': jsonEncode({'active': true}),
  };

  AuthProvider createProvider(FakeSessionStorage storage) {
    final provider = AuthProvider(sessionStorage: storage);
    addTearDown(() {
      provider.dispose();
      ApiClient.instance.onUnauthorized = null;
    });
    return provider;
  }

  for (final failingKey in ['auth_token', 'auth_user_json']) {
    test(
      '$failingKey okuması hata verirse giriş durumuna geçer, veri kalır',
      () async {
        final storage = FakeSessionStorage(
          Map.of(savedSession),
          failingKey: failingKey,
        );
        final provider = createProvider(storage);
        var notifications = 0;
        provider.addListener(() => notifications++);

        await provider.restoreSession();

        expect(provider.status, AuthStatus.unauthenticated);
        expect(provider.user, isNull);
        expect(notifications, 1);
        expect(storage.clearCalls, 0);
        expect(storage.values, savedSession);
      },
    );
  }

  test(
    'geçerli kayıt kullanıcıyı ve oturum bayraklarını geri yükler',
    () async {
      final storage = FakeSessionStorage(Map.of(savedSession));
      final provider = createProvider(storage);

      await provider.restoreSession();

      expect(provider.status, AuthStatus.authenticated);
      expect(provider.user?.role, AppRole.staff);
      expect(provider.user?.id, 'user-1');
      expect(provider.mustChangePassword, isTrue);
      expect(provider.impersonationMeta, {'active': true});
      expect(storage.clearCalls, 0);
      expect(storage.values, savedSession);
    },
  );

  test('kayıt yoksa giriş durumuna geçer', () async {
    final storage = FakeSessionStorage({});
    final provider = createProvider(storage);

    await provider.restoreSession();

    expect(provider.status, AuthStatus.unauthenticated);
    expect(provider.user, isNull);
    expect(storage.clearCalls, 0);
  });

  test('API oturumu geçersiz sayarsa kayıtlı oturum temizlenir', () async {
    final storage = FakeSessionStorage(Map.of(savedSession));
    final provider = createProvider(storage);
    await provider.restoreSession();

    await ApiClient.instance.onUnauthorized?.call();

    expect(provider.status, AuthStatus.unauthenticated);
    expect(provider.user, isNull);
    expect(storage.clearCalls, 1);
    expect(storage.values, isEmpty);
  });
}
