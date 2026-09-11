import '../../core/api_client.dart';
import '../../models/paginated.dart';
import '../../models/staff.dart';

class StaffApi {
  final _api = ApiClient.instance;

  Future<Paginated<Staff>> list({
    int page = 1,
    String? search,
    String? role,
    bool includeArchived = false,
  }) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/staff',
      query: {
        'page': page,
        'limit': 100,
        if (search != null && search.isNotEmpty) 'search': search,
        if (role != null) 'role': role,
        // Yalnızca OWNER için anlamlı — "Geçmiş Personel" sekmesi
        // (bkz. backend/src/controllers/staffController.ts:listStaff).
        if (includeArchived) 'includeArchived': 'true',
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

  /// backend/src/routes/staff.ts: POST / — yalnızca OWNER/MANAGER.
  Future<Staff> create({
    required String userId,
    required String position,
    required double salaryBase,
    String? supervisorId,
    String? vehiclePlate,
    int? dailyJobCapacity,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/staff',
      body: {
        'userId': userId,
        'position': position,
        'salaryBase': salaryBase,
        if (supervisorId != null) 'supervisorId': supervisorId,
        if (vehiclePlate != null) 'vehiclePlate': vehiclePlate,
        if (dailyJobCapacity != null) 'dailyJobCapacity': dailyJobCapacity,
      },
    );
    return Staff.fromJson(json);
  }

  /// backend/src/routes/staff.ts: PATCH /:id — yalnızca OWNER/MANAGER.
  Future<Staff> update(
    String id, {
    required String position,
    required double salaryBase,
    String? supervisorId,
    String? vehiclePlate,
    int? dailyJobCapacity,
  }) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/staff/$id',
      body: {
        'position': position,
        'salaryBase': salaryBase,
        'supervisorId': supervisorId,
        'vehiclePlate': vehiclePlate,
        'dailyJobCapacity': dailyJobCapacity,
      },
    );
    return Staff.fromJson(json);
  }

  /// backend/src/routes/staff.ts: DELETE /:id — yalnızca OWNER/MANAGER.
  Future<void> delete(String id) => _api.delete('/staff/$id');

  /// backend/src/routes/users.ts: GET /?role= — bir Staff kaydına henüz
  /// bağlanmamış (STAFF/TEAM_LEAD rolündeki) kullanıcılar; yeni personel
  /// formunda kullanıcı seçmek için.
  Future<List<UnlinkedUser>> listUnlinkedUsers(String role) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/users',
      query: {'role': role},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(UnlinkedUser.fromJson)
        .toList();
  }

  /// backend/src/routes/staff.ts: POST /:id/certifications — yalnızca
  /// OWNER/MANAGER.
  Future<StaffCertification> createCertification(
    String staffId, {
    required String name,
    required DateTime issuedDate,
    required DateTime expiryDate,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/staff/$staffId/certifications',
      body: {
        'name': name,
        'issuedDate': issuedDate.toIso8601String(),
        'expiryDate': expiryDate.toIso8601String(),
      },
    );
    return StaffCertification.fromJson(json);
  }

  /// backend/src/routes/staff.ts: DELETE /:id/certifications/:certId —
  /// yalnızca OWNER/MANAGER.
  Future<void> deleteCertification(String staffId, String certId) =>
      _api.delete('/staff/$staffId/certifications/$certId');
}

/// backend/src/controllers/usersController.ts:listUsers — henüz bir Staff
/// kaydına bağlanmamış kullanıcı; sadece formdaki seçici için gereken alanlar.
class UnlinkedUser {
  final String id;
  final String fullName;
  final String email;

  UnlinkedUser({required this.id, required this.fullName, required this.email});

  factory UnlinkedUser.fromJson(Map<String, dynamic> json) => UnlinkedUser(
    id: json['id'] as String,
    fullName: json['fullName'] as String,
    email: json['email'] as String,
  );
}
