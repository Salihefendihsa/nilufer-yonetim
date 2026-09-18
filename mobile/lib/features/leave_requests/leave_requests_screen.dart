import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/leave_request.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../staff/leave_balance_card.dart';
import '../../widgets/state_views.dart';
import 'leave_requests_api.dart';

final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');

const _statusLabels = {'PENDING': 'Bekliyor', 'APPROVED': 'Onaylandı', 'REJECTED': 'Reddedildi'};
const _statusColors = {
  'PENDING': AppColors.warning600,
  'APPROVED': AppColors.primary700,
  'REJECTED': AppColors.danger500,
};

/// web/src/app/(dashboard)/izinlerim/page.tsx ile aynı akış — STAFF/TEAM_LEAD
/// kendi izin taleplerini oluşturur/görür. TEAM_LEAD için ayrıca ekibinin
/// bekleyen taleplerini onaylayabileceği ikinci bir bölüm eklenir (web'de
/// bu, ayrı bir sayfa olan Bekleyen Onaylar'da — mobilde TEAM_LEAD'in
/// Onaylar ekranına erişimi olmadığı için burada birleştirildi).
class LeaveRequestsScreen extends StatefulWidget {
  const LeaveRequestsScreen({super.key});

  @override
  State<LeaveRequestsScreen> createState() => _LeaveRequestsScreenState();
}

class _LeaveRequestsScreenState extends State<LeaveRequestsScreen> {
  final _api = LeaveRequestsApi();
  List<LeaveRequest> _mine = [];
  List<LeaveRequest> _teamPending = [];
  bool _loading = true;
  String? _error;
  String? _busyId;

  bool get _isTeamLead =>
      context.read<AuthProvider>().user?.role == AppRole.teamLead;

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
      final mine = await _api.list(mine: true);
      List<LeaveRequest> team = [];
      if (_isTeamLead) {
        final myStaffId = mine.isNotEmpty ? mine.first.staffId : null;
        final all = await _api.list();
        team = all.where((l) => l.status == 'PENDING' && l.staffId != myStaffId).toList();
      }
      setState(() {
        _mine = mine;
        _teamPending = team;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'İzin talepleri yüklenemedi',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _decide(LeaveRequest leave, String status) async {
    setState(() => _busyId = leave.id);
    try {
      await _api.decide(leave.id, status);
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

  Future<void> _openCreateForm() async {
    DateTime? startDate;
    DateTime? endDate;
    final reasonController = TextEditingController();

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Yeni İzin Talebi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: DateTime.now(),
                          firstDate: DateTime.now(),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) setSheetState(() => startDate = picked);
                      },
                      child: Text(startDate == null ? 'Başlangıç' : _dateFormat.format(startDate!)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: startDate ?? DateTime.now(),
                          firstDate: startDate ?? DateTime.now(),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) setSheetState(() => endDate = picked);
                      },
                      child: Text(endDate == null ? 'Bitiş' : _dateFormat.format(endDate!)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(labelText: 'Gerekçe'),
                minLines: 2,
                maxLines: 4,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  if (startDate == null || endDate == null || reasonController.text.trim().isEmpty) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      const SnackBar(content: Text('Tüm alanlar zorunludur')),
                    );
                    return;
                  }
                  try {
                    await _api.create(
                      startDate: startDate!,
                      endDate: endDate!,
                      reason: reasonController.text.trim(),
                    );
                    if (ctx.mounted) Navigator.of(ctx).pop(true);
                  } catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        SnackBar(content: Text(e is ApiException ? e.message : 'Talep oluşturulamadı')),
                      );
                    }
                  }
                },
                child: const Text('Talebi Gönder'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('İzin Taleplerim'),
        actions: [
          IconButton(icon: const Icon(Icons.add_rounded), onPressed: _openCreateForm),
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
                  if (_teamPending.isNotEmpty) ...[
                    const Text(
                      'Ekibimin Bekleyen Talepleri',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                    ),
                    const SizedBox(height: 8),
                    for (final leave in _teamPending) _TeamLeaveCard(
                      leave: leave,
                      busy: _busyId == leave.id,
                      onApprove: () => _decide(leave, 'APPROVED'),
                      onReject: () => _decide(leave, 'REJECTED'),
                    ),
                    const SizedBox(height: 20),
                  ],
                  const Text(
                    'Taleplerim',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                  ),
                  const SizedBox(height: 8),
                  if (_mine.isEmpty)
                    const EmptyStateView(
                      title: 'Henüz izin talebiniz yok',
                      icon: Icons.event_busy_outlined,
                    )
                  else
                    for (final leave in _mine) _MyLeaveCard(leave: leave),
                ],
              ),
            ),
    );
  }
}

class _MyLeaveCard extends StatelessWidget {
  final LeaveRequest leave;
  const _MyLeaveCard({required this.leave});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_dateFormat.format(DateTime.parse(leave.startDate))} – ${_dateFormat.format(DateTime.parse(leave.endDate))}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: (_statusColors[leave.status] ?? AppColors.textFaint).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  _statusLabels[leave.status] ?? leave.status,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: _statusColors[leave.status],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(leave.reason, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
          if (leave.decisionNote != null) ...[
            const SizedBox(height: 4),
            Text('Not: ${leave.decisionNote}', style: const TextStyle(fontSize: 11.5, color: AppColors.textFaint)),
          ],
        ],
      ),
    );
  }
}

class _TeamLeaveCard extends StatelessWidget {
  final LeaveRequest leave;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  const _TeamLeaveCard({
    required this.leave,
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
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: const Border(
          left: BorderSide(color: AppColors.danger500, width: 4),
          top: BorderSide(color: AppColors.borderDefault),
          right: BorderSide(color: AppColors.borderDefault),
          bottom: BorderSide(color: AppColors.borderDefault),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(leave.staffName ?? 'Personel', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
          Text(
            '${_dateFormat.format(DateTime.parse(leave.startDate))} – ${_dateFormat.format(DateTime.parse(leave.endDate))} · ${leave.reason}'
            '${leave.requestedDays != null ? ' · ${leave.requestedDays} gün' : ''}',
            style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
          ),
          // Bölüm AH (8. tur): bakiye aşımı uyarısı — onayı engellemez.
          if (leave.exceedsBalance)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: LeaveBalanceExceedBadge(remainingDays: leave.remainingDays),
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
