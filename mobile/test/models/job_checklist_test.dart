// Bölüm N (4. tur): Job.checklist ayrıştırma.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/job.dart';

Map<String, dynamic> _baseJob() => {
      'id': 'j1',
      'customerId': 'c1',
      'assignedStaffId': null,
      'serviceType': 'Genel',
      'status': 'SCHEDULED',
      'createdAt': '2026-09-18T00:00:00.000Z',
    };

void main() {
  test('checklist yoksa boş liste (liste uçları)', () {
    expect(Job.fromJson(_baseJob()).checklist, isEmpty);
  });

  test('checklist satırları ayrıştırılır', () {
    final job = Job.fromJson({
      ..._baseJob(),
      'checklist': [
        {'item': 'Ekipman kontrol edildi', 'isChecked': true, 'checkedAt': '2026-09-18T08:00:00.000Z'},
        {'item': 'Güvenlik önlemleri alındı', 'isChecked': false, 'checkedAt': null},
      ],
    });
    expect(job.checklist.length, 2);
    expect(job.checklist.first.isChecked, isTrue);
    expect(job.checklist.first.checkedAt, isNotNull);
    expect(job.checklist.last.isChecked, isFalse);
    expect(job.checklist.where((e) => e.isChecked).length, 1);
  });

  group('Job.directionsUri (Bölüm O)', () {
    test('adres yoksa null', () {
      expect(Job.fromJson(_baseJob()).directionsUri, isNull);
    });
    test('adres + semt Google Maps arama linkine kodlanır', () {
      final job = Job.fromJson({
        ..._baseJob(),
        'customer': {'fullName': 'Ali', 'address': 'Çınar Sk. No:5', 'district': 'Nilüfer'},
      });
      final uri = job.directionsUri!;
      expect(uri.host, 'www.google.com');
      expect(uri.path, '/maps/search/');
      expect(uri.queryParameters['api'], '1');
      expect(uri.queryParameters['query'], 'Çınar Sk. No:5, Nilüfer');
    });
  });
}
