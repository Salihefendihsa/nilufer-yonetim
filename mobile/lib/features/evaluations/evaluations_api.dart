import '../../core/api_dates.dart';
import '../../core/api_client.dart';
import '../../models/evaluation.dart';

/// backend/src/routes/evaluations.ts + evaluation-criteria + evaluation-periods.
class EvaluationsApi {
  final _api = ApiClient.instance;

  Future<List<EvaluationCriterion>> listCriteria() async {
    final json = await _api.get<Map<String, dynamic>>('/evaluation-criteria');
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(EvaluationCriterion.fromJson)
        .toList();
  }

  Future<List<EvaluationPeriod>> listPeriods() async {
    final json = await _api.get<Map<String, dynamic>>('/evaluation-periods');
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(EvaluationPeriod.fromJson)
        .toList();
  }

  Future<EvaluationPeriod> createPeriod({
    required String label,
    required DateTime startDate,
    required DateTime endDate,
    int? bonusThreshold,
    double? bonusAmount,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/evaluation-periods',
      body: {
        'label': label,
        'startDate': apiDate(startDate),
        'endDate': apiDate(endDate),
        if (bonusThreshold != null) 'bonusThreshold': bonusThreshold,
        if (bonusAmount != null) 'bonusAmount': bonusAmount,
      },
    );
    return EvaluationPeriod.fromJson(json);
  }

  // --- Bölüm C (2. tur): onay bekleyen prim önerileri ---

  Future<List<StaffBonus>> listPendingStaffBonuses() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/staff-bonuses',
      query: {'status': 'PENDING'},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(StaffBonus.fromJson)
        .toList();
  }

  Future<void> approveStaffBonus(String id) =>
      _api.post('/staff-bonuses/$id/approve');

  Future<void> rejectStaffBonus(String id) =>
      _api.post('/staff-bonuses/$id/reject');

  /// [isLocked]=true olunca o döneme ait TÜM değerlendirmeler backend
  /// tarafında otomatik LOCKED'a çekilir.
  Future<void> lockPeriod(String periodId) => _api.patch(
    '/evaluation-periods/$periodId',
    body: {'isLocked': true},
  );

  Future<List<Evaluation>> listEvaluations({
    String? periodId,
    String? targetStaffId,
  }) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/evaluations',
      query: {
        if (periodId != null) 'periodId': periodId,
        if (targetStaffId != null) 'targetStaffId': targetStaffId,
      },
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(Evaluation.fromJson)
        .toList();
  }

  Future<Evaluation> createEvaluation({
    required String targetStaffId,
    required String periodId,
    required Map<String, int> scoresByCriterionId,
    String? comment,
    int? managerScore,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/evaluations',
      body: {
        'targetStaffId': targetStaffId,
        'periodId': periodId,
        'scores': scoresByCriterionId.entries
            .map((e) => {'criterionId': e.key, 'score': e.value})
            .toList(),
        if (comment != null && comment.isNotEmpty) 'comment': comment,
        if (managerScore != null) 'managerScore': managerScore,
      },
    );
    return Evaluation.fromJson(json);
  }

  Future<Evaluation> updateEvaluation(
    String id, {
    required Map<String, int> scoresByCriterionId,
    String? comment,
    int? managerScore,
  }) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/evaluations/$id',
      body: {
        'scores': scoresByCriterionId.entries
            .map((e) => {'criterionId': e.key, 'score': e.value})
            .toList(),
        'comment': comment,
        'managerScore': managerScore,
      },
    );
    return Evaluation.fromJson(json);
  }

  Future<Evaluation> submitEvaluation(String id) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/evaluations/$id/submit',
    );
    return Evaluation.fromJson(json);
  }
}
