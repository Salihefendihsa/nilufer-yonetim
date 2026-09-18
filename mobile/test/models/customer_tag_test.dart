// Bölüm X (6. tur): CustomerTag ayrıştırma ve renk dönüşümü.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/customers/customer_tags.dart';
import 'package:nilufer_mobile/models/customer.dart';

void main() {
  test('CustomerTag.fromJson ve hex → Color', () {
    final t = CustomerTag.fromJson({'id': 't1', 'name': 'VIP', 'color': '#B57F13', 'isActive': true, 'customerCount': 3});
    expect(t.customerCount, 3);
    expect(t.colorValue, const Color(0xFFB57F13));
    expect(colorToHex(const Color(0xFFB57F13)), '#B57F13');
  });

  test('bozuk hex marka yeşiline düşer; Customer.tags düz liste', () {
    expect(colorFromHex('mavi'), isNot(const Color(0x00000000)));
    final c = Customer.fromJson({
      'id': 'c', 'userId': null, 'fullName': 'A', 'phone': '0', 'email': null, 'address': null, 'district': null,
      'createdAt': '2026-01-01', 'tags': [{'id': 't1', 'name': 'VIP', 'color': '#B57F13'}],
    });
    expect(c.tags.length, 1);
    expect(CustomerTag.fromJson(c.tags.first).name, 'VIP');
  });
}
