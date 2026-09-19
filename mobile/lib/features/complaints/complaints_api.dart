import '../../core/api_client.dart';
import '../../models/complaint.dart';

/// backend/src/routes/complaints.ts (Bölüm AO, 9. tur).
class ComplaintsApi {
  final _api = ApiClient.instance;

  /// CUSTOMER → yalnızca kendi şikayetleri (sunucu filtreler); yönetim → tümü.
  Future<List<CustomerComplaint>> list({String? status, String? priority}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/complaints',
      query: {
        'limit': 100,
        if (status != null) 'status': status,
        if (priority != null) 'priority': priority,
      },
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(CustomerComplaint.fromJson)
        .toList();
  }

  Future<CustomerComplaint> create({
    required String subject,
    required String description,
    String? jobId,
    String priority = 'MEDIUM',
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/complaints',
      body: {
        'subject': subject,
        'description': description,
        'priority': priority,
        if (jobId != null && jobId.isNotEmpty) 'jobId': jobId,
      },
    );
    return CustomerComplaint.fromJson(json);
  }

  /// OWNER/MANAGER: durum / öncelik / atama / çözüm notu.
  /// `assignedToUserId` boş string → atama kaldırılır (null gönderilir).
  Future<CustomerComplaint> update(
    String id, {
    String? status,
    String? priority,
    String? assignedToUserId,
    bool clearAssignee = false,
    String? resolutionNote,
  }) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/complaints/$id',
      body: {
        if (status != null) 'status': status,
        if (priority != null) 'priority': priority,
        if (clearAssignee)
          'assignedToUserId': null
        else if (assignedToUserId != null && assignedToUserId.isNotEmpty)
          'assignedToUserId': assignedToUserId,
        if (resolutionNote != null)
          'resolutionNote': resolutionNote.isEmpty ? null : resolutionNote,
      },
    );
    return CustomerComplaint.fromJson(json);
  }
}
