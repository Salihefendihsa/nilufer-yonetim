import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'app_config.dart';
import 'mime_types.dart';
import 'secure_storage.dart';

/// backend/src/middleware/errorHandler.ts'in ürettiği `{ error, details? }`
/// gövdesini birebir yansıtır — web/src/lib/api.ts:ApiError ile aynı sözleşme.
class ApiException implements Exception {
  final int status;
  final String message;
  final dynamic details;

  ApiException(this.status, this.message, [this.details]);

  @override
  String toString() => message;
}

/// Login/register uçları — 401'i "oturum sona erdi" olarak değil "e-posta/şifre
/// hatalı" olarak ele almak için (web/src/lib/api.ts ile aynı ayrım).
const _preSessionPaths = ['/auth/login', '/auth/register'];

bool _isPreSessionCall(String path) => _preSessionPaths.any(path.startsWith);

/// Backend her isteği Bearer token ile bekliyor (cookie yok) — bkz.
/// PROJECT_HANDOFF_TR.md §7: mobil için cookie bağımlılığı olmadığı doğrulanmış.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  /// AuthProvider tarafından set edilir; bir 401 alındığında oturumu temizler.
  Future<void> Function()? onUnauthorized;

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final base = Uri.parse(AppConfig.apiUrl);
    return base.replace(
      path: base.path + path,
      queryParameters: query?.map((k, v) => MapEntry(k, v.toString())),
    );
  }

  Future<Map<String, String>> _headers({bool json = true, String? path}) async {
    final token = await SecureStorage.readToken();
    return {
      if (json) 'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      // Yalnızca /auth/login isteğinde — backend/src/controllers/authController.ts:
      // isVerifiedMobileClient bu ikisini birlikte doğrular, reCAPTCHA'yı (mobilde
      // WebView olmadan üretilemez) yalnızca ikisi de doğruysa atlar.
      if (path == '/auth/login') ...{
        'X-Client-Type': 'mobile',
        'X-Mobile-App-Key': AppConfig.mobileAppSecret,
      },
    };
  }

  Future<T> _handle<T>(http.Response res, String path) async {
    if (res.statusCode == 401 && !_isPreSessionCall(path)) {
      await onUnauthorized?.call();
      throw ApiException(401, 'Oturum sona erdi');
    }

    if (res.statusCode == 204) {
      return null as T;
    }

    dynamic data;
    try {
      data = res.body.isNotEmpty
          ? jsonDecode(utf8.decode(res.bodyBytes))
          : null;
    } catch (_) {
      data = null;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final message = (data is Map && data['error'] is String)
          ? data['error'] as String
          : 'Bir hata oluştu';
      throw ApiException(
        res.statusCode,
        message,
        data is Map ? data['details'] : null,
      );
    }

    return data as T;
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) async {
    final res = await http.get(_uri(path, query), headers: await _headers());
    return _handle<T>(res, path);
  }

  Future<T> post<T>(String path, {Object? body}) async {
    final res = await http.post(
      _uri(path),
      headers: await _headers(path: path),
      body: body != null ? jsonEncode(body) : null,
    );
    return _handle<T>(res, path);
  }

  Future<T> patch<T>(String path, {Object? body}) async {
    final res = await http.patch(
      _uri(path),
      headers: await _headers(),
      body: body != null ? jsonEncode(body) : null,
    );
    return _handle<T>(res, path);
  }

  Future<T> delete<T>(String path) async {
    final res = await http.delete(_uri(path), headers: await _headers());
    return _handle<T>(res, path);
  }

  /// Fotoğraf/belge gibi dosya yüklemeleri için multipart istek.
  ///
  /// Byte tabanlıdır (`dart:io File` değil) — Flutter web'de dosya yolu
  /// yoktur, `XFile.readAsBytes()`/`PlatformFile.bytes` her platformda çalışır.
  /// contentType dosya uzantısından belirlenir: backend'in multer filtresi
  /// (`lib/upload.ts`) `image/*` / izinli belge MIME'ı ister; `http`
  /// paketinin varsayılanı `application/octet-stream` olduğundan önceden her
  /// yükleme "Yalnızca resim dosyaları yüklenebilir" (400) ile reddediliyordu.
  Future<T> uploadMultipart<T>(
    String path, {
    required String fieldName,
    required List<int> bytes,
    required String filename,
    Map<String, String>? fields,
  }) async {
    final request = http.MultipartRequest('POST', _uri(path));
    request.headers.addAll(await _headers(json: false));
    if (fields != null) request.fields.addAll(fields);
    request.files.add(
      http.MultipartFile.fromBytes(
        fieldName,
        bytes,
        filename: filename,
        contentType: MediaType.parse(mimeTypeForFileName(filename)),
      ),
    );

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    return _handle<T>(res, path);
  }

  /// Excel/PDF export uçları gibi ikili (binary) yanıt dönen GET istekleri
  /// için — `get<T>` gibi JSON decode etmez, ham byte döndürür. Web'in
  /// `lib/api.ts:downloadFile` karşılığı.
  Future<List<int>> getBytes(String path, {Map<String, dynamic>? query}) async {
    final res = await http.get(_uri(path, query), headers: await _headers());
    if (res.statusCode == 401) {
      await onUnauthorized?.call();
      throw ApiException(401, 'Oturum sona erdi');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      // Hata yanıtları ikili değil `{ error }` JSON'udur (errorHandler.ts) —
      // backend'in Türkçe mesajını ("İş raporu bulunamadı" gibi) göster,
      // genel "Dosya indirilemedi" yalnızca gövde okunamazsa.
      String message = 'Dosya indirilemedi';
      try {
        final data = jsonDecode(utf8.decode(res.bodyBytes));
        if (data is Map && data['error'] is String) {
          message = data['error'] as String;
        }
      } catch (_) {}
      throw ApiException(res.statusCode, message);
    }
    return res.bodyBytes;
  }

  /// Bölüm AC (7. tur) — GÜVENLİK: `/uploads` statik servisi kaldırıldı;
  /// dosyalar yalnızca kimlik doğrulamalı `GET /files/:type/:id` ile alınır.
  /// Bu yardımcı göreli API yolunu üretir; görseller `AuthImage`
  /// (Authorization header'lı Image.network), indirmeler `getBytes`
  /// (token'lı) ile çekilir. type: job-photo | job-signature |
  /// customer-document | message-attachment.
  String fileUrl(String type, String id) => '/files/$type/${Uri.encodeComponent(id)}';

  /// Göreli API yolunu tam URL'ye çevirir (Image.network için).
  String absoluteUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '${AppConfig.apiUrl}$path';
  }
}
