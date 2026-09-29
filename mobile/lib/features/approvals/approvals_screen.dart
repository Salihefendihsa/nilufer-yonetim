import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/advance.dart';
import '../../models/appointment_request.dart';
import '../../models/contract.dart';
import '../../models/job.dart';
import '../../models/leave_request.dart';
import '../../models/quote.dart';
import '../../models/user.dart';
import '../../navigation/manager_nav.dart';
import '../appointment_requests/appointment_requests_api.dart';
import '../jobs/job_detail_screen.dart';
import '../jobs/job_form_screen.dart';
import '../search/search_action.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../staff/leave_balance_card.dart';
import '../staff/staff_detail_screen.dart';
import '../../widgets/chip_bar.dart';
import '../../widgets/accent_card.dart';
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
/// sözleşmeler. OWNER/MANAGER tam kuyruk; TEAM_LEAD yalnızca izin
/// talepleri + saha raporu kuyruğunu görür (web ile aynı: teklif/avans/
/// sözleşme uçları TEAM_LEAD'e kapalı, hiç çağrılmaz).
class ApprovalsScreen extends StatefulWidget {
  /// Panel kartlarından açılırken seçili gelecek segment ('reports',
  /// 'advances', 'quotes' …); null = Tümü.
  final String? initialFilter;

