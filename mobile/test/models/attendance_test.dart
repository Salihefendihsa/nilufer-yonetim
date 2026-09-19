// Bölüm AR (9. tur): AttendanceRecord/AttendanceMonth ayrıştırma ve toplam tutarlılığı.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/attendance.dart';

void main() {
  Map<String, dynamic> rec(String id, String? out, double? hours) => {
        'id': id,
        'staffId': 's1',
        'date': '2026-03-0${id.length}T00:00:00.000Z',
        'clockInAt': '2026-03-02T06:00:00.000Z',
        'clockOutAt': out,
        'note': null,
        'createdAt': '2026-03-02T06:00:00.000Z',
        'workedHours': hours,
      };

  test('açık kayıt: çıkış yok, workedHours null', () {
    final r = AttendanceRecord.fromJson(rec('a', null, null));
    expect(r.isOpen, isTrue);
    expect(r.isComplete, isFalse);
    expect(r.workedHours, isNull);
  });

  test('aylık özet: toplam saat sunucu ile tutarlı, açık kayıt toplama girmez', () {
    final m = AttendanceMonth.fromJson({
      'staffId': 's1',
      'month': '2026-03',
      'totalHours': 14.5,
      'completedDays': 2,
      'openCount': 1,
      'data': [
        rec('a', '2026-03-02T14:00:00.000Z', 8),
        rec('bb', '2026-03-03T12:30:00.000Z', 6.5),
        rec('ccc', null, null),
      ],
    });
    expect(m.records.length, 3);
    expect(m.computedTotalHours, m.totalHours);
    expect(m.completedDays, 2);
    expect(m.openCount, 1);
    expect(m.records.where((r) => r.isComplete).length, 2);
  });
}
