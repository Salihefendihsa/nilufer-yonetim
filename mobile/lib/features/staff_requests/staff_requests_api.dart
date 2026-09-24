import '../../core/api_client.dart';
import '../../models/staff_request.dart';

/// backend/src/routes/staffRequests.ts.
class StaffRequestsApi {
  final _api = ApiClient.instance;

  /// Personel → yalnızca kendi talepleri (sunucu filtreler); OWNER → tümü.
  Future<List<StaffRequest>> list({String? status, String? category}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/staff-requests',
      query: {'limit': 100, 'status': ?status, 'category': ?category},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(StaffRequest.fromJson)
        .toList();
  }

  Future<StaffRequest> create({
    required String subject,
    required String description,
    String category = 'OTHER',
    String priority = 'MEDIUM',
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/staff-requests',
      body: {
        'subject': subject,
        'description': description,
        'category': category,
        'priority': priority,
      },
    );
    return StaffRequest.fromJson(json);
  }

  /// Yalnızca OWNER: durum / öncelik / yanıt notu. Boş not → null gönderilir.
  Future<StaffRequest> respond(
    String id, {
    String? status,
    String? priority,
    String? responseNote,
  }) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/staff-requests/$id',
      body: {
        'status': ?status,
        'priority': ?priority,
        if (responseNote != null)
          'responseNote': responseNote.isEmpty ? null : responseNote,
      },
    );
    return StaffRequest.fromJson(json);
  }
}
