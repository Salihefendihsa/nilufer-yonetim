// Bölüm M (4. tur): TeamDailyBriefing / TeamBriefingMember ayrıştırma ve rozet metni.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/team/team_api.dart';

void main() {
  group('TeamBriefingMember.badgeLabel', () {
    TeamBriefingMember make({
      bool onLeave = false,
      bool unavailable = false,
      bool allDay = false,
      List<String> ranges = const [],
    }) =>
        TeamBriefingMember(
          staffId: 's',
          fullName: 'Ali',
          position: 'Teknisyen',
          status: 'AVAILABLE',
          todaysJobsCount: 1,
          isSelf: false,
          onLeave: onLeave,
          unavailable: unavailable,
          unavailableAllDay: allDay,
          unavailableRanges: ranges,
        );

    test('izinli → "İzinli" (müsaitlik işaretinden öncelikli)', () {
      expect(make(onLeave: true, unavailable: true, allDay: true).badgeLabel, 'İzinli');
    });
    test('tüm gün müsait değil', () {
      expect(make(unavailable: true, allDay: true).badgeLabel, 'Bugün müsait değil');
    });
    test('saat aralığı', () {
      expect(make(unavailable: true, ranges: ['13:00–17:00']).badgeLabel, 'Müsait değil 13:00–17:00');
    });
    test('işaret yok → null', () {
      expect(make().badgeLabel, isNull);
    });
  });

  test('TeamDailyBriefing.fromJson eksik alanlarla çökmez', () {
    final b = TeamDailyBriefing.fromJson({
      'date': '2026-09-18',
      'members': [
        {'staffId': 'a', 'isSelf': true, 'unavailableRanges': ['09:00–10:00']},
      ],
    });
    expect(b.teamSize, 0);
    expect(b.members.single.isSelf, isTrue);
    expect(b.members.single.fullName, '—');
    expect(b.members.single.unavailableRanges, ['09:00–10:00']);
  });
}
