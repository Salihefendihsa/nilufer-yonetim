import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';

const _dayOptions = [7, 30, 90];
final _dateFormat = DateFormat('d MMM, HH:mm', 'tr_TR');

/// backend/src/routes/sessions.ts: GET /sessions/report yalnızca OWNER'a açık
/// (web'in kullanim-istatistikleri/page.tsx ile birebir aynı uç ve türetilmiş
/// istatistikler). Grafik kütüphanesi kullanılmadan (mevcut Flutter deseni)
/// basit çubuklarla gösterilir.
class UsageStatsScreen extends StatefulWidget {
  const UsageStatsScreen({super.key});

  @override
  State<UsageStatsScreen> createState() => _UsageStatsScreenState();
}

class _UsageStatsScreenState extends State<UsageStatsScreen> {
  int _days = 30;
  List<Map<String, dynamic>> _rows = [];
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
        '/sessions/report',
        query: {'days': _days},
      );
      setState(() => _rows = (json['data'] as List).cast<Map<String, dynamic>>());
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Kullanım istatistikleri yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  String _formatDuration(num minutes) {
    final hours = minutes ~/ 60;
    final mins = (minutes % 60).round();
    if (hours == 0) return '$mins dk';
    if (mins == 0) return '$hours sa';
    return '$hours sa $mins dk';
  }

  @override
  Widget build(BuildContext context) {
    final totalUsers = _rows.length;
    final totalSessions = _rows.fold<int>(0, (s, r) => s + (r['totalSessions'] as int));
    final weightedMinutes = _rows.fold<double>(
      0,
      (s, r) => s + (r['averageDurationMinutes'] as num) * (r['totalSessions'] as int),
    );
    final avgDuration = totalSessions > 0 ? weightedMinutes / totalSessions : 0;
    final weekAgo = DateTime.now().subtract(const Duration(days: 7));
    final activeUsers = _rows
        .where((r) => DateTime.parse(r['lastLoginAt'] as String).isAfter(weekAgo))
        .length;

    final roleCounts = <String, int>{};
    for (final r in _rows) {
      final role = r['role'] as String;
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }

    final topUsers = _rows.toList()
      ..sort((a, b) => (b['totalSessions'] as int).compareTo(a['totalSessions'] as int));
    final maxSessions = topUsers.isNotEmpty ? topUsers.first['totalSessions'] as int : 1;

    return Scaffold(
      appBar: AppBar(title: const Text('Kullanım İstatistikleri')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: _dayOptions
                  .map(
                    (d) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text('Son $d Gün'),
                        selected: _days == d,
                        onSelected: (_) {
                          setState(() => _days = d);
                          _load();
                        },
                        selectedColor: AppColors.primary600,
                        labelStyle: TextStyle(
                          color: _days == d ? AppColors.textInverse : AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                          fontSize: 12.5,
                        ),
                        backgroundColor: AppColors.surfaceCard,
                        side: const BorderSide(color: AppColors.borderDefault),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorRetryView(message: _error!, onRetry: _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    color: AppColors.primary600,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        GridView.count(
                          crossAxisCount: 2,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 1.7,
                          children: [
                            _StatCard(label: 'Toplam kullanıcı', value: '$totalUsers'),
                            _StatCard(label: 'Toplam oturum', value: '$totalSessions'),
                            _StatCard(
                              label: 'Son 7 günde aktif',
                              value: '$activeUsers',
                              caption: totalUsers > 0
                                  ? '%${((activeUsers / totalUsers) * 100).round()} aktif'
                                  : null,
                            ),
                            _StatCard(
                              label: 'Ort. oturum süresi',
                              value: _formatDuration(avgDuration),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        if (_rows.isEmpty)
                          const EmptyStateView(
                            title: 'Bu aralıkta oturum kaydı yok',
                            icon: Icons.timer_outlined,
                          )
                        else ...[
                          const Text(
                            'Rol Dağılımı',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                          ),
                          const SizedBox(height: 8),
                          ...roleCounts.entries.map(
                            (e) => _BarRow(
                              label: roleLabelTr(roleFromString(e.key)),
                              value: totalUsers == 0 ? 0 : (e.value / totalUsers) * 100,
                              caption: '${e.value} kullanıcı',
                            ),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'En Çok Oturum Açanlar',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                          ),
                          const SizedBox(height: 8),
                          ...topUsers.take(8).map(
                            (r) => _BarRow(
                              label: r['fullName'] as String,
                              value: (r['totalSessions'] as int) / maxSessions * 100,
                              caption: '${r['totalSessions']} oturum',
                            ),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'Detaylı Liste',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                          ),
                          const SizedBox(height: 8),
                          ..._rows.map((r) => _SessionRow(row: r, formatDuration: _formatDuration)),
                        ],
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String? caption;
  const _StatCard({required this.label, required this.value, this.caption});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary),
          ),
          if (caption != null)
            Text(
              caption!,
              style: const TextStyle(fontSize: 10, color: AppColors.textFaint),
            ),
        ],
      ),
    );
  }
}

class _BarRow extends StatelessWidget {
  final String label;
  final double value;
  final String caption;
  const _BarRow({required this.label, required this.value, required this.caption});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                ),
              ),
              Text(
                caption,
                style: const TextStyle(fontSize: 11.5, color: AppColors.textFaint),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: (value / 100).clamp(0, 1),
              minHeight: 8,
              backgroundColor: AppColors.surfaceMuted,
              color: AppColors.primary500,
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionRow extends StatelessWidget {
  final Map<String, dynamic> row;
  final String Function(num) formatDuration;
  const _SessionRow({required this.row, required this.formatDuration});

  @override
  Widget build(BuildContext context) {
    final approximate = row['isApproximate'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row['fullName'] as String,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  roleLabelTr(roleFromString(row['role'] as String)),
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${row['totalSessions']} oturum',
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
              ),
              Text(
                '${approximate ? '~' : ''}${formatDuration(row['averageDurationMinutes'] as num)}',
                style: const TextStyle(fontSize: 10.5, color: AppColors.textFaint),
              ),
              Text(
                _dateFormat.format(DateTime.parse(row['lastLoginAt'] as String)),
                style: const TextStyle(fontSize: 10, color: AppColors.textFaint),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
