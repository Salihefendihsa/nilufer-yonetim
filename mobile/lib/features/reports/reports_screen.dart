import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
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

  /// Bölüm AE (7. tur): /analytics/quote-response-time (null → blok gizli).
  Map<String, dynamic>? _responseTime;
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
          SnackBar(
            content: Text(e is ApiException ? e.message : 'PDF indirilemedi'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _downloadingPdf = false);
    }
  }

  /// Bölüm AE (7. tur): teklif yanıt hızı — son 30 gün (90 günle kıyas).
  Widget _buildResponseTime(Map<String, dynamic> rt) {
    final cs = context.colors;
    final tx = context.text;
    final last30 = (rt['last30'] as Map<String, dynamic>?) ?? const {};
    final last90 = (rt['last90'] as Map<String, dynamic>?) ?? const {};
    String fmt(Map<String, dynamic> w, String key) {
      final v = w[key] as num?;
      return v == null ? 'Veri yok' : '${v.toStringAsFixed(1)} sa';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Yanıt Hızı (Teklifler)',
          style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _MiniStat(
                label: 'Ort. ilk temas · 30g',
                value: fmt(last30, 'avgFirstContactHours'),
                color: cs.info500,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _MiniStat(
                label: 'Ort. dönüşüm · 30g',
                value: fmt(last30, 'avgConversionHours'),
                color: cs.warning500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '90 gün: ilk temas ${fmt(last90, 'avgFirstContactHours')} · dönüşüm ${fmt(last90, 'avgConversionHours')} '
          '(${last30['quoteCount'] ?? 0} teklif / 30g)',
          style: tx.caption.copyWith(color: cs.textFaint),
        ),
      ],
    );
  }

  Widget _buildFeedbackSummary(Map<String, dynamic> f) {
    final cs = context.colors;
    final tx = context.text;
    final rate = f['recommendRate'] as num?;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Müşteri Geri Bildirimi',
          style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
        ),
        Text(
          '${f['responseCount']} detaylı değerlendirme'
          '${rate != null ? ' · %${rate.round()} tavsiye eder' : ''}',
          style: tx.caption,
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: cs.surfaceCard,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: cs.borderDefault),
          ),
          child: Column(
            children: [
              _feedbackRow(
                context,
                'Hizmet Kalitesi',
                f['serviceQualityAvg'] as num?,
              ),
              _feedbackRow(context, 'Dakiklik', f['punctualityAvg'] as num?),
              _feedbackRow(
                context,
                'Personel Profesyonelliği',
                f['staffProfessionalismAvg'] as num?,
              ),
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
        api.get<Map<String, dynamic>>('/analytics/quote-response-time'),
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
        _yoy = ((results[5]['data'] as List?) ?? const [])
            .cast<Map<String, dynamic>>();
        _responseTime = results[6];
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
    final cs = context.colors;
    final tx = context.text;
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
              color: cs.accentSoft,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_retention != null) ...[
                    Text(
                      'Müşteri Sadakati (Bu Ay)',
                      style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _MiniStat(
                            label: 'Yeni Müşteri',
                            value: '${_retention!['newCustomers']}',
                            color: cs.info500,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _MiniStat(
                            label: 'Tekrar Eden',
                            value: '${_retention!['returningCustomers']}',
                            color: cs.success500,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                  ],
                  if (_responseTime != null) ...[
                    _buildResponseTime(_responseTime!),
                    const SizedBox(height: 20),
                  ],
                  if (_feedback != null &&
                      ((_feedback!['responseCount'] as num?) ?? 0) > 0) ...[
                    _buildFeedbackSummary(_feedback!),
                    const SizedBox(height: 20),
                  ],
                  Text(
                    'Ciro Trendi',
                    style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
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
                    Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        'Yeşil: bu yıl · Gri kesikli: geçen yılın aynı ayları',
                        style: tx.label,
                      ),
                    ),
                  const SizedBox(height: 20),
                  Text(
                    'Hizmet Türü Dağılımı',
                    style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
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
                  Text(
                    'Bölge Bazında Yoğunluk',
                    style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
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
Widget _feedbackRow(BuildContext context, String label, num? avg) {
  final cs = context.colors;
  final tx = context.text;
  final v = (avg ?? 0).toDouble();
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        SizedBox(width: 150, child: Text(label, style: tx.bodySmall)),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: (v / 5).clamp(0, 1),
              minHeight: 8,
              backgroundColor: cs.surfaceMuted,
              color: cs.primary500,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          '${v.toStringAsFixed(1)} / 5',
          style: tx.caption.copyWith(fontWeight: FontWeight.w700),
        ),
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
    final tx = context.text;
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
            style: tx.display.copyWith(
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(label, style: tx.caption),
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
    final cs = context.colors;
    final tx = context.text;
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
                style: tx.bodySmall.copyWith(fontWeight: FontWeight.w600),
              ),
              Text(caption, style: tx.caption.copyWith(color: cs.textFaint)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: value / 100,
              minHeight: 8,
              backgroundColor: cs.surfaceMuted,
              color: cs.primary500,
            ),
          ),
        ],
      ),
    );
  }
}
