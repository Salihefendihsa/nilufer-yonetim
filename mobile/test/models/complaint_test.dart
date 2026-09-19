// Bölüm AO (9. tur): CustomerComplaint ayrıştırma ve durum yardımcıları.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/complaint.dart';

void main() {
  final base = {
    'id': 'c1',
    'customerId': 'cu1',
    'jobId': 'j1',
    'subject': 'Koku',
    'description': 'İlaçlama sonrası koku çok ağır.',
    'status': 'OPEN',
    'priority': 'HIGH',
    'assignedToUserId': null,
    'resolutionNote': null,
    'createdAt': '2026-09-19T10:00:00.000Z',
    'resolvedAt': null,
    'customer': {'id': 'cu1', 'fullName': 'Ayşe', 'phone': '05'},
    'job': {'id': 'j1', 'sequenceNo': 42, 'serviceType': 'Haşere', 'scheduledAt': null, 'status': 'COMPLETED'},
    'assignedTo': null,
  };

  test('ilişkiler ve alanlar okunur; OPEN açık sayılır', () {
    final c = CustomerComplaint.fromJson(base);
    expect(c.customerName, 'Ayşe');
    expect(c.jobSequenceNo, 42);
    expect(c.jobServiceType, 'Haşere');
    expect(c.priority, 'HIGH');
    expect(c.isOpen, isTrue);
    expect(c.isResolved, isFalse);
    expect(c.assignedToName, isNull);
  });

  test('RESOLVED: çözüm notu, resolvedAt ve atanan okunur', () {
    final c = CustomerComplaint.fromJson({
      ...base,
      'status': 'RESOLVED',
      'resolutionNote': 'Tekrar uygulama yapıldı',
      'resolvedAt': '2026-09-20T10:00:00.000Z',
      'assignedToUserId': 'u9',
      'assignedTo': {'id': 'u9', 'fullName': 'Müdür', 'role': 'MANAGER'},
    });
    expect(c.isResolved, isTrue);
    expect(c.isOpen, isFalse);
    expect(c.assignedToName, 'Müdür');
    expect(c.resolutionNote, 'Tekrar uygulama yapıldı');
  });

  test('öncelik yoksa MEDIUM; etiket tabloları tam', () {
    final c = CustomerComplaint.fromJson({...base}..remove('priority'));
    expect(c.priority, 'MEDIUM');
    expect(complaintStatusLabels.keys, containsAll(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']));
    expect(complaintPriorityLabels['HIGH'], 'Yüksek');
  });
}
