import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'api_client.dart';

/// Web'in tarayıcı indirmesinin (`lib/api.ts:downloadFile`) mobil karşılığı:
/// dosyayı backend'den indirip cihazın paylaşım sayfasına (Share Sheet)
/// açar — kullanıcı oradan "Kaydet"/WhatsApp/e-posta vb. seçebilir. Mobilde
/// tarayıcı olmadığı için doğrudan "indirilenler klasörüne kaydet" yerine bu
/// desen tercih edildi (iOS'ta da tek tutarlı yol budur).
Future<void> downloadAndShare(
  String path,
  String fileName, {
  Map<String, dynamic>? query,
}) async {
  final bytes = await ApiClient.instance.getBytes(path, query: query);
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/$fileName');
  await file.writeAsBytes(bytes, flush: true);
  await Share.shareXFiles([XFile(file.path)], fileNameOverrides: [fileName]);
}
