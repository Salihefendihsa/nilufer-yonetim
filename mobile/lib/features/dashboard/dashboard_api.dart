import '../../core/api_client.dart';
import 'dashboard_models.dart';

class DashboardApi {
  final _api = ApiClient.instance;

  /// Yalnızca OWNER/MANAGER — backend/src/routes/dashboard.ts:8
  Future<DashboardSummary> getSummary() async {
    final json = await _api.get<Map<String, dynamic>>('/dashboard/summary');
    return DashboardSummary.fromJson(json);
  }

  /// Yalnızca OWNER/MANAGER — backend/src/routes/dashboard.ts:9
  Future<List<ActivityEvent>> getActivityFeed() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/dashboard/activity-feed',
    );
    final list = (json['data'] as List).cast<Map<String, dynamic>>();
    return list.map(ActivityEvent.fromJson).toList();
  }

  /// web/bekleyen-onaylar ile aynı desen: 3 uçtan bağımsız çekip topla,
  /// biri hata verse bile diğerleri gösterilsin diye Future.wait yerine
  /// ayrı try/catch kullanılır.
  Future<PendingApprovalsCount> getPendingApprovalsCount() async {
    int quotes = 0, advances = 0, contracts = 0;
    try {
      final res = await _api.get<Map<String, dynamic>>(
        '/quotes',
        query: {'status': 'NEW', 'limit': 1},
      );
      quotes = (res['pagination'] as Map)['total'] as int? ?? 0;
    } catch (_) {}
    try {
      final res = await _api.get<Map<String, dynamic>>(
        '/advances',
        query: {'status': 'PENDING', 'limit': 1},
      );
      advances = (res['pagination'] as Map)['total'] as int? ?? 0;
    } catch (_) {}
    try {
      final res = await _api.get<Map<String, dynamic>>('/contracts/expiring');
      contracts = (res['data'] as List).length;
    } catch (_) {}
    return PendingApprovalsCount(
      quotes: quotes,
      advances: advances,
      expiringContracts: contracts,
    );
  }

  /// TEAM_LEAD/STAFF/CUSTOMER için: backend rol bazlı kapsamla (canAccessJob)
  /// zaten filtrelenmiş bugünkü iş sayısı — /dashboard/summary'ye erişimleri
  /// olmadığı için (yalnızca OWNER/MANAGER) bunun yerine kullanılır.
  Future<int> getTodaysJobsCountForCurrentUser() async {
    final today = DateTime.now();
    final dateStr =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    final res = await _api.get<Map<String, dynamic>>(
      '/jobs',
      query: {'date': dateStr, 'limit': 1},
    );
    return (res['pagination'] as Map)['total'] as int? ?? 0;
  }
}
