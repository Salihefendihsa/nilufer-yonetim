import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/payslip.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';

final _currency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);
final _monthFormat = DateFormat('MMMM yyyy', 'tr_TR');
final _dateFormat = DateFormat('d MMM', 'tr_TR');

/// Bölüm AN (9. tur): "Bordrom" — personelin kendi aylık maaş+prim özeti
/// (GET /staff/me/payslip?month=). SALT GÖRÜNTÜLEME; ödeme tetiklemez.
/// Yalnızca STAFF/TEAM_LEAD kabuklarından açılır (backend de yönetimi 403'ler).
class PayslipScreen extends StatefulWidget {
  const PayslipScreen({super.key});

  @override
  State<PayslipScreen> createState() => _PayslipScreenState();
}

class _PayslipScreenState extends State<PayslipScreen> {
  final _api = ApiClient.instance;
  DateTime _cursor = DateTime(DateTime.now().year, DateTime.now().month);
  Payslip? _payslip;
  bool _loading = true;
  String? _error;

  String get _monthKey =>
      '${_cursor.year}-${_cursor.month.toString().padLeft(2, '0')}';

  bool get _isCurrentMonth {
    final now = DateTime.now();
    return _cursor.year == now.year && _cursor.month == now.month;
  }

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
      final json = await _api.get<Map<String, dynamic>>(
        '/staff/me/payslip',
        query: {'month': _monthKey},
      );
      setState(() => _payslip = Payslip.fromJson(json));
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Bordro yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  void _shift(int delta) {
    setState(() => _cursor = DateTime(_cursor.year, _cursor.month + delta));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final p = _payslip;
    return Scaffold(
      appBar: AppBar(title: const Text('Bordrom')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: () => _shift(-1),
                  icon: const Icon(Icons.chevron_left_rounded),
                  tooltip: 'Önceki ay',
                ),
                SizedBox(
                  width: 160,
                  child: Text(
                    _monthFormat.format(_cursor),
                    textAlign: TextAlign.center,
                    style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  onPressed: _isCurrentMonth ? null : () => _shift(1),
                  icon: const Icon(Icons.chevron_right_rounded),
                  tooltip: 'Sonraki ay',
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null || p == null
                ? ErrorRetryView(
                    message: _error ?? 'Bordro yüklenemedi',
                    onRetry: _load,
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    color: cs.accentSoft,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _SummaryCard(payslip: p),
                        const SizedBox(height: 12),
                        _LinesCard(payslip: p),
                        const SizedBox(height: 12),
                        Text(
                          'Prim onaylandığı aya, avans talep edildiği aya yazılır. '
                          'Vergi/SGK kesintileri dahil değildir; bilgilendirme amaçlıdır, '
                          'ödeme işlemi başlatmaz.',
                          style: tx.caption,
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

class _SummaryCard extends StatelessWidget {
  final Payslip payslip;
  const _SummaryCard({required this.payslip});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cs.primary700,
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Net (tahmini)',
            style: tx.caption.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: 4),
          Text(
            _currency.format(payslip.net),
            style: tx.stat.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _Mini('Taban', _currency.format(payslip.salaryBase)),
              _Mini(
                'Prim (${payslip.bonusCount})',
                '+${_currency.format(payslip.bonusTotal)}',
              ),
              _Mini(
                'Avans (${payslip.advanceCount})',
                '−${_currency.format(payslip.advanceTotal)}',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Mini extends StatelessWidget {
  final String label;
  final String value;
  const _Mini(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final tx = context.text;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: tx.label.copyWith(color: Colors.white60)),
          Text(
            value,
            style: tx.body.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _LinesCard extends StatelessWidget {
  final Payslip payslip;
  const _LinesCard({required this.payslip});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final rows = <Widget>[
      _line(context, 'Taban maaş', _currency.format(payslip.salaryBase), null),
      for (final b in payslip.bonuses)
        _line(
          context,
          b.label,
          '+${_currency.format(b.amount)}',
          b.date,
          color: cs.success600,
        ),
      for (final a in payslip.advances)
        _line(
          context,
          a.label,
          '−${_currency.format(a.amount)}',
          a.date,
          color: cs.danger600,
        ),
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            rows[i],
            if (i < rows.length - 1)
              Divider(height: 1, color: cs.borderDefault),
          ],
          Divider(height: 1, color: cs.borderDefault),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Net',
                  style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  _currency.format(payslip.net),
                  style: tx.subtitle.copyWith(fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _line(
    BuildContext context,
    String label,
    String value,
    String? date, {
    Color? color,
  }) {
    final cs = context.colors;
    final tx = context.text;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              date != null
                  ? '$label · ${_dateFormat.format(DateTime.parse(date))}'
                  : label,
              style: tx.bodySmall,
            ),
          ),
          Text(
            value,
            style: tx.bodySmall.copyWith(
              fontWeight: FontWeight.w700,
              color: color ?? cs.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
