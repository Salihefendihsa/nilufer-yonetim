import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nilufer_mobile/auth/auth_provider.dart';
import 'package:nilufer_mobile/core/api_client.dart';
import 'package:nilufer_mobile/core/secure_storage.dart';

class FakeLogoutStorage implements SessionStorage {
  FakeLogoutStorage(
    this.values, {
    this.failClear = false,
    this.failRead = false,
  });

  final Map<String, String> values;
  final bool failClear;
  final bool failRead;
  int clearCalls = 0;

  @override
  Future<String?> readToken() async {
    if (failRead) throw StateError('Gizli okuma ayrıntısı');
    return values['auth_token'];
  }

  @override
  Future<String?> readUserJson() async => values['auth_user_json'];

  @override
  Future<bool> readMustChangePassword() async => false;

  @override
  Future<String?> readImpersonationMetaJson() async => null;

  @override
  Future<void> clear() async {
    clearCalls++;
    if (failClear) throw StateError('Gizli depolama ayrıntısı');
    values.clear();
  }
}

void main() {
  Map<String, String> session(String token) => {
    'auth_token': token,
    'auth_user_json': jsonEncode({
      'id': 'user-1',
      'email': 'test@example.invalid',
      'fullName': 'Test Kullanıcı',
      'role': 'STAFF',
    }),
  };

  AuthProvider provider(
    FakeLogoutStorage storage,
    Future<void> Function(String) request, {
    Duration timeout = const Duration(milliseconds: 20),
  }) {
    final auth = AuthProvider(
      sessionStorage: storage,
      logoutRequest: request,
      logoutTimeout: timeout,
    );
    addTearDown(() {
      auth.dispose();
      ApiClient.instance.onUnauthorized = null;
    });
    return auth;
  }

  test('yanıtsız uzak istek yerel çıkışı bekletmez', () async {
    final storage = FakeLogoutStorage(session('old-token'));
    final pending = Completer<void>();
    final sentTokens = <String>[];
    final auth = provider(storage, (token) {
      sentTokens.add(token);
      return pending.future;
    });
    await auth.restoreSession();

    await auth.logout();

    expect(auth.status, AuthStatus.unauthenticated);
    expect(auth.user, isNull);
    expect(auth.isBusy, isFalse);
    expect(storage.values, isEmpty);
    expect(storage.clearCalls, 1);
    expect(sentTokens, ['old-token']);
    await Future<void>.delayed(const Duration(milliseconds: 30));
    expect(auth.status, AuthStatus.unauthenticated);
  });

  test('ağ hatasında yerel oturum temizlenir', () async {
    final storage = FakeLogoutStorage(session('old-token'));
    final auth = provider(storage, (_) async => throw StateError('Ağ hatası'));
    await auth.restoreSession();

    await auth.logout();

    expect(storage.clearCalls, 1);
    expect(storage.values, isEmpty);
    expect(auth.status, AuthStatus.unauthenticated);
    expect(auth.loginError, isNull);
  });

  test('token okuma hatasında da yerel çıkış tamamlanır', () async {
    final storage = FakeLogoutStorage(session('old-token'), failRead: true);
    final sentTokens = <String>[];
    final auth = provider(storage, (token) async => sentTokens.add(token));

    await auth.logout();

    expect(auth.status, AuthStatus.unauthenticated);
    expect(storage.values, isEmpty);
    expect(storage.clearCalls, 1);
    expect(sentTokens, isEmpty);
  });

  test('başarılı çıkış eski token ile bildirilir', () async {
    final storage = FakeLogoutStorage(session('old-token'));
    final sentTokens = <String>[];
    final auth = provider(storage, (token) async => sentTokens.add(token));
    await auth.restoreSession();

    await auth.logout();

    expect(sentTokens, ['old-token']);
    expect(storage.values, isEmpty);
    expect(auth.status, AuthStatus.unauthenticated);
  });

  test('eski çıkışın gecikmiş 401 yanıtı yeni oturumu temizlemez', () async {
    final storage = FakeLogoutStorage(session('old-token'));
    final pending = Completer<void>();
    final auth = provider(storage, (_) => pending.future);
    await auth.restoreSession();
    await auth.logout();
    storage.values.addAll(session('new-token'));
    await auth.restoreSession();
    expect(auth.status, AuthStatus.authenticated);

    pending.completeError(ApiException(401, 'Oturum sona erdi'));
    await Future<void>.delayed(Duration.zero);

    expect(auth.status, AuthStatus.authenticated);
    expect(auth.user?.id, 'user-1');
    expect(storage.values['auth_token'], 'new-token');
    expect(storage.clearCalls, 1);
  });

  test(
    'depolama temizliği hatası görünür kalır ve unknown durumuna dönmez',
    () async {
      final storage = FakeLogoutStorage(session('old-token'), failClear: true);
      final auth = provider(storage, (_) async {});
      await auth.restoreSession();

      await auth.logout();

      expect(auth.status, AuthStatus.unauthenticated);
      expect(auth.user, isNull);
      expect(auth.isBusy, isFalse);
      expect(storage.clearCalls, 1);
      expect(storage.values['auth_token'], 'old-token');
      expect(auth.loginError, contains('temizlenemedi'));
      expect(auth.loginError, isNot(contains('Gizli')));
    },
  );
}
