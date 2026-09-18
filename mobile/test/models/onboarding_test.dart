// Bölüm U (5. tur): OnboardingChecklist ayrıştırma.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/staff/onboarding_card.dart';

void main() {
  test('OnboardingChecklist.fromJson — ilerleme ve işaretleyen adı', () {
    final c = OnboardingChecklist.fromJson({
      'staffId': 's1',
      'items': [
        {'id': 'i1', 'item': 'Kimlik/Evrak Teslim Alındı', 'isCompleted': true, 'completedAt': '2026-09-18T09:00:00.000Z', 'completedBy': {'id': 'u', 'fullName': 'Patron'}},
        {'id': 'i2', 'item': 'İş Sözleşmesi İmzalandı', 'isCompleted': false},
      ],
      'progress': {'total': 2, 'completed': 1, 'percent': 50, 'isComplete': false},
    });
    expect(c.items.length, 2);
    expect(c.items.first.completedByName, 'Patron');
    expect(c.items.last.completedAt, isNull);
    expect(c.percent, 50);
    expect(c.isComplete, isFalse);
  });

  test('boş yanıt çökmez', () {
    final c = OnboardingChecklist.fromJson({});
    expect(c.items, isEmpty);
    expect(c.total, 0);
  });
}
