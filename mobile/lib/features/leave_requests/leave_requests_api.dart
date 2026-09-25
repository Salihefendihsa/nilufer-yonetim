import '../../core/api_dates.dart';
import '../../core/api_client.dart';
import '../../models/leave_request.dart';

/// backend/src/routes/leaveRequests.ts.
class LeaveRequestsApi {
  final _api = ApiClient.instance;

  /// [mine] true iken TEAM_LEAD de yalnızca kendi taleplerini alır (ekibini
  /// değil) — "İzin Taleplerim" ekranındaki geçmiş listesi için.
  Future<List<LeaveRequest>> list({bool mine = false, String? status}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/leave-requests',
      query: {
        'limit': 100,
        if (mine) 'mine': 'true',
        if (status != null) 'status': status,
      },
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(LeaveRequest.fromJson)
        .toList();
  }

  Future<LeaveRequest> create({
    required DateTime startDate,
    required DateTime endDate,
    required String reason,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/leave-requests',
      body: {
        'startDate': apiDate(startDate),
        'endDate': apiDate(endDate),
        'reason': reason,
      },
    );
    return LeaveRequest.fromJson(json);
  }

  Future<void> decide(String id, String status, {String? decisionNote}) =>
      _api.patch(
        '/leave-requests/$id/decide',
        body: {
          'status': status,
          if (decisionNote != null && decisionNote.isNotEmpty) 'decisionNote': decisionNote,
        },
      );
}
