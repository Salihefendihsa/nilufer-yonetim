/// backend/prisma/schema.prisma: EvaluationCriterion/EvaluationPeriod/
/// Evaluation/EvaluationScore — Formal Değerlendirme sistemi. Mevcut basit
/// Performans (tamamlanan iş + müşteri puanı) ekranından ayrı, bağımsız.
class EvaluationCriterion {
  final String id;
  final String name;
  final String? description;
  final bool isActive;

  EvaluationCriterion({
    required this.id,
    required this.name,
    this.description,
    required this.isActive,
  });

  factory EvaluationCriterion.fromJson(Map<String, dynamic> json) =>
      EvaluationCriterion(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        isActive: json['isActive'] as bool? ?? true,
      );
}

class EvaluationPeriod {
  final String id;
  final String label;
  final String startDate;
  final String endDate;
  final bool isLocked;

  EvaluationPeriod({
    required this.id,
    required this.label,
    required this.startDate,
    required this.endDate,
    required this.isLocked,
  });

  factory EvaluationPeriod.fromJson(Map<String, dynamic> json) =>
      EvaluationPeriod(
        id: json['id'] as String,
        label: json['label'] as String,
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String,
        isLocked: json['isLocked'] as bool? ?? false,
      );
}

class EvaluationScoreItem {
  final String criterionId;
  final int score;
  final EvaluationCriterion criterion;

  EvaluationScoreItem({
    required this.criterionId,
    required this.score,
    required this.criterion,
  });

  factory EvaluationScoreItem.fromJson(Map<String, dynamic> json) =>
      EvaluationScoreItem(
        criterionId: json['criterionId'] as String,
        score: (json['score'] as num).toInt(),
        criterion: EvaluationCriterion.fromJson(
          json['criterion'] as Map<String, dynamic>,
        ),
      );
}

/// [evaluatorUserId]/[evaluatorName] STAFF/TEAM_LEAD kendi kaydına baktığında
/// backend tarafından HİÇ döndürülmez (redactEvaluatorForRole) — bu yüzden
/// nullable ve UI bu alanları asla zorunlu göstermez.
class Evaluation {
  final String id;
  final String? evaluatorUserId;
  final String? evaluatorName;
  final String targetStaffId;
  final String periodId;
  final String status;
  final String? comment;
  final int? managerScore;
  final double? averageScore;
  final List<EvaluationScoreItem> scores;
  final String createdAt;

  Evaluation({
    required this.id,
    this.evaluatorUserId,
    this.evaluatorName,
    required this.targetStaffId,
    required this.periodId,
    required this.status,
    this.comment,
    this.managerScore,
    this.averageScore,
    required this.scores,
    required this.createdAt,
  });

  factory Evaluation.fromJson(Map<String, dynamic> json) {
    final evaluator = json['evaluator'] as Map<String, dynamic>?;
    return Evaluation(
      id: json['id'] as String,
      evaluatorUserId: json['evaluatorUserId'] as String?,
      evaluatorName: evaluator?['fullName'] as String?,
      targetStaffId: json['targetStaffId'] as String,
      periodId: json['periodId'] as String,
      status: json['status'] as String,
      comment: json['comment'] as String?,
      managerScore: (json['managerScore'] as num?)?.toInt(),
      averageScore: (json['averageScore'] as num?)?.toDouble(),
      scores: (json['scores'] as List? ?? [])
          .cast<Map<String, dynamic>>()
          .map(EvaluationScoreItem.fromJson)
          .toList(),
      createdAt: json['createdAt'] as String,
    );
  }
}
