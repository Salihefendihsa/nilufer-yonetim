import '../../core/api_client.dart';
import '../../models/paginated.dart';
import '../../models/staff.dart';

class StaffApi {
  final _api = ApiClient.instance;

  Future<Paginated<Staff>> list({int page = 1, String? search}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/staff',
      query: {
        'page': page,
        'limit': 100,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
    return Paginated.fromJson(json, Staff.fromJson);
  }

  Future<Staff> getById(String id) async {
    final json = await _api.get<Map<String, dynamic>>('/staff/$id');
    return Staff.fromJson(json);
  }

  /// backend/src/controllers/staffController.ts:updateStaffStatus —
  /// STAFF yalnızca kendi durumunu ve yalnızca AVAILABLE/ON_BREAK/OFFLINE'a
  /// ayarlayabilir (ON_LEAVE onay gerektirdiği için hariç, bkz. model dosyası).
  Future<Staff> updateStatus(
    String id,
    StaffStatus status, {
    DateTime? statusUntil,
  }) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/staff/$id/status',
      body: {
        'status': staffStatusToApiString(status),
        if (statusUntil != null) 'statusUntil': statusUntil.toIso8601String(),
      },
    );
    return Staff.fromJson(json);
  }

  Future<List<StaffCertification>> listCertifications(String staffId) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/staff/$staffId/certifications',
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(StaffCertification.fromJson)
        .toList();
  }
}
