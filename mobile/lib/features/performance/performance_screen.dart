import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/chip_bar.dart';
import '../../widgets/staggered_fade_in.dart';
import '../../widgets/state_views.dart';
import '../evaluations/evaluations_screen.dart';
import '../../widgets/badges.dart';

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

  /// Bölüm Q (4. tur): GOLD / SILVER / BRONZE (backend lib/badges.ts); yoksa null.
  final String? achievementTier;

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
    this.achievementTier,
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
        targetCompletionPercent: (json['targetCompletionPercent'] as num?)
            ?.toDouble(),
        achievementTier: json['achievementTier'] as String?,
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

  /// web'in "Personel bazlı tamamlanan iş" + "Müşteri puanı sıralaması" 2
  /// çubuk grafiği — rank rozetleri (altın/gümüş/bronz) zaten bir podyum
  /// görseli sağlıyor; bu ikisi sayısal karşılaştırmayı görsel bir çubuğa
  /// çeviriyor (grafik kütüphanesi eklenmeden, mevcut çubuk-satır deseniyle).
  Widget _buildRankingCharts() {
    final cs = context.colors;
    final tx = context.text;
    final byJobs = [..._entries]
      ..sort(
        (a, b) => b.completedJobsInPeriod.compareTo(a.completedJobsInPeriod),
      );
    final maxJobs = byJobs.isNotEmpty ? byJobs.first.completedJobsInPeriod : 0;

    final rated = _entries.where((e) => e.averageRating != null).toList()
      ..sort((a, b) => b.averageRating!.compareTo(a.averageRating!));

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tamamlanan İşe Göre Sıralama',
            style: tx.body.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          for (final e in byJobs.take(8))
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  SizedBox(
                    width: 90,
                    child: Text(
                      e.fullName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tx.caption,
                    ),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      child: LinearProgressIndicator(
                        value: maxJobs == 0
                            ? 0
                            : e.completedJobsInPeriod / maxJobs,
                        minHeight: 8,
                        backgroundColor: cs.surfaceMuted,
                        color: cs.primary500,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 24,
                    child: Text(
                      '${e.completedJobsInPeriod}',
                      textAlign: TextAlign.right,
                      style: tx.caption.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
          if (rated.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              'Müşteri Puanına Göre Sıralama',
              style: tx.body.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            for (final e in rated.take(8))
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    SizedBox(
                      width: 90,
                      child: Text(
                        e.fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: tx.caption,
                      ),
                    ),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        child: LinearProgressIndicator(
                          value: (e.averageRating! / 5).clamp(0, 1),
                          minHeight: 8,
                          backgroundColor: cs.surfaceMuted,
                          color: cs.warning500,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 30,
                      child: Text(
                        e.averageRating!.toStringAsFixed(2),
                        textAlign: TextAlign.right,
                        style: tx.caption.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: ChipBar(
            spacing: 0,
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
                    label: Text(option.$2, style: tx.caption),
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
        title: Text(
          _summary == null
              ? 'Performans'
              : 'Performans · ${_summary!.totalCompletedInPeriod} iş',
        ),
        actions: [
          // Formal Değerlendirme sistemi — mevcut liderlik tablosundan ayrı,
          // bağımsız bir bölüm (web'deki "Değerlendirmeler" sekmesiyle aynı işlev).
          IconButton(
            icon: const Icon(Icons.checklist_rtl_outlined),
            tooltip: 'Değerlendirmeler',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const EvaluationsScreen()),
            ),
          ),
        ],
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
              color: cs.accentSoft,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount:
                    _entries.length +
                    (_summary != null ? 1 : 0) +
                    (_entries.length > 1 ? 1 : 0),
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, rawIndex) {
                  var index = rawIndex;
                  if (_summary != null && index == 0) {
                    final sm = _summary!;
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: cs.surfaceCard,
                        borderRadius: BorderRadius.circular(AppRadius.card),
                        border: Border.all(color: cs.borderDefault),
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
                            style: tx.subtitle.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${sm.totalCompletedInPeriod} tamamlanan iş · '
                            'önceki dönem ${sm.totalCompletedPreviousPeriod} · '
                            'kişi başı ${sm.jobsPerStaff.toStringAsFixed(1)}',
                            style: tx.bodySmall,
                          ),
                          Text(
                            '${sm.staffCount} personel bu listede',
                            style: tx.bodySmall,
                          ),
                          if (sm.averageRating != null)
                            Text(
                              'Ortalama puan ${sm.averageRating!.toStringAsFixed(1)}'
                              ' (${sm.ratedJobsCount} puanlanmış iş)',
                              style: tx.bodySmall,
                            ),
                          if (sm.onTimeRate != null)
                            Text(
                              'Zamanında tamamlama '
                              '%${sm.onTimeRate!.toStringAsFixed(0)}',
                              style: tx.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                                color: cs.success600,
                              ),
                            ),
                          if (_monthlyTarget != null)
                            Text(
                              'Kişi başı aylık hedef: $_monthlyTarget iş',
                              style: tx.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                                color: cs.accent,
                              ),
                            ),
                        ],
                      ),
                    );
                  }
                  if (_summary != null) index -= 1;

                  if (_entries.length > 1 && index == 0) {
                    return _buildRankingCharts();
                  }
                  if (_entries.length > 1) index -= 1;

                  final i = index;
                  final e = _entries[i];
                  final rank = i + 1;
                  final rankColor = rank == 1
                      ? const Color(0xFFD4A017)
                      : rank == 2
                      ? const Color(0xFF9AA5B1)
                      : rank == 3
                      ? const Color(0xFFB08D57)
                      : cs.textFaint;
                  return StaggeredFadeIn(
                    index: i,
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: cs.surfaceCard,
                        borderRadius: BorderRadius.circular(AppRadius.card),
                        border: Border.all(color: cs.borderDefault),
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
                              style: tx.subtitle.copyWith(
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
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        e.fullName,
                                        overflow: TextOverflow.ellipsis,
                                        style: tx.subtitle.copyWith(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                    if (e.achievementTier != null) ...[
                                      const SizedBox(width: 6),
                                      AchievementBadge(tier: e.achievementTier),
                                    ],
                                  ],
                                ),
                                Text(
                                  '${e.position} · ${e.completedJobsInPeriod} iş '
                                  '(önceki dönem ${e.completedJobsPreviousPeriod})',
                                  style: tx.caption,
                                ),
                                if (e.onTimeRate != null)
                                  Text(
                                    'Zamanında %${e.onTimeRate!.toStringAsFixed(0)}'
                                    ' (${e.onTimeMeasuredJobs} planlı iş)',
                                    style: tx.caption.copyWith(
                                      fontWeight: FontWeight.w600,
                                      color: e.onTimeRate! >= 90
                                          ? cs.success600
                                          : cs.warning600,
                                    ),
                                  ),
                                if (e.targetCompletionPercent != null)
                                  Text(
                                    'Hedefin '
                                    '%${e.targetCompletionPercent!.toStringAsFixed(0)}'
                                    "'i",
                                    style: tx.caption.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: e.targetCompletionPercent! >= 100
                                          ? cs.success600
                                          : cs.warning600,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          if (e.averageRating != null)
                            Row(
                              children: [
                                Icon(
                                  Icons.star_rounded,
                                  size: 16,
                                  color: cs.warning500,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  '${e.averageRating!.toStringAsFixed(2)}'
                                  ' (${e.ratedJobsCount})',
                                  style: tx.bodySmall.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
