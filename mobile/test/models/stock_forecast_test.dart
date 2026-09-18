// Bölüm W (5. tur): Product.forecast ayrıştırma ve etiket.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/product.dart';

Map<String, dynamic> _base() => {
      'id': 'p1', 'name': 'Ürün', 'unit': 'L', 'currentStock': '45', 'criticalThreshold': '5',
    };

void main() {
  test('tahmin varsa etiket, gün sayısı okunur', () {
    final p = Product.fromJson({..._base(), 'forecast': {'estimatedDaysRemaining': 22, 'dailyAverageUsage': 2}});
    expect(p.forecastDaysRemaining, 22);
    expect(p.forecastDailyUsage, 2.0);
    expect(p.forecastLabel, 'Tahmini 22 gün sonra biter');
  });

  test('0 gün → Tükendi; veri yoksa null (etiket gizli)', () {
    expect(Product.fromJson({..._base(), 'forecast': {'estimatedDaysRemaining': 0}}).forecastLabel, 'Tükendi');
    expect(Product.fromJson({..._base(), 'forecast': {'estimatedDaysRemaining': null, 'note': 'Tahmin için yeterli veri yok'}}).forecastLabel, isNull);
    expect(Product.fromJson(_base()).forecastLabel, isNull);
  });
}
