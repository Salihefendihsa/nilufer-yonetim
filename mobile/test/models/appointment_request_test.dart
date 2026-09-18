// Bölüm J (3. tur): AppointmentRequest model ayrıştırma testleri.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/appointment_request.dart';

void main() {
  group('AppointmentRequest.fromJson', () {
    test('gömülü müşteri/hizmet/iş alanlarını düzleştirir', () {
      final r = AppointmentRequest.fromJson({
        'id': 'r1',
        'customerId': 'c1',
        'serviceTypeId': 's1',
        'preferredDateStart': '2026-10-03T00:00:00.000Z',
        'preferredDateEnd': '2026-10-05T23:59:59.000Z',
        'note': 'Öğleden sonra',
        'status': 'SCHEDULED',
        'respondedAt': '2026-09-20T10:00:00.000Z',
        'declineReason': null,
        'resultingJobId': 'j1',
        'createdAt': '2026-09-18T09:00:00.000Z',
        'customer': {'id': 'c1', 'fullName': 'Ayşe', 'phone': '0555'},
        'serviceType': {'id': 's1', 'name': 'Genel İlaçlama'},
        'resultingJob': {'id': 'j1', 'sequenceNo': 12, 'scheduledAt': '2026-10-03T09:00:00.000Z', 'status': 'SCHEDULED'},
      });
      expect(r.customerName, 'Ayşe');
      expect(r.serviceTypeName, 'Genel İlaçlama');
      expect(r.resultingJobScheduledAt, '2026-10-03T09:00:00.000Z');
      expect(r.isPending, isFalse);
      expect(appointmentRequestStatusLabelTr(r.status), 'Planlandı');
    });

    test('ilişkiler yokken ve status eksikken çökmez (PENDING varsayılır)', () {
      final r = AppointmentRequest.fromJson({
        'id': 'r2',
        'customerId': 'c1',
        'serviceTypeId': 's1',
        'preferredDateStart': '2026-10-03T00:00:00.000Z',
        'preferredDateEnd': '2026-10-05T23:59:59.000Z',
      });
      expect(r.status, 'PENDING');
      expect(r.isPending, isTrue);
      expect(r.customerName, isNull);
      expect(r.createdAt, '');
      expect(appointmentRequestStatusLabelTr('DECLINED'), 'Reddedildi');
    });
  });
}
