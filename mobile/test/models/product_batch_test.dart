// Bölüm AM (9. tur): ProductBatch ayrıştırma, SKT renk tonu ve etiket.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/product_batch.dart';

Map<String, dynamic> _base({int daysLeft = 45, bool isExpired = false, String remaining = '4.00'}) => {
      'id': 'b1',
      'productId': 'p1',
      'batchNumber': 'LOT-1',
      'expiryDate': '2026-12-01T00:00:00.000Z',
      'quantityReceived': '10.00',
      'quantityRemaining': remaining,
      'receivedAt': '2026-09-01T08:00:00.000Z',
      'daysLeft': daysLeft,
      'isExpired': isExpired,
      'supplier': {'id': 's1', 'name': 'Tedarikçi A'},
      'product': {'id': 'p1', 'name': 'İlaç', 'unit': 'L'},
    };

void main() {
  test('alanlar ve ilişkiler okunur', () {
    final b = ProductBatch.fromJson(_base());
    expect(b.batchNumber, 'LOT-1');
    expect(b.quantityRemaining, 4.0);
    expect(b.supplierName, 'Tedarikçi A');
    expect(b.productName, 'İlaç');
    expect(b.isDepleted, isFalse);
  });

  test('ton: dolmuş/≤7 kırmızı, ≤30 sarı, aksi yeşil', () {
    expect(ProductBatch.fromJson(_base(daysLeft: -2, isExpired: true)).tone, BatchTone.red);
    expect(ProductBatch.fromJson(_base(daysLeft: 7)).tone, BatchTone.red);
    expect(ProductBatch.fromJson(_base(daysLeft: 20)).tone, BatchTone.yellow);
    expect(ProductBatch.fromJson(_base(daysLeft: 45)).tone, BatchTone.green);
  });

  test('etiket: dolmuş ayrı işaretlenir; tükenen parti', () {
    expect(ProductBatch.fromJson(_base(daysLeft: -3, isExpired: true)).expiryLabel, 'Süresi 3 gün önce doldu');
    expect(ProductBatch.fromJson(_base(daysLeft: 0)).expiryLabel, 'Bugün son gün');
    expect(ProductBatch.fromJson(_base(daysLeft: 12)).expiryLabel, '12 gün kaldı');
    expect(ProductBatch.fromJson(_base(remaining: '0.00')).isDepleted, isTrue);
  });
}
