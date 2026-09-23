import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../navigation/sub_page_scaffold.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';

const _pollInterval = Duration(seconds: 10);
const _maxSamples = 20;

/// Sunucunun dakika serisinden (son 60 dk) gösterilecek son dakika sayısı.
const _visibleMinutes = 10;

/// backend/src/routes/system.ts: GET /system/health yalnızca OWNER'a açık
/// (web'in sistem-durumu/page.tsx ile birebir aynı uç). Grafik kütüphanesi
/// kullanılmadan (mevcut Flutter deseni — bkz. reports_screen.dart) basit
/// çubuklarla gösterilir.
class SystemHealthScreen extends StatefulWidget {
  const SystemHealthScreen({super.key});

  @override
  State<SystemHealthScreen> createState() => _SystemHealthScreenState();
}

class _Sample {
  final String label;
  final int requests;
  final int errors;
  const _Sample(this.label, this.requests, this.errors);
}

class _SystemHealthScreenState extends State<SystemHealthScreen> {
  Map<String, dynamic>? _health;
  String? _error;
  Timer? _timer;
  ({int requests, int errors})? _previous;
  final List<_Sample> _samples = [];

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(_pollInterval, (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final json = await ApiClient.instance.get<Map<String, dynamic>>(
        '/system/health',
      );
      final requests = json['totalRequestsToday'] as int;
      final errors = json['errorCount24h'] as int;
      final previous = _previous;
      _previous = (requests: requests, errors: errors);
      // Backend dakika bazlı gerçek trafiği biriktirir (lib/metrics.ts) —
      // ekran açılır açılmaz son dakikalar görünür. Alan yoksa (eski backend)
      // eski istemci tarafı fark yöntemine düşülür.
      final series = (json['trafficPerMinute'] as List?)
          ?.cast<Map<String, dynamic>>();

      if (!mounted) return;
      setState(() {
        _health = json;
        _error = null;
        if (series != null) {
          _samples
            ..clear()
            ..addAll(
              series
                  .skip(series.length - _visibleMinutes.clamp(0, series.length))
                  .map((b) {
                    final t = DateTime.parse(b['minute'] as String).toLocal();
                    return _Sample(
                      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}',
                      b['requests'] as int,
                      b['errors'] as int,
                    );
                  }),
            );
        } else if (previous != null) {
          final now = TimeOfDay.now();
          final label =
              '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
          _samples.add(
            _Sample(
              label,
              (requests - previous.requests).clamp(0, 1 << 30),
              (errors - previous.errors).clamp(0, 1 << 30),
            ),
          );
          if (_samples.length > _maxSamples) _samples.removeAt(0);
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _error = e is ApiException
            ? e.message
            : 'Sistem durumu yüklenemedi',
      );
    }
  }

  String _formatUptime(int seconds) {
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final secs = seconds % 60;
    if (hours > 0) return '${hours}s ${minutes}dk';
    if (minutes > 0) return '${minutes}dk ${secs}sn';
    return '${secs}sn';
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final health = _health;

    return SubPageScaffold(
      title: 'Sistem Durumu',
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: cs.primary500,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Text('Canlı · 10 sn', style: tx.caption),
              ],
            ),
          ),
        ),
      ],
      body: health == null && _error == null
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: cs.danger50,
                      borderRadius: BorderRadius.circular(AppRadius.card),
                    ),
                    child: Text(
                      _error!,
                      style: tx.bodySmall.copyWith(color: cs.danger500),
                    ),
                  ),
                if (health != null) ...[
                  // Satır yüksekliği yazı boyutuyla ölçeklenir (sabit 2.6 en-boy
                  // oranı büyük yazıda ~6 px taşıyordu).
                  GridView(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      mainAxisExtent: MediaQuery.textScalerOf(context)
                          .scale(64),
                    ),
                    children: [
                      _HealthPill(
                        label: 'API',
                        healthy: health['api'] == 'healthy',
                        hint: 'Uygulama sunucusu',
                        icon: Icons.dns_rounded,
                      ),
                      _HealthPill(
                        label: 'Veritabanı',
                        healthy: health['database'] == 'healthy',
                        hint: 'PostgreSQL bağlantısı',
                        icon: Icons.storage_rounded,
                      ),
                      _HealthPill(
                        label: 'E-posta',
                        healthy: health['emailConfigured'] == true,
                        hint: health['emailConfigured'] == true
                            ? 'SMTP yapılandırıldı'
                            : 'SMTP yapılandırılmadı',
                        icon: Icons.mail_outline_rounded,
                        warnInsteadOfDown: true,
                      ),
                      const _HealthPill(
                        label: 'Yedekleme',
                        healthy: true,
                        hint: 'Manuel dışa aktarma açık',
                        icon: Icons.shield_outlined,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _StatTile(
                          label: 'Çalışma süresi',
                          value: _formatUptime(health['uptimeSeconds'] as int),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatTile(
                          label: 'Bugünkü istek',
                          value: '${health['totalRequestsToday']}',
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatTile(
                          label: '24s hata',
                          value: '${health['errorCount24h']}',
                          danger: (health['errorCount24h'] as int) > 0,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Canlı Trafik',
                    style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Son $_visibleMinutes dakika · dakika başına istek (10 sn aralıkla yenilenir)',
                    style: tx.caption.copyWith(color: cs.textFaint),
                  ),
                  const SizedBox(height: 10),
                  if (_samples.isEmpty)
                    const EmptyStateView(
                      title: 'İlk örnekler toplanıyor…',
                      icon: Icons.show_chart_rounded,
                    )
                  else
                    ..._samples.reversed
                        .take(_visibleMinutes)
                        .map(
                          (s) => _TrafficRow(
                            sample: s,
                            maxRequests: _maxOf(_samples),
                          ),
                        ),
                ],
              ],
            ),
    );
  }

  int _maxOf(List<_Sample> samples) {
    var max = 1;
    for (final s in samples) {
      if (s.requests > max) max = s.requests;
    }
    return max;
  }
}

