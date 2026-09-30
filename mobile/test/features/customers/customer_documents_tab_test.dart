import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nilufer_mobile/features/customers/customer_documents_tab.dart';

class FakeDocumentsApi extends CustomerDocumentsApi {
  final docs = <CustomerDocument>[];
  int listCalls = 0;
  int uploadCalls = 0;
  List<int>? uploadedBytes;
  String? uploadedName;
  bool failUpload = false;

  @override
  Future<List<CustomerDocument>> list(String customerId) async {
    listCalls++;
    return List.of(docs);
  }

  @override
  Future<CustomerDocument> upload(
    String customerId,
    List<int> bytes,
    String fileName,
  ) async {
    uploadCalls++;
    if (failUpload) throw StateError('Gizli yükleme ayrıntısı');
    uploadedBytes = bytes;
    uploadedName = fileName;
    final doc = CustomerDocument(
      id: 'document-1',
      fileName: fileName,
      fileUrl: '',
      fileType: 'application/pdf',
      fileSize: bytes.length,
      uploadedAt: '',
    );
    docs.add(doc);
    return doc;
  }
}

void main() {
  const uploadButton = 'Belge Yükle (PDF, resim, ofis)';

  Future<void> pumpTab(
    WidgetTester tester,
    FakeDocumentsApi api,
    Future<CustomerDocumentSelection?> Function() picker,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CustomerDocumentsTab(
            customerId: 'customer-1',
            api: api,
            pickDocument: picker,
          ),
        ),
      ),
    );
    await tester.pump();
  }

  CustomerDocumentSelection selection(Future<Uint8List> Function() reader) =>
      CustomerDocumentSelection(name: 'belge.pdf', readAsBytes: reader);

  testWidgets('seçim iptali sessizce biter ve yeniden denenebilir', (
    tester,
  ) async {
    final api = FakeDocumentsApi();
    var pickCalls = 0;
    await pumpTab(tester, api, () async {
      pickCalls++;
      return null;
    });

    await tester.tap(find.text(uploadButton));
    await tester.pump();
    await tester.tap(find.text(uploadButton));
    await tester.pump();

    expect(pickCalls, 2);
    expect(api.uploadCalls, 0);
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('seçici hatası güvenli mesaj verir ve yeniden denenebilir', (
    tester,
  ) async {
    final api = FakeDocumentsApi();
    var pickCalls = 0;
    await pumpTab(tester, api, () async {
      pickCalls++;
      throw StateError('Gizli seçici ayrıntısı');
    });

    await tester.tap(find.text(uploadButton));
    await tester.pump();
    expect(
      find.text('Belge seçilemedi. Lütfen tekrar deneyin.'),
      findsOneWidget,
    );
    expect(find.textContaining('Gizli'), findsNothing);
    await tester.tap(find.text(uploadButton));
    await tester.pump();
    expect(pickCalls, 2);
    expect(api.uploadCalls, 0);
  });

  testWidgets('okuma hatası güvenli mesaj verir, yükleme başlatmaz', (
    tester,
  ) async {
    final api = FakeDocumentsApi();
    await pumpTab(
      tester,
      api,
      () async =>
          selection(() async => throw StateError('Gizli dosya içeriği')),
    );

    await tester.tap(find.text(uploadButton));
    await tester.pump();
    expect(
      find.text('Belge okunamadı. Lütfen tekrar deneyin.'),
      findsOneWidget,
    );
    expect(find.textContaining('Gizli'), findsNothing);
    expect(api.uploadCalls, 0);
    expect(find.text(uploadButton), findsOneWidget);
  });

  testWidgets('okuma sırasında ekran kapanırsa yükleme başlamaz', (
    tester,
  ) async {
    final api = FakeDocumentsApi();
    final read = Completer<Uint8List>();
    await pumpTab(tester, api, () async => selection(() => read.future));

    await tester.tap(find.text(uploadButton));
    await tester.pump();
    expect(find.text('Yükleniyor...'), findsOneWidget);
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    read.complete(Uint8List.fromList([1, 2, 3]));
    await tester.pump();

    expect(api.uploadCalls, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('yükleme hatası güvenli mesaj verir ve yeniden denenebilir', (
    tester,
  ) async {
    final api = FakeDocumentsApi()..failUpload = true;
    await pumpTab(
      tester,
      api,
      () async => selection(() async => Uint8List.fromList([1])),
    );

    await tester.tap(find.text(uploadButton));
    await tester.pump();
    expect(
      find.text('Belge yüklenemedi. Lütfen tekrar deneyin.'),
      findsOneWidget,
    );
    expect(find.textContaining('Gizli'), findsNothing);
    expect(find.text(uploadButton), findsOneWidget);
    await tester.tap(find.text(uploadButton));
    await tester.pump();
    expect(api.uploadCalls, 2);
  });

  testWidgets('başarılı yükleme belge listesini yeniler', (tester) async {
    final api = FakeDocumentsApi();
    await pumpTab(
      tester,
      api,
      () async => selection(() async => Uint8List.fromList([1, 2, 3])),
    );

    await tester.tap(find.text(uploadButton));
    await tester.pump();

    expect(api.uploadCalls, 1);
    expect(api.uploadedBytes, [1, 2, 3]);
    expect(api.uploadedName, 'belge.pdf');
    expect(api.listCalls, 2);
    expect(find.text('belge.pdf'), findsOneWidget);
    expect(find.text('Belge yüklendi'), findsOneWidget);
  });

  testWidgets('devam eden seçimde ikinci dokunma yeni işlem başlatmaz', (
    tester,
  ) async {
    final api = FakeDocumentsApi();
    final pick = Completer<CustomerDocumentSelection?>();
    var pickCalls = 0;
    await pumpTab(tester, api, () {
      pickCalls++;
      return pick.future;
    });

    await tester.tap(find.text(uploadButton));
    await tester.pump();
    expect(find.text('Yükleniyor...'), findsOneWidget);
    expect(
      tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
      isNull,
    );
    pick.complete(null);
    await tester.pump();
    expect(pickCalls, 1);
    expect(find.text(uploadButton), findsOneWidget);
  });
}
