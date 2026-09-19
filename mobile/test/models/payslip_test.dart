// Bölüm AN (9. tur): Payslip ayrıştırma ve net tutarlılığı.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/payslip.dart';

void main() {
  final json = {
    'staffId': 's1',
    'month': '2026-03',
    'salaryBase': 20000,
    'bonusTotal': 1500,
    'bonusCount': 1,
    'advanceTotal': 3000,
    'advanceCount': 1,
    'net': 18500,
    'bonuses': [
      {'id': 'b1', 'amount': 1500, 'approvedAt': '2026-03-15T09:00:00.000Z', 'periodName': 'Q1'},
    ],
    'advances': [
      {'id': 'a1', 'amount': 3000, 'reason': 'Kira', 'createdAt': '2026-03-10T09:00:00.000Z'},
    ],
  };

  test('alanlar okunur, satır etiketleri üretilir', () {
    final p = Payslip.fromJson(json);
    expect(p.month, '2026-03');
    expect(p.salaryBase, 20000);
    expect(p.net, 18500);
    expect(p.bonuses.single.label, 'Prim · Q1');
    expect(p.advances.single.label, 'Avans · Kira');
    expect(p.advances.single.date, isNotNull);
  });

  test('net = taban + prim − avans (sunucu ile tutarlı)', () {
    final p = Payslip.fromJson(json);
    expect(p.computedNet, p.net);
  });

  test('boş listeler / eksik alanlar varsayılanla okunur', () {
    final p = Payslip.fromJson({'month': '2026-01', 'salaryBase': 10000, 'net': 10000});
    expect(p.bonuses, isEmpty);
    expect(p.advances, isEmpty);
    expect(p.bonusCount, 0);
    expect(p.computedNet, 10000);
  });
}
