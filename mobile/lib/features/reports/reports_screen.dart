import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../theme/app_colors.dart';
import '../../widgets/charts.dart';
import '../../widgets/state_views.dart';

/// backend/src/controllers/analyticsController.ts ile birebir — yalnızca
/// OWNER/MANAGER (routes/analytics.ts:13). Ciro trendi ve hizmet dağılımı
/// fl_chart ile gerçek, animasyonlu grafikler olarak çizilir (bkz.
/// widgets/charts.dart); hesaplama backend'de zaten doğrulandı, burada
/// yalnızca görselleştirilir.
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
  /// Bölüm S (5. tur): /analytics/feedback-summary (null → blok gizli).
  Map<String, dynamic>? _feedback;
  /// Bölüm AA (6. tur): /analytics/year-over-year — geçen yıl serisi.
  List<Map<String, dynamic>> _yoy = [];
  bool _loading = true;
  String? _error;
  bool _downloadingPdf = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _downloadPdf() async {
    setState(() => _downloadingPdf = true);
    try {
      await downloadAndShare('/analytics/export/pdf', 'raporlar.pdf');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'PDF indirilemedi')),
        );
      }
    } finally {
      if (mounted) setState(() => _downloadingPdf = false);
    }
  }

  Widget _buildFeedbackSummary(Map<String, dynamic> f) {
    final rate = f['recommendRate'] as num?;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Müşteri Geri Bildirimi',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
        ),
        Text(
          '${f['responseCount']} detaylı değerlendirme'
          '${rate != null ? ' · %${rate.round()} tavsiye eder' : ''}',
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: AppColors.borderDefault),
          ),
          child: Column(
            children: [
              _feedbackRow('Hizmet Kalitesi', f['serviceQualityAvg'] as num?),
              _feedbackRow('Dakiklik', f['punctualityAvg'] as num?),
              _feedbackRow('Personel Profesyonelliği', f['staffProfessionalismAvg'] as num?),
            ],
          ),
        ),
      ],
    );
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
        api.get<Map<String, dynamic>>('/analytics/feedback-summary'),
        api.get<Map<String, dynamic>>('/analytics/year-over-year'),
      ]);
      setState(() {
        _serviceBreakdown = (results[0]['data'] as List)
            .cast<Map<String, dynamic>>();
        _topDistricts = (results[1]['data'] as List)
            .cast<Map<String, dynamic>>();
        _retention = results[2];
        _revenueTrend = (results[3]['data'] as List)
            .cast<Map<String, dynamic>>();
        _feedback = results[4];
        _yoy = ((results[5]['data'] as List?) ?? const []).cast<Map<String, dynamic>>();
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
      appBar: AppBar(
        title: const Text('Raporlar'),
        actions: [
          IconButton(
            icon: _downloadingPdf
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.picture_as_pdf_outlined),
            tooltip: 'PDF İndir',
            onPressed: _downloadingPdf ? null : _downloadPdf,
          ),
        ],
      ),
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
                  if (_feedback != null &&
                      ((_feedback!['responseCount'] as num?) ?? 0) > 0) ...[
                    _buildFeedbackSummary(_feedback!),
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
                    RevenueTrendChart(
                      points: _revenueTrend
                          .map(
                            (m) => ChartPoint(
                              m['label'] as String,
                              (m['total'] as num).toDouble(),
                            ),
                          )
                          .toList(),
                      // Bölüm AA (6. tur): geçen yılın aynı ayları — gri kesikli çizgi.
                      secondaryPoints: _yoy.isEmpty
                          ? null
                          : [
                              for (final p in _yoy)
                                ChartPoint(
                                  p['month'] as String? ?? '',
                                  ((p['lastYear'] as num?) ?? 0).toDouble(),
                                ),
                            ],
                    ),
                  if (_yoy.isNotEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        'Yeşil: bu yıl · Gri kesikli: geçen yılın aynı ayları',
                        style: TextStyle(fontSize: 11, color: AppColors.textFaint),
                      ),
                    ),
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
                    CategoryPieChart(
                      points: _serviceBreakdown
                          .map(
                            (s) => ChartPoint(
                              s['serviceType'] as String,
                              (s['percentage'] as num).toDouble(),
                            ),
                          )
                          .toList(),
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

/// Bölüm S (5. tur): 3 kriterin ortalaması (1–5) + tavsiye oranı.
Widget _feedbackRow(String label, num? avg) {
  final v = (avg ?? 0).toDouble();
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        SizedBox(width: 150, child: Text(label, style: const TextStyle(fontSize: 12.5))),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: (v / 5).clamp(0, 1),
              minHeight: 8,
              backgroundColor: AppColors.surfaceMuted,
              color: AppColors.primary500,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text('${v.toStringAsFixed(1)} / 5', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
      ],
    ),
  );
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
