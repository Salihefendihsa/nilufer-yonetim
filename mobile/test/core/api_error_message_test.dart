// 429 (istek limiti) ve genel hata mesajı seçimi — HEALTH_AUDIT G-1/U-6.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/core/api_client.dart';

void main() {
  test('backend Türkçe { error } mesajı öncelikli', () {
    expect(apiErrorMessage(400, {'error': 'Geçersiz iş'}), 'Geçersiz iş');
    expect(
      apiErrorMessage(429, {'error': 'Çok fazla deneme yapıldı'}),
      'Çok fazla deneme yapıldı',
    );
  });

  test('429 gövdesiz / JSON değilse net bekleme mesajı', () {
    expect(apiErrorMessage(429, null), tooManyRequestsMessage);
    expect(apiErrorMessage(429, 'Too many requests'), tooManyRequestsMessage);
    expect(apiErrorMessage(429, {'error': ''}), tooManyRequestsMessage);
    expect(tooManyRequestsMessage, contains('Çok fazla istek'));
  });

  test('diğer durumlarda fallback', () {
    expect(apiErrorMessage(500, null), 'Bir hata oluştu');
    expect(
      apiErrorMessage(404, null, fallback: 'Dosya indirilemedi'),
      'Dosya indirilemedi',
    );
  });
}
