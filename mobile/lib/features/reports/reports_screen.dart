import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';

/// backend/src/controllers/analyticsController.ts ile birebir — yalnızca
/// OWNER/MANAGER (routes/analytics.ts:13). Grafik kütüphanesi kullanılmadan
/// (kapsam dışı bırakılan bağımlılık) basit yatay çubuklarla gösterilir;
/// hesaplama backend'de zaten doğrulandı, burada yalnızca görselleştirilir.
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  List<Map<String, dynamic>> _serviceBreakdown = [];
  List<Map<String, dynamic>> _topDistricts = [];
  List<Map<String, dynamic>> _revenueTrend = [];
  Map<String, dynamic>? _retention;
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
      final api = ApiClient.instance;
      final results = await Future.wait([
        api.get<Map<String, dynamic>>('/analytics/service-breakdown'),
        api.get<Map<String, dynamic>>('/analytics/top-districts'),
        api.get<Map<String, dynamic>>('/analytics/customer-retention'),
        api.get<Map<String, dynamic>>('/analytics/revenue-trend'),
      ]);
      setState(() {
        _serviceBreakdown = (results[0]['data'] as List)
            .cast<Map<String, dynamic>>();
        _topDistricts = (results[1]['data'] as List)
            .cast<Map<String, dynamic>>();
        _retention = results[2];
        _revenueTrend = (results[3]['data'] as List)
            .cast<Map<String, dynamic>>();
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Raporlar yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: const Text('Raporlar')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_retention != null) ...[
                    const Text(
                      'Müşteri Sadakati (Bu Ay)',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _MiniStat(
                            label: 'Yeni Müşteri',
                            value: '${_retention!['newCustomers']}',
                            color: AppColors.info500,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _MiniStat(
                            label: 'Tekrar Eden',
                            value: '${_retention!['returningCustomers']}',
                            color: AppColors.success500,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                  ],
                  const Text(
                    'Ciro Trendi',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_revenueTrend.isEmpty)
                    const EmptyStateView(
                      title: 'Veri yok',
                      icon: Icons.trending_up_rounded,
                    )
                  else
                    ..._revenueTrend.map((m) {
                      final maxTotal = _revenueTrend
                          .map((e) => (e['total'] as num).toDouble())
                          .reduce((a, b) => a > b ? a : b);
                      final total = (m['total'] as num).toDouble();
                      return _BarRow(
                        label: m['label'] as String,
                        value: maxTotal == 0 ? 0 : (total / maxTotal) * 100,
                        caption: '₺${total.toStringAsFixed(0)}',
                      );
                    }),
                  const SizedBox(height: 20),
                  const Text(
                    'Hizmet Türü Dağılımı',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_serviceBreakdown.isEmpty)
                    const EmptyStateView(
                      title: 'Veri yok',
                      icon: Icons.pie_chart_outline_rounded,
                    )
                  else
                    ..._serviceBreakdown.map(
                      (s) => _BarRow(
                        label: s['serviceType'] as String,
                        value: (s['percentage'] as num).toDouble(),
                        caption: '${s['count']} iş',
                      ),
                    ),
                  const SizedBox(height: 20),
                  const Text(
                    'Bölge Bazında Yoğunluk',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_topDistricts.isEmpty)
                    const EmptyStateView(
                      title: 'Veri yok',
                      icon: Icons.map_outlined,
                    )
                  else
                    ..._topDistricts.asMap().entries.map((entry) {
                      final maxCount = (_topDistricts.first['count'] as num)
                          .toDouble();
                      final count = (entry.value['count'] as num).toDouble();
                      return _BarRow(
                        label: entry.value['district'] as String,
                        value: maxCount == 0 ? 0 : (count / maxCount) * 100,
                        caption: '${entry.value['count']} iş',
                      );
                    }),
                ],
              ),
            ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11.5,
              color: AppColors.textSecondary,
            ),
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
  const _BarRow({
    required this.label,
    required this.value,
    required this.caption,
  });

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
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                caption,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.textFaint,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: value / 100,
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
