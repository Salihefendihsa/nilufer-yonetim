// Bölüm AD (7. tur): DataDeletionRequest ayrıştırma ve durum etiketi.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/admin/data_deletion_screens.dart';

void main() {
  test('fromJson — müşteri/işleyen adları, bekleyen', () {
    final r = DataDeletionRequest.fromJson({
      'id': 'r1', 'status': 'PENDING', 'requestedAt': '2026-09-18T10:00:00.000Z',
      'customer': {'fullName': 'Ayşe', 'phone': '0555'}, 'processedBy': null,
    });
    expect(r.isPending, isTrue);
    expect(r.customerName, 'Ayşe');
    expect(deletionStatusLabelTr(r.status), 'Bekliyor');
  });

  test('reddedilmiş talep gerekçe taşır; etiketler', () {
    final r = DataDeletionRequest.fromJson({'id': 'r2', 'status': 'REJECTED', 'rejectionReason': 'Açık borç', 'processedBy': {'fullName': 'Patron'}});
    expect(r.isPending, isFalse);
    expect(r.rejectionReason, 'Açık borç');
    expect(r.processedByName, 'Patron');
    expect(deletionStatusLabelTr('COMPLETED'), 'Tamamlandı');
  });
}
