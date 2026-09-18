import '../../core/api_client.dart';
import '../../models/appointment_request.dart';

/// backend/src/routes/appointmentRequests.ts (Bölüm J, 3. tur).
class AppointmentRequestsApi {
  final _api = ApiClient.instance;

  /// CUSTOMER kendi taleplerini, OWNER/MANAGER tümünü alır (sunucu kapsamı).
  Future<List<AppointmentRequest>> list({String? status}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/appointment-requests',
      query: {'limit': 100, 'status': ?status},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(AppointmentRequest.fromJson)
        .toList();
  }

  /// Talep formundaki aktif hizmet türleri (id + name).
  Future<List<({String id, String name})>> serviceTypes() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/appointment-requests/service-types',
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map((e) => (id: e['id'] as String, name: e['name'] as String))
        .toList();
  }

  Future<AppointmentRequest> create({
    required String serviceTypeId,
    required DateTime preferredDateStart,
    required DateTime preferredDateEnd,
    String? note,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/appointment-requests',
      body: {
        'serviceTypeId': serviceTypeId,
        'preferredDateStart': preferredDateStart.toIso8601String(),
        'preferredDateEnd': preferredDateEnd.toIso8601String(),
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    return AppointmentRequest.fromJson(json);
  }

  Future<void> schedule(String id, String jobId) =>
      _api.post('/appointment-requests/$id/schedule', body: {'jobId': jobId});

  Future<void> decline(String id, String reason) =>
      _api.post('/appointment-requests/$id/decline', body: {'reason': reason});
}
