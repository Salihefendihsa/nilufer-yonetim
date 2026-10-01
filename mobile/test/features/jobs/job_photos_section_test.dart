import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nilufer_mobile/features/jobs/job_detail_screen.dart';
import 'package:nilufer_mobile/features/jobs/jobs_api.dart';

class FakeJobsApi extends JobsApi {
  int uploadCalls = 0;
  String? uploadedJobId;
  String? uploadedName;
  String? uploadedType;
  List<int>? uploadedBytes;
  Future<Map<String, dynamic>> Function()? uploadResult;

  @override
  Future<Map<String, dynamic>> uploadPhoto(
    String jobId,
    List<int> bytes,
    String fileName,
    String type,
  ) {
    uploadCalls++;
    uploadedJobId = jobId;
    uploadedBytes = bytes;
    uploadedName = fileName;
    uploadedType = type;
    return uploadResult?.call() ?? Future.value({'id': 'photo-1'});
  }
}

void main() {
  JobPhotoSelection selection(Future<Uint8List> Function() reader) =>
      JobPhotoSelection(name: 'foto.jpg', readAsBytes: reader);

  Future<void> pumpSection(
    WidgetTester tester,
    FakeJobsApi api,
    Future<JobPhotoSelection?> Function() picker, {
    Future<void> Function()? onChanged,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: JobPhotosSection(
            jobId: 'job-1',
            photos: const [],
            api: api,
            onChanged: onChanged ?? () async {},
            canUpload: true,
            pickPhoto: picker,
          ),
        ),
      ),
    );
  }

  testWidgets('seçim iptali sessiz biter ve yeniden denenebilir', (
    tester,
  ) async {
    final api = FakeJobsApi();
    var picks = 0;
    await pumpSection(tester, api, () async {
      picks++;
      return null;
    });

    await tester.tap(find.text('Öncesi'));
    await tester.pump();
    await tester.tap(find.text('Öncesi'));
    await tester.pump();

    expect(picks, 2);
    expect(api.uploadCalls, 0);
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('seçici hatası güvenli mesaj verir ve yeniden denenebilir', (
    tester,
  ) async {
    final api = FakeJobsApi();
    var picks = 0;
    await pumpSection(tester, api, () async {
      picks++;
      throw StateError('Gizli seçici yolu');
    });

    await tester.tap(find.text('Öncesi'));
    await tester.pump();
    expect(
      find.text('Fotoğraf seçilemedi. Lütfen tekrar deneyin.'),
      findsOneWidget,
    );
    expect(find.textContaining('Gizli'), findsNothing);
    await tester.tap(find.text('Öncesi'));
    await tester.pump();
    expect(picks, 2);
    expect(api.uploadCalls, 0);
  });

  testWidgets('okuma hatası güvenli mesaj verir, yükleme başlamaz', (
    tester,
  ) async {
    final api = FakeJobsApi();
    await pumpSection(
      tester,
      api,
      () async =>
          selection(() async => throw StateError('Gizli dosya içeriği')),
    );

    await tester.tap(find.text('Öncesi'));
    await tester.pump();
    expect(
      find.text('Fotoğraf okunamadı. Lütfen tekrar deneyin.'),
      findsOneWidget,
    );
    expect(find.textContaining('Gizli'), findsNothing);
    expect(api.uploadCalls, 0);
    expect(
      tester
          .widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Öncesi'))
          .onPressed,
      isNotNull,
    );
  });

  testWidgets('seçim sırasında ekran kapanırsa okuma ve yükleme başlamaz', (
    tester,
  ) async {
    final api = FakeJobsApi();
    final pick = Completer<JobPhotoSelection?>();
    var reads = 0;
    await pumpSection(tester, api, () => pick.future);

    await tester.tap(find.text('Öncesi'));
    await tester.pump();
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    pick.complete(
      selection(() async {
        reads++;
        return Uint8List.fromList([1]);
      }),
    );
    await tester.pump();

    expect(reads, 0);
    expect(api.uploadCalls, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('okuma sırasında ekran kapanırsa yükleme başlamaz', (
    tester,
  ) async {
    final api = FakeJobsApi();
    final read = Completer<Uint8List>();
    await pumpSection(tester, api, () async => selection(() => read.future));

    await tester.tap(find.text('Öncesi'));
    await tester.pump();
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    read.complete(Uint8List.fromList([1]));
    await tester.pump();

    expect(api.uploadCalls, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('devam eden seçimde ikinci dokunma yeni işlem başlatmaz', (
    tester,
  ) async {
    final api = FakeJobsApi();
    final pick = Completer<JobPhotoSelection?>();
    var picks = 0;
    await pumpSection(tester, api, () {
      picks++;
      return pick.future;
    });

    final button = tester.widget<OutlinedButton>(
      find.widgetWithText(OutlinedButton, 'Öncesi'),
    );
    button.onPressed!();
    button.onPressed!();
    await tester.pump();
    expect(picks, 1);
    expect(
      tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Sonrası'),
          )
          .onPressed,
      isNull,
    );
    pick.complete(null);
    await tester.pump();
    expect(api.uploadCalls, 0);
    expect(
      tester
          .widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Öncesi'))
          .onPressed,
      isNotNull,
    );
  });

  testWidgets('yükleme hatası güvenli mesaj verir ve yeniden denenebilir', (
    tester,
  ) async {
    final api = FakeJobsApi()
      ..uploadResult = () async => throw StateError('Gizli sunucu yolu');
    var refreshes = 0;
    await pumpSection(
      tester,
      api,
      () async => selection(() async => Uint8List.fromList([1])),
      onChanged: () async => refreshes++,
    );

    await tester.tap(find.text('Öncesi'));
    await tester.pump();
    expect(
      find.text('Fotoğraf yüklenemedi. Lütfen tekrar deneyin.'),
      findsOneWidget,
    );
    expect(find.textContaining('Gizli'), findsNothing);
    await tester.tap(find.text('Öncesi'));
    await tester.pump();
    expect(api.uploadCalls, 2);
    expect(refreshes, 0);
  });

  testWidgets('başarılı yükleme doğru iş ve türle listeyi yeniler', (
    tester,
  ) async {
    final api = FakeJobsApi();
    var refreshes = 0;
    await pumpSection(
      tester,
      api,
      () async => selection(() async => Uint8List.fromList([1, 2, 3])),
      onChanged: () async => refreshes++,
    );

    await tester.tap(find.text('Sonrası'));
    await tester.pump();
    expect(api.uploadCalls, 1);
    expect(api.uploadedJobId, 'job-1');
    expect(api.uploadedBytes, [1, 2, 3]);
    expect(api.uploadedName, 'foto.jpg');
    expect(api.uploadedType, 'AFTER');
    expect(refreshes, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('yükleme sırasında ekran kapanırsa yenileme başlamaz', (
    tester,
  ) async {
    final api = FakeJobsApi();
    final upload = Completer<Map<String, dynamic>>();
    api.uploadResult = () => upload.future;
    var refreshes = 0;
    await pumpSection(
      tester,
      api,
      () async => selection(() async => Uint8List.fromList([1])),
      onChanged: () async => refreshes++,
    );

    await tester.tap(find.text('Öncesi'));
    await tester.pump();
    expect(api.uploadCalls, 1);
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    upload.complete({'id': 'photo-1'});
    await tester.pump();

    expect(refreshes, 0);
    expect(tester.takeException(), isNull);
  });
}
