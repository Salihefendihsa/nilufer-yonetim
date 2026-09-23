import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/executive_summary.dart';
import '../../models/job.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';
import '../approvals/approvals_screen.dart';
import '../contracts/contracts_list_screen.dart';
import '../customers/customers_list_screen.dart';
import '../finance/finance_screen.dart';
import '../jobs/jobs_list_screen.dart';
import '../performance/performance_screen.dart';
import '../reports/reports_screen.dart';
import '../staff/staff_list_screen.dart';
import '../stock/stock_list_screen.dart';
import 'executive_api.dart';

final _currency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);

const _rangeOptions = <(String, String)>[
  ('today', 'Bugün'),
  ('week', 'Bu Hafta'),
  ('month', 'Bu Ay'),
];

const _sectionTitles = <String, (String, IconData)>{
  'alerts': ('Uyarılar', Icons.warning_amber_rounded),
  'finance': ('Finans', Icons.account_balance_wallet_outlined),
  'operations': ('Operasyon', Icons.work_outline_rounded),
  'staff': ('Personel', Icons.groups_outlined),
  'customers': ('Müşteri', Icons.people_outline_rounded),
};

/// Bölüm G (2. tur): Yönetici Özet Paneli — web'in /yonetici-ozeti sayfası
/// ile aynı endpoint, aynı bölümler. Kartlar backend'in verdiği
/// `drillDown.route` anahtarına göre ilgili ekrana gider; `filter` ve seçili
/// aralık hedef ekrana aktarılır (bkz. `_screenForKpi`).
class ExecutiveSummaryScreen extends StatefulWidget {
  const ExecutiveSummaryScreen({super.key});

  @override
  State<ExecutiveSummaryScreen> createState() => _ExecutiveSummaryScreenState();
}

