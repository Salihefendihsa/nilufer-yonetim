import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/advance.dart';
import '../../models/contract.dart';
import '../../models/job.dart';
import '../../models/quote.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'approvals_api.dart';

final _currency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);
final _dateFormat = DateFormat('d MMM', 'tr_TR');

/// web/src/app/(dashboard)/bekleyen-onaylar sayfasıyla aynı üç kaynağı
/// birleştirir: yeni teklifler, bekleyen avanslar, süresi yaklaşan
/// sözleşmeler. Yalnızca OWNER/MANAGER (bkz. role_shell.dart).
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  final _api = ApprovalsApi();
  List<QuoteRequest> _quotes = [];
  List<AdvanceRequest> _advances = [];
  List<Contract> _expiring = [];
  List<Job> _reportJobs = [];
  bool _loading = true;
  String? _error;
  String? _busyId;

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
    final results = await Future.wait<Object?>([
      _api.newQuotes().catchError((_) => <QuoteRequest>[]),
      _api.pendingAdvances().catchError((_) => <AdvanceRequest>[]),
      _api.expiringContracts().catchError((_) => <Contract>[]),
      _api.pendingReportJobs().catchError((_) => <Job>[]),
    ]);
    if (!mounted) return;
    setState(() {
      _quotes = results[0] as List<QuoteRequest>;
      _advances = results[1] as List<AdvanceRequest>;
      _expiring = results[2] as List<Contract>;
      _reportJobs = results[3] as List<Job>;
      _loading = false;
    });
  }

  Future<void> _decideAdvance(AdvanceRequest a, String status) async {
    setState(() => _busyId = a.id);
    try {
      await _api.updateAdvanceStatus(a.id, status);
      _load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'İşlem başarısız'),
          ),
        );
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _convertQuote(QuoteRequest q) async {
    setState(() => _busyId = q.id);
    try {
      await _api.convertQuote(q.id);
      _load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Dönüştürülemedi'),
          ),
        );
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _approveReport(Job job) async {
    setState(() => _busyId = job.id);
    try {
      await _api.approveJobReport(job.id);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Onaylanamadı'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  int get _total =>
      _quotes.length + _advances.length + _expiring.length + _reportJobs.length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(
        title: Text('Bekleyen Onaylar${_total > 0 ? ' ($_total)' : ''}'),
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _total == 0
          ? const EmptyStateView(
              title: 'Bekleyen onay yok',
              icon: Icons.task_alt_rounded,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_reportJobs.isNotEmpty) ...[
                    _SectionTitle('Saha Raporu Onayı (${_reportJobs.length})'),
                    ..._reportJobs.map(
                      (j) => _ReportCard(
                        job: j,
                        busy: _busyId == j.id,
                        onApprove: () => _approveReport(j),
                      ),
                    ),
                  ],
                  if (_quotes.isNotEmpty) ...[
                    _SectionTitle('Yeni Teklifler (${_quotes.length})'),
                    ..._quotes.map(
                      (q) => _QuoteCard(
                        quote: q,
                        busy: _busyId == q.id,
                        onConvert: () => _convertQuote(q),
                      ),
                    ),
                  ],
                  if (_advances.isNotEmpty) ...[
                    _SectionTitle('Avans Talepleri (${_advances.length})'),
                    ..._advances.map(
                      (a) => _AdvanceCard(
                        advance: a,
                        busy: _busyId == a.id,
                        onApprove: () => _decideAdvance(a, 'APPROVED'),
                        onReject: () => _decideAdvance(a, 'REJECTED'),
                      ),
                    ),
                  ],
                  if (_expiring.isNotEmpty) ...[
                    _SectionTitle(
                      'Süresi Yaklaşan Sözleşmeler (${_expiring.length})',
                    ),
                    ..._expiring.map((c) => _ExpiringContractCard(contract: c)),
                  ],
                ],
              ),
            ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8, top: 4),
    child: Text(
      text,
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 13.5,
        color: AppColors.textSecondary,
      ),
    ),
  );
}

/// Personelin gönderdiği, müdür onayı bekleyen saha raporu.
class _ReportCard extends StatelessWidget {
  final Job job;
  final bool busy;
  final VoidCallback onApprove;
  const _ReportCard({
    required this.job,
    required this.busy,
    required this.onApprove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: const Border(
          left: BorderSide(color: AppColors.neutral600, width: 4),
          top: BorderSide(color: AppColors.borderDefault),
          right: BorderSide(color: AppColors.borderDefault),
          bottom: BorderSide(color: AppColors.borderDefault),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            job.customerName ?? 'Müşteri',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
          ),
          Text(
            '${job.serviceType} · ${job.assignedStaffName ?? 'Personel'}',
            style: const TextStyle(
              fontSize: 11.5,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: busy ? null : onApprove,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.success600,
              ),
              child: Text(busy ? 'İşleniyor...' : 'Raporu Onayla'),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuoteCard extends StatelessWidget {
  final QuoteRequest quote;
  final bool busy;
  final VoidCallback onConvert;
  const _QuoteCard({
    required this.quote,
    required this.busy,
    required this.onConvert,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border(
          left: BorderSide(color: AppColors.info500, width: 4),
          top: BorderSide(color: AppColors.borderDefault),
          right: BorderSide(color: AppColors.borderDefault),
          bottom: BorderSide(color: AppColors.borderDefault),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            quote.fullName,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
          ),
          Text(
            '${quote.serviceType} · ${quote.phone}',
            style: const TextStyle(
              fontSize: 11.5,
              color: AppColors.textSecondary,
            ),
          ),
          if (quote.amount != null)
            Text(
              _currency.format(quote.amount),
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: AppColors.primary700,
              ),
            ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: busy ? null : onConvert,
              child: Text(busy ? 'İşleniyor...' : 'Teklife Dönüştür & Onayla'),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdvanceCard extends StatelessWidget {
  final AdvanceRequest advance;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  const _AdvanceCard({
    required this.advance,
    required this.busy,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border(
          left: BorderSide(color: AppColors.warning500, width: 4),
          top: BorderSide(color: AppColors.borderDefault),
          right: BorderSide(color: AppColors.borderDefault),
          bottom: BorderSide(color: AppColors.borderDefault),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                advance.staffName ?? 'Personel',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13.5,
                ),
              ),
              Text(
                _currency.format(advance.amount),
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.warning600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            advance.reason,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onReject,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger600,
                  ),
                  child: const Text('Reddet'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: busy ? null : onApprove,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success600,
                  ),
                  child: const Text('Onayla'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ExpiringContractCard extends StatelessWidget {
  final Contract contract;
  const _ExpiringContractCard({required this.contract});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border(
          left: BorderSide(color: AppColors.danger500, width: 4),
          top: BorderSide(color: AppColors.borderDefault),
          right: BorderSide(color: AppColors.borderDefault),
          bottom: BorderSide(color: AppColors.borderDefault),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  contract.customerName ?? 'Müşteri',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                  ),
                ),
                Text(
                  'Bitiş: ${_dateFormat.format(DateTime.parse(contract.endDate))}',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (contract.amount != null)
            Text(
              _currency.format(contract.amount),
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.danger600,
              ),
            ),
        ],
      ),
    );
  }
}
