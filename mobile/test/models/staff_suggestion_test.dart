// Bölüm Z (6. tur): StaffSuggestion ayrıştırma ve ipucu metni.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/staff/staff_suggestion.dart';

void main() {
  test('önerilen ve müsait satır', () {
    final s = StaffSuggestion.fromJson({'staffId': 'a', 'fullName': 'Ali', 'todayJobCount': 1, 'isUnavailable': false, 'isRecommended': true});
    expect(s.isRecommended, isTrue);
    expect(s.hint, 'Bugün 1 iş');
  });

  test('müsait olmayan satır neden taşır; eksik alanlar çökmez', () {
    final s = StaffSuggestion.fromJson({'staffId': 'b', 'isUnavailable': true, 'unavailableReason': 'İzinli'});
    expect(s.fullName, '—');
    expect(s.todayJobCount, 0);
    expect(s.hint, 'Bugün 0 iş · ⚠ İzinli');
  });
}