class _ExecutiveSummaryScreenState extends State<ExecutiveSummaryScreen> {
  final _api = ExecutiveApi();
  String _range = 'today';
  ExecutiveSummary? _summary;
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
      final summary = await _api.getSummary(_range);
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Yönetici özeti yüklenemedi';
        _loading = false;
      });
    }
  }

  /// backend `drillDown.route` + `drillDown.filter` → mobil ekran eşlemesi.
  /// Önceden `filter` yok sayılıyordu: "İş Sayısı (bugün)" gibi kartlar
  /// filtresiz tüm iş listesini açıyordu. İş listesi artık seçili aralıkla
  /// (Bugün/Bu Hafta/Bu Ay — backend rangeStart/rangeEnd) açılır.
  Widget? _screenForKpi(ExecutiveKpi kpi) {
    final filter = kpi.drillDown.filter;
    switch (kpi.drillDown.route) {
      case 'finance':
        return const FinanceScreen();
      case 'reports':
        return const ReportsScreen();
      case 'customers':
        return CustomersListScreen(
          initialSort: filter == 'debt' ? 'balance' : null,
        );
      case 'performance':
        return const PerformanceScreen();
      case 'jobs':
        final s = _summary;
        final label = _rangeOptions
            .firstWhere((o) => o.$1 == _range, orElse: () => _rangeOptions.first)
            .$2;
        return JobsListScreen(
          initialStatus: filter == 'COMPLETED' ? JobStatus.completed : null,
          from: s?.rangeStart,
          // Backend rangeEnd dışlayıcıdır (lt); liste `to` kapsayıcı (lte).
          to: s?.rangeEnd?.subtract(const Duration(milliseconds: 1)),
          // Tamamlanma oranı completedAt'e göre hesaplanır.
          dateField: filter == 'COMPLETED' ? 'completedAt' : null,
          rangeLabel: label,
        );
      case 'approvals':
        return const ApprovalsScreen();
      case 'staff':
        return const StaffListScreen();
      case 'stock':
        return const StockListScreen();
      case 'contracts':
        return const ContractsListScreen();
      default:
        return null;
    }
  }

  void _openDrillDown(ExecutiveKpi kpi) {
    final screen = _screenForKpi(kpi);
    if (screen == null) return;
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final summary = _summary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Yönetici Özeti'),
        actions: [
          IconButton(
            tooltip: 'Yenile',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SegmentedButton<String>(
              segments: [
                for (final (value, label) in _rangeOptions)
                  ButtonSegment(value: value, label: Text(label)),
              ],
              selected: {_range},
              showSelectedIcon: false,
              onSelectionChanged: (s) {
                setState(() => _range = s.first);
                _load();
              },
            ),
          ),
          Expanded(
            child: _error != null && summary == null
                ? ErrorRetryView(message: _error!, onRetry: _load)
                : _loading && summary == null
                ? const LoadingView()
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      children: [
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              _error!,
                              style: tx.bodySmall.copyWith(color: cs.danger500),
                            ),
                          ),
                        for (final section in summary!.sections) ...[
                          _SectionHeader(sectionKey: section.key),
                          _KpiGrid(kpis: section.kpis, onTap: _openDrillDown),
                          const SizedBox(height: 16),
                        ],
                        Text(
                          'Son güncelleme: ${DateFormat.Hm().format(summary.generatedAt.toLocal())}',
                          style: tx.caption.copyWith(color: cs.textFaint),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String sectionKey;
  const _SectionHeader({required this.sectionKey});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final (title, icon) =
        _sectionTitles[sectionKey] ?? (sectionKey, Icons.circle);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: cs.textSecondary),
          const SizedBox(width: 6),
          Text(
            title.toUpperCase(),
            style: tx.caption.copyWith(
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiGrid extends StatelessWidget {
  final List<ExecutiveKpi> kpis;
  final void Function(ExecutiveKpi) onTap;
  const _KpiGrid({required this.kpis, required this.onTap});

  @override
  Widget build(BuildContext context) {
    // Satır yüksekliği yazı boyutuyla ölçeklenir: sabit childAspectRatio
    // (1.45) büyük yazı ayarında kartın altından ~10 px taşıyordu.
    final rowHeight = MediaQuery.textScalerOf(context).scale(118);
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        mainAxisExtent: rowHeight,
      ),
      itemCount: kpis.length,
      itemBuilder: (_, i) =>
          _KpiCard(kpi: kpis[i], onTap: () => onTap(kpis[i])),
    );
  }
}

/// Backend `format` alanına göre değer biçimlendirmesi — web'in
/// formatKpiValue ile aynı kurallar.
String formatKpiValue(ExecutiveKpi kpi) {
  final value = kpi.value;
  if (value == null) return '—';
  switch (kpi.format) {
    case 'currency':
      return _currency.format(value);
    case 'percent':
      return '%${value.toStringAsFixed(1)}';
    case 'score':
      return value.toStringAsFixed(1);
    default:
      return NumberFormat.decimalPattern('tr_TR').format(value);
  }
}

Color toneColor(AppPalette cs, String tone) {
  switch (tone) {
    case 'success':
      return cs.primary600;
    case 'warning':
      return cs.warning600;
    case 'danger':
      return cs.danger500;
    case 'info':
      return cs.info600;
    default:
      return cs.ink;
  }
}

class _KpiCard extends StatelessWidget {
  final ExecutiveKpi kpi;
  final VoidCallback onTap;
  const _KpiCard({required this.kpi, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final tx = context.text;
    final color = toneColor(context.colors, kpi.tone);
    final theme = Theme.of(context);
    return Material(
      color: theme.cardColor,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: theme.dividerColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      kpi.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: tx.caption,
                    ),
                  ),
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    formatKpiValue(kpi),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: tx.display.copyWith(
                      fontWeight: FontWeight.w800,
                      color: color,
                    ),
                  ),
                  if (kpi.hint != null)
                    Text(
                      kpi.hint!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tx.label,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
