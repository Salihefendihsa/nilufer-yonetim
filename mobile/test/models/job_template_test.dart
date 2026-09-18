// Bölüm T (5. tur): JobTemplate ayrıştırma ve özet satırı.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/admin/job_templates_screen.dart';

void main() {
  test('JobTemplate.fromJson — Decimal string fiyat, özet satırı', () {
    final t = JobTemplate.fromJson({
      'id': 't1',
      'name': 'Standart Ev',
      'serviceType': 'Genel İlaçlama',
      'defaultPrice': '1250.50',
      'defaultDurationMinutes': 90,
      'defaultNotes': 'Mutfak öncelikli',
      'isActive': true,
    });
    expect(t.defaultPrice, 1250.5);
    expect(t.summary, 'Genel İlaçlama · 1251 ₺ · 90 dk');
  });

  test('opsiyonel alanlar yokken özet yalnızca hizmet türü', () {
    final t = JobTemplate.fromJson({'id': 't2', 'name': 'x', 'serviceType': 'Fare'});
    expect(t.defaultPrice, isNull);
    expect(t.defaultDurationMinutes, isNull);
    expect(t.isActive, isTrue);
    expect(t.summary, 'Fare');
  });
}
