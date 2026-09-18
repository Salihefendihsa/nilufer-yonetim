// Bölüm AK (8. tur): duyuru modeli ve kapatma (dismiss) mantığı testleri.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/widgets/announcement_banner.dart';

void main() {
  final a = Announcement.fromJson({
    'id': 'a1',
    'message': 'Bakım: 02:00–04:00',
    'createdAt': '2026-09-18T08:00:00.000Z',
    'expiresAt': null,
  });

  test('fromJson alanları okur', () {
    expect(a.id, 'a1');
    expect(a.message, 'Bakım: 02:00–04:00');
    expect(a.expiresAt, isNull);
  });

  test('kapatılan ID eşleşirse gizli; farklı/yeni duyuru görünür', () {
    expect(a.isVisible(null), isTrue);
    expect(a.isVisible('a1'), isFalse);
    expect(a.isVisible('eski-duyuru'), isTrue);
  });
}
