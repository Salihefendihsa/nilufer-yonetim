import 'api_client.dart';
import 'file_download_io.dart'
    if (dart.library.js_interop) 'file_download_web.dart'
    as platform;

/// Web'in tarayıcı indirmesinin (`lib/api.ts:downloadFile`) mobil karşılığı.
///
/// Platforma göre iki yol (koşullu import):
/// - Android/iOS/masaüstü (`file_download_io.dart`): dosya geçici dizine
///   yazılıp cihazın paylaşım sayfası (Share Sheet) açılır — kullanıcı oradan
///   "Kaydet"/WhatsApp/e-posta vb. seçebilir.
/// - Flutter web (`file_download_web.dart`): `path_provider`'ın web
///   implementasyonu yoktur (`getTemporaryDirectory` →
///   MissingPluginException) ve `dart:io File` web'de çalışmaz; bu yüzden
///   byte'lar bir Blob'a konup `<a download>` ile tarayıcı indirmesi
///   tetiklenir.
///
/// Byte'lar her iki yolda da `ApiClient.getBytes` ile (Authorization
/// header'lı) çekilir — token'sız URL yok.
Future<void> downloadAndShare(
  String path,
  String fileName, {
  Map<String, dynamic>? query,
}) async {
  final bytes = await ApiClient.instance.getBytes(path, query: query);
  await platform.saveBytes(bytes, fileName);
}