class _HealthPill extends StatelessWidget {
  final String label;
  final bool healthy;
  final String hint;
  final IconData icon;
  final bool warnInsteadOfDown;

  const _HealthPill({
    required this.label,
    required this.healthy,
    required this.hint,
    required this.icon,
    this.warnInsteadOfDown = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final color = healthy
        ? cs.success500
        : (warnInsteadOfDown ? cs.warning500 : cs.danger500);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppRadius.chip),
            ),
            child: Icon(icon, size: 17, color: color),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: tx.bodySmall.copyWith(fontWeight: FontWeight.w700),
                ),
                Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      healthy
                          ? 'Çalışıyor'
                          : (warnInsteadOfDown ? 'Kısıtlı' : 'Sorunlu'),
                      style: tx.label.copyWith(
                        fontWeight: FontWeight.w600,
                        color: color,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  final bool danger;
  const _StatTile({
    required this.label,
    required this.value,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: tx.title.copyWith(
              fontWeight: FontWeight.w800,
              color: danger ? cs.danger500 : cs.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: tx.label.copyWith(color: cs.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _TrafficRow extends StatelessWidget {
  final _Sample sample;
  final int maxRequests;
  const _TrafficRow({required this.sample, required this.maxRequests});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(width: 44, child: Text(sample.label, style: tx.label)),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.pill),
              child: LinearProgressIndicator(
                value: sample.requests / maxRequests,
                minHeight: 8,
                backgroundColor: cs.surfaceMuted,
                color: sample.errors > 0 ? cs.danger500 : cs.primary500,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 92,
            child: Text(
              sample.errors > 0
                  ? '${sample.requests} ist. · ${sample.errors} hata'
                  : '${sample.requests} istek',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
              style: tx.label,
            ),
          ),
        ],
      ),
    );
  }
}
