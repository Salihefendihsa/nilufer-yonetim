import '../../core/api_client.dart';
import '../../models/executive_summary.dart';

/// Bölüm G (2. tur): GET /analytics/executive-summary — yalnızca
/// OWNER/MANAGER (backend/src/routes/analytics.ts).
class ExecutiveApi {
  final _api = ApiClient.instance;

  Future<ExecutiveSummary> getSummary(String range) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/analytics/executive-summary',
      query: {'range': range},
    );
    return ExecutiveSummary.fromJson(json);
  }
}
