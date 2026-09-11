import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/evaluation.dart';
import '../../models/staff.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import '../staff/staff_api.dart';
import 'evaluations_api.dart';
import 'evaluation_form_sheet.dart';

final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');

const _statusLabels = {
  'DRAFT': 'Taslak',
  'SUBMITTED': 'Gönderildi',
  'LOCKED': 'Kilitli',
};

/// web/src/app/(dashboard)/performans/EvaluationsTab.tsx ile aynı akış —
/// mevcut basit Performans ekranından (tamamlanan iş + müşteri puanı) ayrı,
/// bağımsız bir bölüm. OWNER/MANAGER değerlendirme yapar; STAFF/TEAM_LEAD
/// yalnızca kendi aldıklarını (salt okunur, değerlendiren gizli) görür.
class EvaluationsScreen extends StatefulWidget {
  const EvaluationsScreen({super.key});

  @override
  State<EvaluationsScreen> createState() => _EvaluationsScreenState();
}

class _EvaluationsScreenState extends State<EvaluationsScreen> {
  final _api = EvaluationsApi();
  final _staffApi = StaffApi();

  bool get _canManage {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner || role == AppRole.manager;
  }

  bool get _isOwner =>
      context.read<AuthProvider>().user?.role == AppRole.owner;

  List<EvaluationPeriod> _periods = [];
  EvaluationPeriod? _selectedPeriod;
  List<EvaluationCriterion> _criteria = [];
  List<Staff> _staff = [];
  List<Evaluation> _evaluations = [];
  List<StaffBonus> _pendingBonuses = [];
  String? _bonusBusyId;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final periods = await _api.listPeriods();
      final criteria = await _api.listCriteria();
      List<Staff> staff = [];
      if (_canManage) {
        final page = await _staffApi.list();
        staff = page.data;
      }
      List<StaffBonus> pendingBonuses = [];
      if (_canManage) {
        pendingBonuses = await _api.listPendingStaffBonuses().catchError(
          (_) => <StaffBonus>[],
        );
      }
      setState(() {
        _periods = periods;
        _criteria = criteria.where((c) => c.isActive).toList();
        _staff = staff;
        _pendingBonuses = pendingBonuses;
        _selectedPeriod ??= periods.isNotEmpty ? periods.first : null;
      });
      await _loadEvaluations();
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Değerlendirmeler yüklenemedi',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadEvaluations() async {
    // STAFF/TEAM_LEAD kendi görünümünde dönem seçici yok — tüm dönemlerdeki
    // (backend zaten yalnızca kendi kaydına indirgiyor) geçmişini gösterir.
    if (_canManage && _selectedPeriod == null) {
      setState(() => _evaluations = []);
      return;
    }
    try {
      final result = await _api.listEvaluations(
        periodId: _canManage ? _selectedPeriod!.id : null,
      );
      setState(() => _evaluations = result);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Değerlendirmeler yüklenemedi'),
          ),
        );
      }
    }
  }

  Future<void> _createPeriod() async {
    final labelController = TextEditingController();
    final bonusThresholdController = TextEditingController();
    final bonusAmountController = TextEditingController();
    DateTime? start;
    DateTime? end;
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
              const Text(
                'Yeni Değerlendirme Dönemi',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: labelController,
                decoration: const InputDecoration(labelText: 'Dönem Adı'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) setSheetState(() => start = picked);
                      },
                      child: Text(start == null ? 'Başlangıç' : _dateFormat.format(start!)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) setSheetState(() => end = picked);
                      },
                      child: Text(end == null ? 'Bitiş' : _dateFormat.format(end!)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: bonusThresholdController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Prim Eşiği (opsiyonel, 1-20)',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: bonusAmountController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Prim Tutarı (₺)',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  if (labelController.text.trim().isEmpty || start == null || end == null) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      const SnackBar(content: Text('Tüm alanlar zorunludur')),
                    );
                    return;
                  }
                  try {
                    await _api.createPeriod(
                      label: labelController.text.trim(),
                      startDate: start!,
                      endDate: end!,
                      bonusThreshold: int.tryParse(
                        bonusThresholdController.text.trim(),
                      ),
                      bonusAmount: double.tryParse(
                        bonusAmountController.text.trim(),
                      ),
                    );
                    if (ctx.mounted) Navigator.of(ctx).pop(true);
                  } catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        SnackBar(
                          content: Text(e is ApiException ? e.message : 'Dönem oluşturulamadı'),
                        ),
                      );
                    }
                  }
                },
                child: const Text('Oluştur'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
    if (created == true) _loadAll();
  }

  Future<void> _lockPeriod() async {
    if (_selectedPeriod == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Dönemi Kilitle'),
        content: Text(
          '"${_selectedPeriod!.label}" dönemini kilitlemek istediğinize emin misiniz? '
          'Bu dönemdeki TÜM değerlendirmeler kilitlenecek ve düzenlenemez hale gelecek.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Kilitle'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.lockPeriod(_selectedPeriod!.id);
      await _loadAll();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Dönem kilitlenemedi')),
        );
      }
    }
  }

  Evaluation? _myEvaluationFor(String staffId) {
    final myId = context.read<AuthProvider>().user?.id;
    for (final e in _evaluations) {
      if (e.targetStaffId == staffId && e.evaluatorUserId == myId) return e;
    }
    return null;
  }

  Future<void> _openEvaluate(Staff staff) async {
    final existing = _myEvaluationFor(staff.id);
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => EvaluationFormSheet(
        staff: staff,
        periodId: _selectedPeriod!.id,
        criteria: _criteria,
        existing: existing,
      ),
    );
    if (saved == true) _loadEvaluations();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Değerlendirmeler')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _loadAll)
          : _canManage
          ? _buildManagerView()
          : _buildSelfView(),
    );
  }

  Future<void> _decideBonus(StaffBonus bonus, bool approve) async {
    setState(() => _bonusBusyId = bonus.id);
    try {
      if (approve) {
        await _api.approveStaffBonus(bonus.id);
      } else {
        await _api.rejectStaffBonus(bonus.id);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(approve ? 'Prim onaylandı.' : 'Prim reddedildi.')),
        );
      }
      final pending = await _api.listPendingStaffBonuses();
      if (mounted) setState(() => _pendingBonuses = pending);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'İşlem tamamlanamadı')),
        );
      }
    } finally {
      if (mounted) setState(() => _bonusBusyId = null);
    }
  }

  /// Bölüm C (2. tur): dönem kilitlenirken bonusThreshold/bonusAmount
  /// tanımlıysa otomatik oluşan onay bekleyen prim önerileri — para OTOMATİK
  /// ÖDENMEZ, onaylanınca backend'de bir Expense(BONUS) kaydı oluşur.
  Widget _buildPendingBonusesSection() {
    if (_pendingBonuses.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.warning50,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.warning500.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.card_giftcard_rounded, size: 16, color: AppColors.warning600),
              const SizedBox(width: 6),
              const Text(
                'Bekleyen Primler',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.warning50,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${_pendingBonuses.length}',
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.warning600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final b in _pendingBonuses)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            b.staffFullName ?? 'Personel',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                          ),
                          Text(
                            '${b.evaluationPeriodLabel ?? "Dönem"} · ${b.amount.toStringAsFixed(0)} ₺',
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    if (_bonusBusyId == b.id)
                      const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else ...[
                      IconButton(
                        icon: const Icon(Icons.check_circle_outline, color: AppColors.primary600, size: 20),
                        onPressed: () => _decideBonus(b, true),
                        tooltip: 'Onayla',
                      ),
                      IconButton(
                        icon: const Icon(Icons.cancel_outlined, color: AppColors.danger500, size: 20),
                        onPressed: () => _decideBonus(b, false),
                        tooltip: 'Reddet',
                      ),
                    ],
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildManagerView() {
    return Column(
      children: [
        _buildPendingBonusesSection(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _selectedPeriod?.id,
                  decoration: const InputDecoration(isDense: true, labelText: 'Dönem'),
                  items: _periods
                      .map(
                        (p) => DropdownMenuItem(
                          value: p.id,
                          child: Text(p.label + (p.isLocked ? ' (Kilitli)' : '')),
                        ),
                      )
                      .toList(),
                  onChanged: (id) {
                    setState(
                      () => _selectedPeriod = _periods.firstWhere((p) => p.id == id),
                    );
                    _loadEvaluations();
                  },
                ),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline),
                tooltip: 'Yeni Dönem',
                onPressed: _createPeriod,
              ),
              if (_isOwner && _selectedPeriod != null && !_selectedPeriod!.isLocked)
                IconButton(
                  icon: const Icon(Icons.lock_outline, color: AppColors.warning500),
                  tooltip: 'Dönemi Kilitle',
                  onPressed: _lockPeriod,
                ),
            ],
          ),
        ),
        Expanded(
          child: _selectedPeriod == null
              ? const EmptyStateView(
                  title: 'Önce bir dönem oluşturun',
                  icon: Icons.event_note_outlined,
                )
              : RefreshIndicator(
                  onRefresh: _loadEvaluations,
                  color: AppColors.primary600,
                  child: ListView.separated(
                    itemCount: _staff.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final s = _staff[i];
                      final mine = _myEvaluationFor(s.id);
                      return ListTile(
                        title: Text(s.fullName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                        subtitle: Text(s.position, style: const TextStyle(fontSize: 12)),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (mine != null) ...[
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceMuted,
                                  borderRadius: BorderRadius.circular(AppRadius.pill),
                                ),
                                child: Text(
                                  _statusLabels[mine.status] ?? mine.status,
                                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            TextButton(
                              onPressed: _selectedPeriod!.isLocked ? null : () => _openEvaluate(s),
                              child: Text(
                                mine == null
                                    ? 'Değerlendir'
                                    : (mine.status == 'DRAFT' ? 'Düzenle' : 'Görüntüle'),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildSelfView() {
    if (_evaluations.isEmpty) {
      return const EmptyStateView(
        title: 'Henüz değerlendirme yok',
        subtitle: 'Bu dönem için henüz bir değerlendirme oluşturulmamış.',
        icon: Icons.star_border_rounded,
      );
    }
    return RefreshIndicator(
      onRefresh: _loadEvaluations,
      color: AppColors.primary600,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _evaluations.length,
        itemBuilder: (context, i) {
          final e = _evaluations[i];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceMuted,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text(
                          _statusLabels[e.status] ?? e.status,
                          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                      Text(
                        _dateFormat.format(DateTime.parse(e.createdAt)),
                        style: const TextStyle(fontSize: 11, color: AppColors.textFaint),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 16,
                    children: [
                      if (e.averageScore != null)
                        Text(
                          'Ortalama: ${e.averageScore}/20',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      if (e.managerScore != null)
                        Text(
                          'Genel Puan: ${e.managerScore}/20',
                          style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                        ),
                    ],
                  ),
                  if (e.comment != null && e.comment!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(e.comment!, style: const TextStyle(fontSize: 12.5)),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
