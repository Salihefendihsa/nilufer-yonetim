// Bölüm P (4. tur): CustomerReferral ayrıştırma.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/customers/referral_screen.dart';

void main() {
  test('CustomerReferral.fromJson tam ve eksik alanlar', () {
    final full = CustomerReferral.fromJson({
      'referralCode': 'AB23CD',
      'inviteLink': 'https://x/teklif-al?ref=AB23CD',
      'referredCount': 2,
      'referred': [
        {'id': 'c1', 'fullName': 'Ayşe', 'createdAt': '2026-09-18T00:00:00.000Z'},
        {'id': 'c2'},
      ],
    });
    expect(full.referralCode, 'AB23CD');
    expect(full.referredCount, 2);
    expect(full.referred.length, 2);
    expect(full.referred.last.fullName, '—');

    final empty = CustomerReferral.fromJson({});
    expect(empty.referralCode, '');
    expect(empty.referredCount, 0);
    expect(empty.referred, isEmpty);
  });
}
