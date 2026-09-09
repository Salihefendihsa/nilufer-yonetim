import 'dart:convert';
import 'dart:io';

import '../../core/api_client.dart';
import '../../models/job.dart';
import '../../models/paginated.dart';

class JobsApi {
  final _api = ApiClient.instance;

  Future<Paginated<Job>> list({
    int page = 1,
    int limit = 20,
    String? status,
    String? staffId,
    String? customerId,
    String? date,
    DateTime? from,
    DateTime? to,
    String? search,
  }) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/jobs',
      query: {
        'page': page,
        'limit': limit,
        if (status != null) 'status': status,
        if (staffId != null) 'staffId': staffId,
        if (customerId != null) 'customerId': customerId,
        if (date != null) 'date': date,
        if (search != null && search.isNotEmpty) 'search': search,
        if (from != null) 'from': from.toIso8601String(),
        if (to != null) 'to': to.toIso8601String(),
      },
    );
    return Paginated.fromJson(json, Job.fromJson);
  }

  Future<Job> getById(String id) async {
    final json = await _api.get<Map<String, dynamic>>('/jobs/$id');
    return Job.fromJson(json);
  }

  Future<Job> create({
    required String customerId,
    String? assignedStaffId,
    required String serviceType,
    DateTime? scheduledAt,
    DateTime? scheduledEndAt,
    String? notes,
    double? price,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/jobs',
      body: {
        'customerId': customerId,
        if (assignedStaffId != null) 'assignedStaffId': assignedStaffId,
        'serviceType': serviceType,
        if (scheduledAt != null) 'scheduledAt': scheduledAt.toIso8601String(),
        if (scheduledEndAt != null)
          'scheduledEndAt': scheduledEndAt.toIso8601String(),
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (price != null) 'price': price,
      },
    );
    return Job.fromJson(json);
  }

  /// STAFF/OWNER/MANAGER durum geçişi — backend geçerli geçiş tablosunu
  /// (VALID_TRANSITIONS) uygular, geçersiz istekte 400 döner.
  /// [cancellationReason] yalnizca CANCELLED gecisinde anlamlidir; backend
  /// bunu Job.cancellationReason alanina yazar.
  Future<Job> updateStatus(
    String id,
    JobStatus status, {
    String? cancellationReason,
  }) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/jobs/$id',
      body: {
        'status': jobStatusToApiString(status),
        if (cancellationReason != null && cancellationReason.isNotEmpty)
          'cancellationReason': cancellationReason,
      },
    );
    return Job.fromJson(json);
  }

  /// Yalnızca TEAM_LEAD — backend/src/controllers/jobsController.ts:
  /// teamLeadUpdateSchema, yeni personel de aynı ekipte olmalı (backend kontrol eder).
  Future<Job> reassignStaff(String id, String assignedStaffId) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/jobs/$id',
      body: {'assignedStaffId': assignedStaffId},
    );
    return Job.fromJson(json);
  }

  /// [products]: Stitch Personel → İşler "Kullanılan Ürünler (Stoktan
  /// Düşüm)" — her biri kendi miktarıyla, aynı ürün iki kez olamaz (backend
  /// doğrular). Her satır ayrı bir StockMovement(OUT) üretir.
  Future<Map<String, dynamic>> createReport(
    String jobId, {
    List<({String productId, double quantity})> products = const [],
    String? productsUsed,
    required String dosage,
    String? notes,
    String? signatureBase64,
  }) {
    return _api.post<Map<String, dynamic>>(
      '/jobs/$jobId/report',
      body: {
        if (products.isNotEmpty)
          'products': products
              .map((p) => {'productId': p.productId, 'quantity': p.quantity})
              .toList(),
        if (productsUsed != null && productsUsed.isNotEmpty)
          'productsUsed': productsUsed,
        'dosage': dosage,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (signatureBase64 != null) 'signatureBase64': signatureBase64,
      },
    );
  }

  Future<Map<String, dynamic>?> getReport(String jobId) async {
    try {
      return await _api.get<Map<String, dynamic>>('/jobs/$jobId/report');
    } on ApiException catch (e) {
      if (e.status == 404) return null;
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> listPhotos(String jobId) async {
    final json = await _api.get<Map<String, dynamic>>('/jobs/$jobId/photos');
    return (json['data'] as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> uploadPhoto(
    String jobId,
    File file,
    String type,
  ) {
    return _api.uploadMultipart<Map<String, dynamic>>(
      '/jobs/$jobId/photos',
      fieldName: 'photo',
      file: file,
      fields: {'type': type},
    );
  }

  Future<void> deletePhoto(String jobId, String photoId) =>
      _api.delete('/jobs/$jobId/photos/$photoId');

  Future<Job> rate(String jobId, int rating, {String? comment}) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/jobs/$jobId/rate',
      body: {
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'ratingComment': comment,
      },
    );
    return Job.fromJson(json);
  }

  String resolveUploadUrl(String url) => _api.resolveUploadUrl(url);
}

/// Base64 encode helper — imza pad'inden gelen PNG byte'larını backend'in
/// beklediği data-URL formatına çevirir (bkz. backend/src/lib/upload.ts:saveBase64Image).
String toSignatureDataUrl(List<int> pngBytes) =>
    'data:image/png;base64,${base64Encode(pngBytes)}';
