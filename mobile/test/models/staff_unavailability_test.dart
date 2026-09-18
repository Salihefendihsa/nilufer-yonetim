// Bölüm K (3. tur): StaffUnavailability model testleri.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/staff_unavailability.dart';

void main() {
  group('StaffUnavailability', () {
    test('tüm gün kaydı: saatler null, rangeLabel "Tüm gün"', () {
      final u = StaffUnavailability.fromJson({
        'id': 'u1',
        'staffId': 's1',
        'date': '2026-10-03',
        'startTime': null,
        'endTime': null,
        'reason': null,
      });
      expect(u.isAllDay, isTrue);
      expect(u.rangeLabel, 'Tüm gün');
      expect(u.date, '2026-10-03');
    });

    test('saat aralığı kaydı: rangeLabel "13:00 – 17:00"', () {
      final u = StaffUnavailability.fromJson({
        'id': 'u2',
        'staffId': 's1',
        'date': '2026-10-03',
        'startTime': '13:00',
        'endTime': '17:00',
        'reason': 'Doktor',
      });
      expect(u.isAllDay, isFalse);
      expect(u.rangeLabel, '13:00 – 17:00');
      expect(u.reason, 'Doktor');
    });

    test('/staff/unavailability?date= satırında date yoksa boş string (çağıran doldurur)', () {
      final u = StaffUnavailability.fromJson({'id': 'u3', 'staffId': 's9'});
      expect(u.date, '');
      final filled = StaffUnavailability.fromJson({'id': 'u3', 'staffId': 's9', 'date': '2026-10-04'});
      expect(filled.date, '2026-10-04');
    });
  });
}
