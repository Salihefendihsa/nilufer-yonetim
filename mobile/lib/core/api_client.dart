import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'app_config.dart';
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

  /// Fotoğraf/imza gibi dosya yüklemeleri için multipart istek.
  Future<T> uploadMultipart<T>(
    String path, {
    required String fieldName,
    required File file,
    Map<String, String>? fields,
  }) async {
    final request = http.MultipartRequest('POST', _uri(path));
    request.headers.addAll(await _headers(json: false));
    if (fields != null) request.fields.addAll(fields);
    request.files.add(await http.MultipartFile.fromPath(fieldName, file.path));

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
      throw ApiException(res.statusCode, 'Dosya indirilemedi');
    }
    return res.bodyBytes;
  }

  /// Yüklenen dosyaların (fotoğraf/imza/PDF) tam URL'sini üretir — backend
  /// göreli yol döner (`/uploads/...`), API kökeniyle birleştirilmesi gerekir.
  String resolveUploadUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '${AppConfig.apiUrl}$url';
  }
}
