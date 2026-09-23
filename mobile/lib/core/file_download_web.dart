import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

import 'mime_types.dart';

/// Flutter web kaydetme yolu — bkz. `file_download.dart`. Byte'lar bir
/// Blob'a konur ve geçici bir `<a download>` ile tarayıcının kendi indirme
/// akışı tetiklenir; object URL hemen ardından serbest bırakılır.
Future<void> saveBytes(List<int> bytes, String fileName) async {
  final data = bytes is Uint8List ? bytes : Uint8List.fromList(bytes);
  final blob = web.Blob(
    [data.toJS].toJS,
    web.BlobPropertyBag(type: mimeTypeForFileName(fileName)),
  );
  final url = web.URL.createObjectURL(blob);
  final anchor = web.HTMLAnchorElement()
    ..href = url
    ..download = fileName
    ..style.display = 'none';
  web.document.body?.append(anchor);
  anchor.click();
  anchor.remove();
  // Tarayıcı indirmeyi başlattıktan sonra URL'yi serbest bırak (aynı tick'te
  // revoke etmek bazı tarayıcılarda indirmeyi iptal eder).
  Future<void>.delayed(
    const Duration(seconds: 30),
    () => web.URL.revokeObjectURL(url),
  );
}
