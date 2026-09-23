import '../../core/api_client.dart';
import '../../models/advance.dart';
import '../../models/contract.dart';
import '../../models/job.dart';
import '../../models/leave_request.dart';
import '../../models/quote.dart';

/// web/src/app/(dashboard)/bekleyen-onaylar/page.tsx ile aynı desen: 3
/// bağımsız uçtan çekilir, biri hata verirse diğerleri yine gösterilir.
class ApprovalsApi {
  final _api = ApiClient.instance;

  Future<List<QuoteRequest>> newQuotes() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/quotes',
      query: {'status': 'NEW', 'limit': 50},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(QuoteRequest.fromJson)
        .toList();
  }

  Future<List<AdvanceRequest>> pendingAdvances() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/advances',
      query: {'status': 'PENDING', 'limit': 50},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(AdvanceRequest.fromJson)
        .toList();
  }

  /// Bir personelin tüm avans talepleri (avans kartı → geçmiş/güvenilirlik
  /// özeti). backend: GET /advances?staffId= (yalnızca OWNER/MANAGER).
  Future<List<AdvanceRequest>> advancesForStaff(String staffId) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/advances',
      query: {'staffId': staffId, 'limit': 100},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(AdvanceRequest.fromJson)
        .toList();
  }

  Future<List<Contract>> expiringContracts() async {
    final json = await _api.get<Map<String, dynamic>>('/contracts/expiring');
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(Contract.fromJson)
        .toList();
  }

  /// Onay bekleyen saha raporu olan işler (GET /jobs?pendingReportApproval=true).
  Future<List<Job>> pendingReportJobs() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/jobs',
      query: {'pendingReportApproval': 'true', 'limit': 50},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(Job.fromJson)
        .toList();
  }

  /// Saha raporunu onaylar. Backend mükerrer onayı iyimser kilitle 409'a
  /// çevirir (bkz. jobsController.ts:approveJobReport).
  Future<void> approveJobReport(String jobId) =>
      _api.post('/jobs/$jobId/report/approve');

  Future<void> updateAdvanceStatus(String id, String status) =>
      _api.patch('/advances/$id', body: {'status': status});

  Future<void> updateQuoteStatus(String id, String status) =>
      _api.patch('/quotes/$id', body: {'status': status});

  Future<void> convertQuote(String id) => _api.post('/quotes/$id/convert');

  /// 4. onay kaynağı — izin talepleri (bkz. backend/src/routes/leaveRequests.ts).
  Future<List<LeaveRequest>> pendingLeaveRequests() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/leave-requests',
      query: {'status': 'PENDING', 'limit': 50},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(LeaveRequest.fromJson)
        .where((l) => l.status == 'PENDING')
        .toList();
  }

  Future<void> decideLeaveRequest(String id, String status) =>
      _api.patch('/leave-requests/$id/decide', body: {'status': status});
}
