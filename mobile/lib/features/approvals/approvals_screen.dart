import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/advance.dart';
import '../../models/contract.dart';
import '../../models/job.dart';
import '../../models/leave_request.dart';
import '../../models/quote.dart';
import '../../navigation/manager_nav.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'approvals_api.dart';

final _currency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);
final _dateFormat = DateFormat('d MMM', 'tr_TR');

/// Solda renkli bir şerit + tekdüze gri kenarlıklı kart kabuğu. BoxDecoration'da
/// farklı renkli kenarlarla (Border(left: renkli, top/right/bottom: gri)
/// borderRadius birlikte kullanılamaz — Flutter bunu paint() sırasında bir
/// assertion ile reddediyor ve kartın TÜM içeriği (metin dahil) hiç
/// çizilmeden boş kalıyordu (gerçek cihazda görsel doğrulama sırasında
/// bulundu). Renkli şerit burada ayrı bir Container ile çiziliyor.
class _AccentCard extends StatelessWidget {
  final Color accentColor;
  final Widget child;
  const _AccentCard({required this.accentColor, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 4, color: accentColor),
            Expanded(
              child: Padding(padding: const EdgeInsets.all(12), child: child),
            ),
          ],
        ),
      ),
    );
  }
}

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
  List<LeaveRequest> _leaveRequests = [];
  bool _loading = true;
  String? _error;
  String? _busyId;
  // null = Tümü. Web'deki bekleyen-onaylar sayfası zaten 4 kaynağı birleşik
  // gösteriyor; mobilde bu segment filtresi eksikti (bkz.
  // docs/STITCH_FEATURE_MATRIX.md) — yalnızca istemci tarafında, zaten
  // çekilen listeleri filtreler, ek bir API çağrısı gerekmiyor.
  String? _filter;

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
      _api.pendingLeaveRequests().catchError((_) => <LeaveRequest>[]),
    ]);
    if (!mounted) return;
    setState(() {
      _quotes = results[0] as List<QuoteRequest>;
      _advances = results[1] as List<AdvanceRequest>;
      _expiring = results[2] as List<Contract>;
      _reportJobs = results[3] as List<Job>;
      _leaveRequests = results[4] as List<LeaveRequest>;
      _loading = false;
    });
  }

  Future<void> _decideLeave(LeaveRequest leave, String status) async {
    setState(() => _busyId = leave.id);
    try {
      await _api.decideLeaveRequest(leave.id, status);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'İşlem başarısız')),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
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

  Future<void> _markQuoteContacted(QuoteRequest q) async {
    setState(() => _busyId = q.id);
    try {
      await _api.updateQuoteStatus(q.id, 'CONTACTED');
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Güncellenemedi',
            ),
          ),
        );
      }
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
      _quotes.length + _advances.length + _expiring.length + _reportJobs.length + _leaveRequests.length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(
        leading: ManagerNav.maybeLeading(context),
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
          : Column(
              children: [
                _FilterChips(
                  value: _filter,
                  counts: {
                    'reports': _reportJobs.length,
                    'quotes': _quotes.length,
                    'advances': _advances.length,
                    'contracts': _expiring.length,
                    'leaves': _leaveRequests.length,
                  },
                  onChanged: (v) => setState(() => _filter = v),
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    color: AppColors.primary600,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_leaveRequests.isNotEmpty &&
                            (_filter == null || _filter == 'leaves')) ...[
                          _SectionTitle(
                            'İzin Talepleri (${_leaveRequests.length})',
                          ),
                          ..._leaveRequests.map(
                            (l) => _LeaveCard(
                              leave: l,
                              busy: _busyId == l.id,
                              onApprove: () => _decideLeave(l, 'APPROVED'),
                              onReject: () => _decideLeave(l, 'REJECTED'),
                            ),
                          ),
                        ],
                        if (_reportJobs.isNotEmpty &&
                            (_filter == null || _filter == 'reports')) ...[
                          _SectionTitle(
                            'Saha Raporu Onayı (${_reportJobs.length})',
                          ),
                          ..._reportJobs.map(
                            (j) => _ReportCard(
                              job: j,
                              busy: _busyId == j.id,
                              onApprove: () => _approveReport(j),
                            ),
                          ),
                        ],
                        if (_quotes.isNotEmpty &&
                            (_filter == null || _filter == 'quotes')) ...[
                          _SectionTitle('Yeni Teklifler (${_quotes.length})'),
                          ..._quotes.map(
                            (q) => _QuoteCard(
                              quote: q,
                              busy: _busyId == q.id,
                              onContact: () => _markQuoteContacted(q),
                              onConvert: () => _convertQuote(q),
                            ),
                          ),
                        ],
                        if (_advances.isNotEmpty &&
                            (_filter == null || _filter == 'advances')) ...[
                          _SectionTitle(
                            'Avans Talepleri (${_advances.length})',
                          ),
                          ..._advances.map(
                            (a) => _AdvanceCard(
                              advance: a,
                              busy: _busyId == a.id,
                              onApprove: () => _decideAdvance(a, 'APPROVED'),
                              onReject: () => _decideAdvance(a, 'REJECTED'),
                            ),
                          ),
                        ],
                        if (_expiring.isNotEmpty &&
                            (_filter == null || _filter == 'contracts')) ...[
                          _SectionTitle(
                            'Süresi Yaklaşan Sözleşmeler (${_expiring.length})',
                          ),
                          ..._expiring.map(
                            (c) => _ExpiringContractCard(contract: c),
                          ),
                        ],
                        if (_filter != null &&
                            !(_filter == 'reports' && _reportJobs.isNotEmpty) &&
                            !(_filter == 'quotes' && _quotes.isNotEmpty) &&
                            !(_filter == 'advances' && _advances.isNotEmpty) &&
                            !(_filter == 'contracts' && _expiring.isNotEmpty) &&
                            !(_filter == 'leaves' && _leaveRequests.isNotEmpty))
                          const Padding(
                            padding: EdgeInsets.only(top: 40),
                            child: EmptyStateView(
                              title: 'Bu kategoride bekleyen onay yok',
                              icon: Icons.task_alt_rounded,
                            ),
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

/// Web'deki tek listede birleşik gösterime karşılık gelen segment filtresi
/// — yalnızca ekranda zaten yüklü olan 4 listeyi istemci tarafında filtreler.
class _FilterChips extends StatelessWidget {
  final String? value;
  final Map<String, int> counts;
  final ValueChanged<String?> onChanged;

  const _FilterChips({
    required this.value,
    required this.counts,
    required this.onChanged,
  });

  static const _labels = {
    'reports': 'Raporlar',
    'quotes': 'Teklifler',
    'advances': 'Avanslar',
    'contracts': 'Sözleşmeler',
    'leaves': 'İzinler',
  };

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        children: [
          _Chip(label: 'Tümü', selected: value == null, onTap: () => onChanged(null)),
          for (final key in _labels.keys)
            if ((counts[key] ?? 0) > 0)
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: _Chip(
                  label: '${_labels[key]} (${counts[key]})',
                  selected: value == key,
                  onTap: () => onChanged(key),
                ),
              ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _Chip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary600 : AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(
            color: selected ? AppColors.primary600 : AppColors.borderDefault,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.textSecondary,
          ),
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
        borderRadius: BorderRadius.circular(AppRadius.card),
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
  final VoidCallback onContact;
  final VoidCallback onConvert;
  const _QuoteCard({
    required this.quote,
    required this.busy,
    required this.onContact,
    required this.onConvert,
  });

  @override
  Widget build(BuildContext context) {
    return _AccentCard(
      accentColor: AppColors.info500,
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
          Row(
            children: [
              if (quote.status == 'NEW')
                Expanded(
                  child: OutlinedButton(
                    onPressed: busy ? null : onContact,
                    child: const Text('İletişime Geçildi'),
                  ),
                ),
              if (quote.status == 'NEW') const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: busy ? null : onConvert,
                  child: Text(
                    busy ? 'İşleniyor...' : 'Teklife Dönüştür & Onayla',
                  ),
                ),
              ),
            ],
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
    return _AccentCard(
      accentColor: AppColors.warning500,
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
    return _AccentCard(
      accentColor: AppColors.danger500,
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

class _LeaveCard extends StatelessWidget {
  final LeaveRequest leave;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  const _LeaveCard({
    required this.leave,
    required this.busy,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return _AccentCard(
      accentColor: AppColors.danger500,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            leave.staffName ?? 'Personel',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
          ),
          Text(
            '${_dateFormat.format(DateTime.parse(leave.startDate))} – '
            '${_dateFormat.format(DateTime.parse(leave.endDate))} · ${leave.reason}',
            style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onReject,
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger600),
                  child: const Text('Reddet'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: busy ? null : onApprove,
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.success600),
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
