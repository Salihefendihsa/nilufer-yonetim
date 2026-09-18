// Bölüm V (5. tur): EvaluationHistory ayrıştırma — evaluator alanı olmadan da çalışır.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/staff/evaluation_trend_card.dart';

void main() {
  test('kronolojik noktalar, ortalama ve delta', () {
    final h = EvaluationHistory.fromJson({
      'staffId': 's',
      'data': [
        {'periodLabel': '2026-Q1', 'averageScore': 12, 'achievementTier': 'BRONZE'},
        {'periodLabel': '2026-Q2', 'averageScore': 15.5, 'achievementTier': 'SILVER'},
      ],
      'overallAverage': 13.75,
      'lastDelta': 3.5,
    });
    expect(h.data.map((p) => p.periodLabel), ['2026-Q1', '2026-Q2']);
    expect(h.data.last.averageScore, 15.5);
    expect(h.overallAverage, 13.75);
    expect(h.lastDelta, 3.5);
  });

  test('boş geçmiş: liste boş, ortalama/delta null', () {
    final h = EvaluationHistory.fromJson({'data': [], 'overallAverage': null, 'lastDelta': null});
    expect(h.data, isEmpty);
    expect(h.overallAverage, isNull);
    expect(h.lastDelta, isNull);
  });
}
