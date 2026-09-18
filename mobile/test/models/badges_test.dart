// Bölüm Q (4. tur): rozet etiketleri ve Contract.isPaused ayrıştırma.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/contract.dart';
import 'package:nilufer_mobile/widgets/badges.dart';

void main() {
  test('achievementTierLabelTr kademeleri', () {
    expect(achievementTierLabelTr('GOLD'), 'Altın');
    expect(achievementTierLabelTr('SILVER'), 'Gümüş');
    expect(achievementTierLabelTr('BRONZE'), 'Bronz');
    expect(achievementTierLabelTr(null), isNull);
    expect(achievementTierLabelTr('PLATINUM'), isNull);
  });

  test('Contract.isPaused varsayılan false, JSON true okunur', () {
    final base = {
      'id': 'c1', 'customerId': 'cu', 'startDate': '2026-01-01', 'endDate': '2026-12-31',
      'durationMonths': 12, 'status': 'ACTIVE',
    };
    expect(Contract.fromJson(base).isPaused, isFalse);
    expect(Contract.fromJson({...base, 'isPaused': true}).isPaused, isTrue);
  });
}
