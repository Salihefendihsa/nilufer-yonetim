import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';

class LeaderboardEntry {
  final String staffId;
  final String fullName;
  final String position;
  final int completedJobsThisMonth;
  final double? averageRating;

  // --- Mudur fazi alanlari ---
  final int completedJobsLastMonth;
  final int completedJobsInPeriod;
  final int completedJobsPreviousPeriod;
  final int ratedJobsCount;

  /// Zamanında tamamlama oranı. Kural: `scheduledEndAt` varsa ona göre, yoksa
  /// `scheduledAt` ile aynı gün. Planı olmayan iş ölçüme dahil edilmez;
  /// ölçülebilir iş yoksa null (oran uydurulmaz).
  final double? onTimeRate;
  final int onTimeMeasuredJobs;

  /// Aylik is hedefi tanimli degilse null - uydurma bir hedef gosterilmez.
  final double? targetCompletionPercent;

  LeaderboardEntry({
    required this.staffId,
    required this.fullName,
    required this.position,
    required this.completedJobsThisMonth,
    required this.averageRating,
    this.completedJobsLastMonth = 0,
    this.completedJobsInPeriod = 0,
    this.completedJobsPreviousPeriod = 0,
    this.ratedJobsCount = 0,
    this.onTimeRate,
    this.onTimeMeasuredJobs = 0,
    this.targetCompletionPercent,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      LeaderboardEntry(
        staffId: json['staffId'] as String,
        fullName: json['fullName'] as String,
        position: json['position'] as String,
        completedJobsThisMonth: json['completedJobsThisMonth'] as int,
        averageRating: (json['averageRating'] as num?)?.toDouble(),
        completedJobsLastMonth:
            (json['completedJobsLastMonth'] as num?)?.toInt() ?? 0,
        completedJobsInPeriod:
            (json['completedJobsInPeriod'] as num?)?.toInt() ?? 0,
        completedJobsPreviousPeriod:
            (json['completedJobsPreviousPeriod'] as num?)?.toInt() ?? 0,
        ratedJobsCount: (json['ratedJobsCount'] as num?)?.toInt() ?? 0,
        onTimeRate: (json['onTimeRate'] as num?)?.toDouble(),
        onTimeMeasuredJobs: (json['onTimeMeasuredJobs'] as num?)?.toInt() ?? 0,
        targetCompletionPercent:
            (json['targetCompletionPercent'] as num?)?.toDouble(),
      );
}

/// GET /staff/leaderboard yanitinin `summary` blogu.
class LeaderboardSummary {
  final int totalCompletedThisMonth;
  final int totalCompletedLastMonth;
  final int totalCompletedInPeriod;
  final int totalCompletedPreviousPeriod;
  final double? onTimeRate;
  final int staffCount;
  final double? averageRating;
  final int ratedJobsCount;
  final double jobsPerStaff;

  LeaderboardSummary({
    required this.totalCompletedThisMonth,
    required this.totalCompletedLastMonth,
    required this.totalCompletedInPeriod,
    required this.totalCompletedPreviousPeriod,
    required this.onTimeRate,
    required this.staffCount,
    required this.averageRating,
    required this.ratedJobsCount,
    required this.jobsPerStaff,
  });

  factory LeaderboardSummary.fromJson(Map<String, dynamic> json) =>
      LeaderboardSummary(
        totalCompletedThisMonth:
            (json['totalCompletedThisMonth'] as num?)?.toInt() ?? 0,
        totalCompletedLastMonth:
            (json['totalCompletedLastMonth'] as num?)?.toInt() ?? 0,
        totalCompletedInPeriod:
            (json['totalCompletedInPeriod'] as num?)?.toInt() ?? 0,
        totalCompletedPreviousPeriod:
            (json['totalCompletedPreviousPeriod'] as num?)?.toInt() ?? 0,
        onTimeRate: (json['onTimeRate'] as num?)?.toDouble(),
        staffCount: (json['staffCount'] as num?)?.toInt() ?? 0,
        averageRating: (json['averageRating'] as num?)?.toDouble(),
        ratedJobsCount: (json['ratedJobsCount'] as num?)?.toInt() ?? 0,
        jobsPerStaff: (json['jobsPerStaff'] as num?)?.toDouble() ?? 0,
      );
}

/// backend/src/controllers/staffController.ts:getStaffLeaderboard —
/// OWNER/MANAGER tüm personeli görür, TEAM_LEAD yalnızca kendi ekibini
/// (backend kapsamı, burada tekrarlanmaz).
class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  List<LeaderboardEntry> _entries = [];
  LeaderboardSummary? _summary;

  /// Isletme sahibinin /settings'te tanimladigi kisi basi aylik is hedefi;
  /// tanimli degilse null gelir ve hedef gostergeleri gizlenir.
  num? _monthlyTarget;

  /// Stitch Şef → Ekip Performansı: Bu Ay / Geçen Ay / Bu Yıl.
  String _period = 'this_month';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await ApiClient.instance.get<Map<String, dynamic>>(
        '/staff/leaderboard',
        query: {'period': _period},
      );
      final list = (json['data'] as List)
          .cast<Map<String, dynamic>>()
          .map(LeaderboardEntry.fromJson)
          .toList();
      setState(() {
        _entries = list;
        _summary = json['summary'] != null
            ? LeaderboardSummary.fromJson(
                json['summary'] as Map<String, dynamic>,
              )
            : null;
        _monthlyTarget = json['monthlyTarget'] as num?;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException
            ? e.message
            : 'Performans verisi yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              children: [
                for (final option in const [
                  ('this_month', 'Bu Ay'),
                  ('last_month', 'Geçen Ay'),
                  ('this_year', 'Bu Yıl'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(
                        option.$2,
                        style: const TextStyle(fontSize: 12),
                      ),
                      selected: _period == option.$1,
                      onSelected: (_) {
                        setState(() => _period = option.$1);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
        ),
        title: Text(
          _summary == null
              ? 'Performans'
              : 'Performans · ${_summary!.totalCompletedInPeriod} iş',
        ),
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _entries.isEmpty
          ? const EmptyStateView(
              title: 'Veri yok',
              icon: Icons.emoji_events_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _entries.length + (_summary != null ? 1 : 0),
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  if (_summary != null && index == 0) {
                    final sm = _summary!;
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceCard,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.borderDefault),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _period == 'this_year'
                                ? 'Bu Yılın Özeti'
                                : _period == 'last_month'
                                ? 'Geçen Ayın Özeti'
                                : 'Bu Ayın Özeti',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${sm.totalCompletedInPeriod} tamamlanan iş · '
                            'önceki dönem ${sm.totalCompletedPreviousPeriod} · '
                            'kişi başı ${sm.jobsPerStaff.toStringAsFixed(1)}',
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          if (sm.averageRating != null)
                            Text(
                              'Ortalama puan ${sm.averageRating!.toStringAsFixed(1)}'
                              ' (${sm.ratedJobsCount} puanlanmış iş)',
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          if (sm.onTimeRate != null)
                            Text(
                              'Zamanında tamamlama '
                              '%${sm.onTimeRate!.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: AppColors.success600,
                              ),
                            ),
                          if (_monthlyTarget != null)
                            Text(
                              'Kişi başı aylık hedef: $_monthlyTarget iş',
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary700,
                              ),
                            ),
                        ],
                      ),
                    );
                  }

                  final i = _summary != null ? index - 1 : index;
                  final e = _entries[i];
                  final rank = i + 1;
                  final rankColor = rank == 1
                      ? const Color(0xFFD4A017)
                      : rank == 2
                      ? const Color(0xFF9AA5B1)
                      : rank == 3
                      ? const Color(0xFFB08D57)
                      : AppColors.textFaint;
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceCard,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.borderDefault),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: rankColor.withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '$rank',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: rankColor,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                e.fullName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                '${e.position} · ${e.completedJobsInPeriod} iş '
                                '(önceki dönem ${e.completedJobsPreviousPeriod})',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              if (e.onTimeRate != null)
                                Text(
                                  'Zamanında %${e.onTimeRate!.toStringAsFixed(0)}'
                                  ' (${e.onTimeMeasuredJobs} planlı iş)',
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: e.onTimeRate! >= 90
                                        ? AppColors.success600
                                        : AppColors.warning600,
                                  ),
                                ),
                              if (e.targetCompletionPercent != null)
                                Text(
                                  'Hedefin '
                                  '%${e.targetCompletionPercent!.toStringAsFixed(0)}'
                                  "'i",
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: e.targetCompletionPercent! >= 100
                                        ? AppColors.success600
                                        : AppColors.warning600,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (e.averageRating != null)
                          Row(
                            children: [
                              const Icon(
                                Icons.star_rounded,
                                size: 16,
                                color: AppColors.warning500,
                              ),
                              const SizedBox(width: 2),
                              Text(
                                '${e.averageRating!.toStringAsFixed(2)}'
                                ' (${e.ratedJobsCount})',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12.5,
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
    );
  }
}
