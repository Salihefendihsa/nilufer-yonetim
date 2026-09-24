// Personel talebi (StaffRequest) ayrıştırma ve durum yardımcıları.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/staff_request.dart';
import 'package:nilufer_mobile/models/user.dart';

void main() {
  final base = {
    'id': 'r1',
    'staffUserId': 'u1',
    'subject': 'Yeni pülverizatör',
    'description': 'Pompa sızdırıyor, değişmesi gerekiyor.',
    'category': 'EQUIPMENT',
    'status': 'OPEN',
    'priority': 'HIGH',
    'respondedByUserId': null,
    'responseNote': null,
    'createdAt': '2026-09-24T08:00:00.000Z',
    'resolvedAt': null,
    'staffUser': {'id': 'u1', 'fullName': 'Mehmet', 'role': 'TEAM_LEAD'},
    'respondedBy': null,
  };

  test('alanlar ve talep sahibi okunur; OPEN açık sayılır', () {
    final r = StaffRequest.fromJson(base);
    expect(r.category, 'EQUIPMENT');
    expect(r.priority, 'HIGH');
    expect(r.staffName, 'Mehmet');
    expect(r.staffRole, AppRole.teamLead);
    expect(r.isOpen, isTrue);
    expect(r.isClosed, isFalse);
    expect(r.respondedByName, isNull);
  });

  test('REJECTED: kapalı sayılır, yanıt notu ve yanıtlayan okunur', () {
    final r = StaffRequest.fromJson({
      ...base,
      'status': 'REJECTED',
      'responseNote': 'Bütçe yok',
      'resolvedAt': '2026-09-25T08:00:00.000Z',
      'respondedBy': {'id': 'o1', 'fullName': 'Patron', 'role': 'OWNER'},
    });
    expect(r.isClosed, isTrue);
    expect(r.isOpen, isFalse);
    expect(r.responseNote, 'Bütçe yok');
    expect(r.respondedByName, 'Patron');
  });

  test('eksik kategori/öncelik varsayılana düşer; etiketler tam', () {
    final r = StaffRequest.fromJson(
      {...base}
        ..remove('category')
        ..remove('priority'),
    );
    expect(r.category, 'OTHER');
    expect(r.priority, 'MEDIUM');
    expect(staffRequestStatusLabels.keys, [
      'OPEN',
      'IN_PROGRESS',
      'RESOLVED',
      'REJECTED',
    ]);
    expect(staffRequestCategoryLabels.keys, [
      'EQUIPMENT',
      'SUGGESTION',
      'COMPLAINT',
      'OTHER',
    ]);
  });
}