  const ApprovalsScreen({super.key, this.initialFilter});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  final _api = ApprovalsApi();
  final _appointmentApi = AppointmentRequestsApi();
  List<QuoteRequest> _quotes = [];
  List<AdvanceRequest> _advances = [];
  List<Contract> _expiring = [];
  List<Job> _reportJobs = [];
  List<LeaveRequest> _leaveRequests = [];
  List<AppointmentRequest> _appointmentRequests = [];
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
    _filter = widget.initialFilter;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final isTeamLead =
        context.read<AuthProvider>().user?.role == AppRole.teamLead;
    final myUserId = context.read<AuthProvider>().user?.id;
    final results = await Future.wait<Object?>([
      isTeamLead
          ? Future.value(<QuoteRequest>[])
          : _api.newQuotes().catchError((_) => <QuoteRequest>[]),
      isTeamLead
          ? Future.value(<AdvanceRequest>[])
          : _api.pendingAdvances().catchError((_) => <AdvanceRequest>[]),
      isTeamLead
          ? Future.value(<Contract>[])
          : _api.expiringContracts().catchError((_) => <Contract>[]),
      _api.pendingReportJobs().catchError((_) => <Job>[]),
      _api.pendingLeaveRequests().catchError((_) => <LeaveRequest>[]),
      // Bölüm J: müşteri randevu taleplerini web'deki bekleyen-onaylar
      // sayfasıyla aynı yerden planlar/reddeder — TEAM_LEAD'e kapalı (backend).
      isTeamLead
          ? Future.value(<AppointmentRequest>[])
          : _appointmentApi
                .list(status: 'PENDING')
                .catchError((_) => <AppointmentRequest>[]),
    ]);
    if (!mounted) return;
    setState(() {
      _quotes = results[0] as List<QuoteRequest>;
      _advances = results[1] as List<AdvanceRequest>;
      _expiring = results[2] as List<Contract>;
      _reportJobs = results[3] as List<Job>;
      // Şef kendi izin talebini karara bağlayamaz (backend 403) — kuyrukta gösterilmez.
      _leaveRequests = (results[4] as List<LeaveRequest>)
          .where((l) => myUserId == null || l.staffUserId != myUserId)
          .toList();
      _appointmentRequests = results[5] as List<AppointmentRequest>;
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
          SnackBar(
            content: Text(e is ApiException ? e.message : 'İşlem başarısız'),
          ),
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
            content: Text(e is ApiException ? e.message : 'Güncellenemedi'),
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

  Future<void> _scheduleAppointment(AppointmentRequest r) async {
    final job = await Navigator.of(context).push<Job>(
      MaterialPageRoute(
        builder: (_) => JobFormScreen(
          prefillCustomerId: r.customerId,
          prefillServiceType: r.serviceTypeName,
        ),
      ),
    );
    if (job == null || !mounted) return;
    setState(() => _busyId = r.id);
    try {
      await _appointmentApi.schedule(r.id, job.id);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Planlanamadı'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _declineAppointment(AppointmentRequest r) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Randevu talebini reddet'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 2,
          decoration: const InputDecoration(labelText: 'Red gerekçesi'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Reddet'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty || !mounted) return;
    setState(() => _busyId = r.id);
    try {
      await _appointmentApi.decline(r.id, reason);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'İşlem başarısız'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  int get _total =>
      _quotes.length +
      _advances.length +
      _expiring.length +
      _reportJobs.length +
      _leaveRequests.length +
      _appointmentRequests.length;

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    return Scaffold(
      appBar: AppBar(
        leading: ManagerNav.maybeLeading(context),
        title: Text('Bekleyen Onaylar${_total > 0 ? ' ($_total)' : ''}'),
        actions: const [SearchAction()],
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
                    'appointments': _appointmentRequests.length,
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
                    color: cs.accentSoft,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_appointmentRequests.isNotEmpty &&
                            (_filter == null || _filter == 'appointments')) ...[
                          _SectionTitle(
                            'Randevu Talepleri (${_appointmentRequests.length})',
                          ),
                          ..._appointmentRequests.map(
                            (r) => _AppointmentCard(
                              request: r,
                              busy: _busyId == r.id,
                              onSchedule: () => _scheduleAppointment(r),
                              onDecline: () => _declineAppointment(r),
                            ),
                          ),
                        ],
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
                            !(_filter == 'leaves' &&
                                _leaveRequests.isNotEmpty) &&
                            !(_filter == 'appointments' &&
                                _appointmentRequests.isNotEmpty))
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
    'appointments': 'Randevular',
    'reports': 'Raporlar',
    'quotes': 'Teklifler',
    'advances': 'Avanslar',
    'contracts': 'Sözleşmeler',
    'leaves': 'İzinler',
  };

  @override
  Widget build(BuildContext context) {
    return ChipBar(
      spacing: 0,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      children: [
        _Chip(
          label: 'Tümü',
          selected: value == null,
          onTap: () => onChanged(null),
        ),
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
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Material(
      color: selected ? cs.primary600 : cs.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(
              color: selected ? cs.primary600 : cs.borderDefault,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: tx.bodySmall.copyWith(
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : cs.textSecondary,
            ),
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
      style: context.text.body.copyWith(
        fontWeight: FontWeight.w700,
        color: context.colors.textSecondary,
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
    final cs = context.colors;
    final tx = context.text;
    // Önceden Border(left: renkli, diğerleri gri) + borderRadius kullanılıyordu:
    // Flutter paint() assertion'ı ("borderRadius can only be given on borders
    // with uniform colors") yüzünden kartın içi hiç çizilmiyor, 14 kartın
    // hepsi boş kutu görünüyordu. AccentCard bu sorunun çözümüdür.
    final doneAt = job.completedAt ?? job.scheduledAt;
    return AccentCard(
      accentColor: cs.neutral600,
      // Kart → iş detayı (raporu, fotoğrafları incelemek için).
      onTap: () => Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => JobDetailScreen(jobId: job.id))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            job.customerName ?? 'Müşteri',
            style: tx.body.copyWith(fontWeight: FontWeight.w700),
          ),
          Text(
            '${job.serviceType} · ${job.assignedStaffName ?? 'Personel'}',
            style: tx.caption,
          ),
          if (doneAt != null)
            Text(
              'Tamamlandı: ${_dateFormat.format(doneAt.toLocal())}',
              style: tx.caption.copyWith(color: cs.textFaint),
            ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: busy ? null : onApprove,
              style: ElevatedButton.styleFrom(backgroundColor: cs.success600),
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
    final cs = context.colors;
    final tx = context.text;
    return AccentCard(
      accentColor: cs.info500,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            quote.fullName,
            style: tx.body.copyWith(fontWeight: FontWeight.w700),
          ),
          Text('${quote.serviceType} · ${quote.phone}', style: tx.caption),
          if (quote.amount != null)
            Text(
              _currency.format(quote.amount),
              style: tx.bodySmall.copyWith(
                fontWeight: FontWeight.w700,
                color: cs.accent,
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
    final cs = context.colors;
    final tx = context.text;
    return AccentCard(
      accentColor: cs.warning500,
      // Kart → personelin avans geçmişi / güvenilirlik özeti.
      onTap: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => _AdvanceHistorySheet(advance: advance),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                advance.staffName ?? 'Personel',
                style: tx.body.copyWith(fontWeight: FontWeight.w700),
              ),
              Text(
                _currency.format(advance.amount),
                style: tx.body.copyWith(
                  fontWeight: FontWeight.w700,
                  color: cs.warning600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(advance.reason, style: tx.caption),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onReject,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: cs.danger600,
                  ),
                  child: const Text('Reddet'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: busy ? null : onApprove,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: cs.success600,
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
    final cs = context.colors;
    final tx = context.text;
    return AccentCard(
      accentColor: cs.danger500,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  contract.customerName ?? 'Müşteri',
                  style: tx.body.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  'Bitiş: ${_dateFormat.format(DateTime.parse(contract.endDate))}',
                  style: tx.caption,
                ),
              ],
            ),
          ),
          if (contract.amount != null)
            Text(
              _currency.format(contract.amount),
              style: tx.body.copyWith(
                fontWeight: FontWeight.w700,
                color: cs.danger600,
              ),
            ),
        ],
      ),
    );
  }
}

/// Bölüm J: müşterinin kendi hesabından açtığı randevu talebi — "Planla"
/// var olan bir işe bağlamak için önce Yeni İş formunu açar (bkz.
/// _scheduleAppointment), "Reddet" gerekçe ister.
class _AppointmentCard extends StatelessWidget {
  final AppointmentRequest request;
  final bool busy;
  final VoidCallback onSchedule;
  final VoidCallback onDecline;
  const _AppointmentCard({
    required this.request,
    required this.busy,
    required this.onSchedule,
    required this.onDecline,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return AccentCard(
      accentColor: cs.primary500,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            request.customerName ?? 'Müşteri',
            style: tx.body.copyWith(fontWeight: FontWeight.w700),
          ),
          Text(
            '${request.serviceTypeName ?? 'Hizmet belirtilmemiş'}'
            '${request.customerPhone != null ? ' · ${request.customerPhone}' : ''}',
            style: tx.caption,
          ),
          Text(
            'Tercih edilen: '
            '${_dateFormat.format(DateTime.parse(request.preferredDateStart))} – '
            '${_dateFormat.format(DateTime.parse(request.preferredDateEnd))}',
            style: tx.caption,
          ),
          if (request.note != null && request.note!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(request.note!, style: tx.caption),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onDecline,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: cs.danger600,
                  ),
                  child: const Text('Reddet'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: busy ? null : onSchedule,
                  child: Text(busy ? 'İşleniyor...' : 'Planla'),
                ),
              ),
            ],
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
    final cs = context.colors;
    final tx = context.text;
    return AccentCard(
      accentColor: cs.danger500,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            leave.staffName ?? 'Personel',
            style: tx.body.copyWith(fontWeight: FontWeight.w700),
          ),
          Text(
            '${_dateFormat.format(DateTime.parse(leave.startDate))} – '
            '${_dateFormat.format(DateTime.parse(leave.endDate))} · ${leave.reason}'
            '${leave.requestedDays != null ? ' · ${leave.requestedDays} gün' : ''}',
            style: tx.caption,
          ),
          // Bölüm AH (8. tur): bakiye aşımı uyarısı — onayı engellemez.
          if (leave.exceedsBalance)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: LeaveBalanceExceedBadge(
                remainingDays: leave.remainingDays,
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onReject,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: cs.danger600,
                  ),
                  child: const Text('Reddet'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: busy ? null : onApprove,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: cs.success600,
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

/// Avans kartına basınca: talep sahibinin avans geçmişi ve basit bir
/// güvenilirlik özeti (onaylanan/reddedilen sayısı, onaylı toplam) + mevcut
/// personel profiline geçiş. Ayrı bir ekran icat edilmedi; veri
/// GET /advances?staffId= ile gelir.
class _AdvanceHistorySheet extends StatefulWidget {
  final AdvanceRequest advance;
  const _AdvanceHistorySheet({required this.advance});

  @override
  State<_AdvanceHistorySheet> createState() => _AdvanceHistorySheetState();
}

class _AdvanceHistorySheetState extends State<_AdvanceHistorySheet> {
  late final Future<List<AdvanceRequest>> _future = ApprovalsApi()
      .advancesForStaff(widget.advance.staffId);

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.75,
        ),
        child: FutureBuilder<List<AdvanceRequest>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const SizedBox(height: 200, child: LoadingView());
            }
            if (snap.hasError) {
              return Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  snap.error is ApiException
                      ? (snap.error as ApiException).message
                      : 'Avans geçmişi yüklenemedi',
                ),
              );
            }
            final all = snap.data ?? const <AdvanceRequest>[];
            final approved = all.where((a) => a.status == 'APPROVED').toList();
            final rejected = all.where((a) => a.status == 'REJECTED').length;
            final approvedTotal = approved.fold<double>(
              0,
              (sum, a) => sum + a.amount,
            );
            return ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              children: [
                Text(
                  widget.advance.staffName ?? 'Personel',
                  style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text('Avans geçmişi · ${all.length} talep', style: tx.caption),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _MiniStat(
                      label: 'Onaylanan',
                      value: '${approved.length}',
                      color: cs.success600,
                    ),
                    const SizedBox(width: 8),
                    _MiniStat(
                      label: 'Reddedilen',
                      value: '$rejected',
                      color: cs.danger600,
                    ),
                    const SizedBox(width: 8),
                    _MiniStat(
                      label: 'Onaylı toplam',
                      value: _currency.format(approvedTotal),
                      color: cs.textPrimary,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                for (final a in all)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(
                      '${_currency.format(a.amount)} · ${a.reason}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      _dateFormat.format(DateTime.parse(a.createdAt).toLocal()),
                    ),
                    trailing: Text(
                      advanceStatusLabelTr(a.status),
                      style: tx.label.copyWith(
                        color: switch (a.status) {
                          'APPROVED' => cs.success600,
                          'REJECTED' => cs.danger600,
                          _ => cs.warning600,
                        },
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () {
                    final nav = Navigator.of(context);
                    nav.pop();
                    nav.push(
                      MaterialPageRoute(
                        builder: (_) =>
                            StaffDetailScreen(staffId: widget.advance.staffId),
                      ),
                    );
                  },
                  icon: const Icon(Icons.person_outline_rounded),
                  label: const Text('Personel Profili'),
                ),
              ],
            );
          },
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
    final cs = context.colors;
    final tx = context.text;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: cs.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.chip),
          border: Border.all(color: cs.borderDefault),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: tx.body.copyWith(
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
            ),
            Text(label, style: tx.caption, maxLines: 1),
          ],
        ),
      ),
    );
  }
}
