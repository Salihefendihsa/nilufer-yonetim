// Bölüm AB (6. tur): CustomerDocument ayrıştırma, boyut etiketi, tür ayrımı.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/customers/customer_documents_tab.dart';

void main() {
  test('PDF belgesi: boyut KB, resim değil, yükleyen adı', () {
    final d = CustomerDocument.fromJson({
      'id': 'd1', 'fileName': 'sozlesme.pdf', 'fileUrl': '/uploads/x.pdf', 'fileType': 'application/pdf',
      'fileSize': 20480, 'uploadedAt': '2026-09-18T10:00:00.000Z', 'uploadedBy': {'id': 'u', 'fullName': 'Patron'},
    });
    expect(d.isImage, isFalse);
    expect(d.sizeLabel, '20 KB');
    expect(d.uploadedByName, 'Patron');
  });

  test('resim: isImage true; MB etiketi; eksik alanlar', () {
    final d = CustomerDocument.fromJson({'id': 'd2', 'fileType': 'image/png', 'fileSize': 3 * 1024 * 1024});
    expect(d.isImage, isTrue);
    expect(d.sizeLabel, '3.0 MB');
    expect(d.fileName, 'belge');
    expect(CustomerDocument.fromJson({'id': 'd3', 'fileSize': 500}).sizeLabel, '500 B');
  });
}
