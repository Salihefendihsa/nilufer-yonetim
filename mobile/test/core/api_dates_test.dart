// API tarih biçimi (HEALTH_AUDIT §2.3): takvim günü "YYYY-AA-GG" (web ile
// aynı), saatli an UTC ISO (…Z) — sunucunun saat diliminden bağımsız.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/core/api_dates.dart';

void main() {
  test('apiDate yerel takvim gününü saat olmadan verir', () {
    expect(apiDate(DateTime(2026, 9, 5)), '2026-09-05');
    expect(apiDate(DateTime(2026, 12, 31, 23, 59)), '2026-12-31');
    expect(apiDate(DateTime(2026, 1, 1, 0, 1)), '2026-01-01');
  });

  test('apiInstant her zaman UTC ve Z ekli', () {
    final local = DateTime(2026, 9, 5, 14, 30);
    final s = apiInstant(local);
    expect(s.endsWith('Z'), isTrue);
    expect(DateTime.parse(s).isAtSameMomentAs(local), isTrue);
    expect(apiInstant(DateTime.utc(2026, 9, 5, 11, 30)), '2026-09-05T11:30:00.000Z');
  });
}
