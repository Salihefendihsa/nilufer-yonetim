import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../widgets/badges.dart';
import '../../widgets/charts.dart';

/// Bölüm V (5. tur): GET /evaluations/staff/:staffId/history noktası.
class EvaluationHistoryPoint {
  final String periodLabel;
  final double? averageScore;
  final String? achievementTier;

  const EvaluationHistoryPoint({
    required this.periodLabel,
    this.averageScore,
    this.achievementTier,
  });

  factory EvaluationHistoryPoint.fromJson(Map<String, dynamic> json) =>
      EvaluationHistoryPoint(
        periodLabel: json['periodLabel'] as String? ?? '',
        averageScore: (json['averageScore'] as num?)?.toDouble(),
        achievementTier: json['achievementTier'] as String?,
      );
}

class EvaluationHistory {
  final List<EvaluationHistoryPoint> data;
  final double? overallAverage;
  final double? lastDelta;

  const EvaluationHistory({
    required this.data,
    this.overallAverage,
    this.lastDelta,
  });

  factory EvaluationHistory.fromJson(Map<String, dynamic> json) =>
      EvaluationHistory(
        data: ((json['data'] as List?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(EvaluationHistoryPoint.fromJson)
            .toList(),
        overallAverage: (json['overallAverage'] as num?)?.toDouble(),
        lastDelta: (json['lastDelta'] as num?)?.toDouble(),
      );
}

/// Personel detayı → "Performans Trendi": dönemden döneme averageScore
/// çizgi grafiği (fl_chart, 1–20 ölçeği). Veri yoksa / yetki yoksa gizli.
class EvaluationTrendCard extends StatefulWidget {
  final String staffId;
  const EvaluationTrendCard({super.key, required this.staffId});

  @override
  State<EvaluationTrendCard> createState() => _EvaluationTrendCardState();
}

class _EvaluationTrendCardState extends State<EvaluationTrendCard> {
  EvaluationHistory? _history;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await ApiClient.instance.get<Map<String, dynamic>>(
        '/evaluations/staff/${widget.staffId}/history',
      );
      if (mounted) setState(() => _history = EvaluationHistory.fromJson(json));
    } on ApiException {
      if (mounted) setState(() => _history = null); // 403/404 → kart gizli
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _history == null || _history!.data.isEmpty) {
      return const SizedBox.shrink();
    }
    final h = _history!;
    final last = h.data.last;
    final delta = h.lastDelta;
    final deltaColor = delta == null || delta == 0
        ? AppColors.textFaint
        : delta > 0
            ? AppColors.primary700
            : AppColors.danger500;

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.show_chart_rounded, size: 18, color: AppColors.primary600),
              const SizedBox(width: 6),
              const Expanded(
                child: Text(
                  'Performans Trendi',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                ),
              ),
              AchievementBadge(tier: last.achievementTier),
              if (delta != null) ...[
                const SizedBox(width: 6),
                Icon(
                  delta > 0
                      ? Icons.trending_up_rounded
                      : delta < 0
                          ? Icons.trending_down_rounded
                          : Icons.trending_flat_rounded,
                  size: 16,
                  color: deltaColor,
                ),
                Text(
                  '${delta > 0 ? '+' : ''}${delta.toStringAsFixed(1)}',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: deltaColor),
                ),
              ],
            ],
          ),
          Text(
            '${h.data.length} dönem · genel ortalama '
            '${h.overallAverage?.toStringAsFixed(1) ?? '—'}/20',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 8),
          RevenueTrendChart(
            points: [
              for (final p in h.data) ChartPoint(p.periodLabel, p.averageScore ?? 0),
            ],
            fixedMaxY: 20,
            valueFormatter: (v) => '${v.toStringAsFixed(1)} / 20',
          ),
        ],
      ),
    );
  }
}
