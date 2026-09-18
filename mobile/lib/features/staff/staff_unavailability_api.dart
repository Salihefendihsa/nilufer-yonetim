import '../../core/api_client.dart';
import '../../models/staff_unavailability.dart';

/// backend/src/controllers/staffUnavailabilityController.ts (Bölüm K, 3. tur).
class StaffUnavailabilityApi {
  final _api = ApiClient.instance;

  /// Kendi işaretlerim — [month] "yyyy-MM" (verilmezse bugünden itibaren).
  Future<List<StaffUnavailability>> listMine({String? month}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/staff/me/unavailability',
      query: {'month': ?month},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(StaffUnavailability.fromJson)
        .toList();
  }

  /// [date] "yyyy-MM-dd"; [startTime]/[endTime] "HH:mm" — ikisi de null ise tüm gün.
  Future<StaffUnavailability> create({
    required String date,
    String? startTime,
    String? endTime,
    String? reason,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/staff/me/unavailability',
      body: {
        'date': date,
        'startTime': ?startTime,
        'endTime': ?endTime,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
    );
    return StaffUnavailability.fromJson(json);
  }

  Future<void> delete(String id) =>
      _api.delete<void>('/staff/me/unavailability/$id');

  /// Belirli bir günde müsait olmayan personel (OWNER/MANAGER/TEAM_LEAD) —
  /// iş formundaki uyarı için. Yanıt satırlarına [date] eklenir.
  Future<List<StaffUnavailability>> unavailableOn(String date) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/staff/unavailability',
      query: {'date': date},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map((e) => StaffUnavailability.fromJson({...e, 'date': date}))
        .toList();
  }
}
