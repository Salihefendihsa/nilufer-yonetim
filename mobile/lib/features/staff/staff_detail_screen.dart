import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/staff.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'evaluation_trend_card.dart';
import 'leave_balance_card.dart';
import 'onboarding_card.dart';
import 'staff_api.dart';
import 'staff_form_screen.dart';

final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');

class StaffDetailScreen extends StatefulWidget {
  final String staffId;
  const StaffDetailScreen({super.key, required this.staffId});

  @override
  State<StaffDetailScreen> createState() => _StaffDetailScreenState();
}

class _StaffDetailScreenState extends State<StaffDetailScreen> {
  final _api = StaffApi();
  Staff? _staff;
  List<StaffCertification> _certifications = [];
  bool _loading = true;
  String? _error;
  bool _busyStatus = false;

  bool get _isManagement {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner ||
        role == AppRole.manager ||
        role == AppRole.teamLead;
  }

  bool get _isOwner => context.read<AuthProvider>().user?.role == AppRole.owner;

  bool get _isSelf =>
      _staff != null && _staff!.userId == context.read<AuthProvider>().user?.id;

  /// backend/src/routes/staff.ts: PATCH/DELETE /:id ve sertifika CRUD'u
  /// yalnızca OWNER/MANAGER'a açık (TEAM_LEAD durum değiştirebilir ama
  /// düzenleyemez/silemez).
  bool get _canManageStaff {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner || role == AppRole.manager;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    // GET /staff/:id/certifications backend'de yalnızca OWNER/MANAGER'a açık
    // (routes/staff.ts) — diğer roller için çağırmıyoruz ki gereksiz 403
    // hatası kullanıcıya sızmasın (bkz. docs/STITCH_FEATURE_MATRIX.md).
    final role = context.read<AuthProvider>().user?.role;

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final staff = await _api.getById(widget.staffId);
      List<StaffCertification> certs = [];
      if (role == AppRole.owner || role == AppRole.manager) {
        try {
          certs = await _api.listCertifications(widget.staffId);
        } catch (_) {}
      }
      setState(() {
        _staff = staff;
        _certifications = certs;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Personel yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _setStatus(StaffStatus status, {Duration? until}) async {
    setState(() => _busyStatus = true);
    try {
      final updated = await _api.updateStatus(
        widget.staffId,
        status,
        statusUntil: until != null ? DateTime.now().add(until) : null,
      );
      setState(() => _staff = updated);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Durum güncellenemedi',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyStatus = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Personeli sil'),
        content: Text(
          '${_staff?.fullName ?? 'Bu personel'} silinecek. Bu işlem geri alınamaz.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Sil', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.delete(widget.staffId);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Personel silindi.')));
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Silinemedi'),
          ),
        );
      }
    }
  }

  Future<void> _addCertification() async {
    final nameController = TextEditingController();
    DateTime issuedDate = DateTime.now();
    DateTime expiryDate = DateTime.now().add(const Duration(days: 365));

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Yeni Sertifika'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Sertifika adı *'),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Veriliş tarihi'),
                subtitle: Text(_dateFormat.format(issuedDate)),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: issuedDate,
                    firstDate: DateTime(2000),
                    lastDate: DateTime(2100),
                  );
                  if (picked != null) {
                    setDialogState(() => issuedDate = picked);
                  }
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Bitiş tarihi'),
                subtitle: Text(_dateFormat.format(expiryDate)),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: expiryDate,
                    firstDate: DateTime(2000),
                    lastDate: DateTime(2100),
                  );
                  if (picked != null) {
                    setDialogState(() => expiryDate = picked);
                  }
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Vazgeç'),
            ),
            TextButton(
              onPressed: nameController.text.trim().isEmpty
                  ? null
                  : () => Navigator.of(context).pop(true),
              child: const Text('Ekle'),
            ),
          ],
        ),
      ),
    );

    if (saved != true || nameController.text.trim().isEmpty) return;
    try {
      await _api.createCertification(
        widget.staffId,
        name: nameController.text.trim(),
        issuedDate: issuedDate,
        expiryDate: expiryDate,
      );
      _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Sertifika eklendi.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Sertifika eklenemedi',
            ),
          ),
        );
      }
    }
  }

  Future<void> _deleteCertification(StaffCertification cert) async {
    try {
      await _api.deleteCertification(widget.staffId, cert.id);
      _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Sertifika silindi.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Sertifika silinemedi',
            ),
          ),
        );
      }
    }
  }

  /// web/src/app/(dashboard)/personel/ResetPasswordModal.tsx ile aynı akış —
  /// gerçek şifre asla görülmez, yalnızca rastgele üretilen geçici şifre bir
  /// kereliğine gösterilir.
  Future<void> _resetPassword() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Şifreyi Sıfırla'),
        content: Text(
          '${_staff!.fullName} için yeni, rastgele bir geçici şifre oluşturulacak. '
          'Kullanıcı bir sonraki girişinde şifresini değiştirmek zorunda kalacak.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Sıfırla')),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      final res = await ApiClient.instance.post<Map<String, dynamic>>(
        '/admin/users/${_staff!.userId}/reset-password',
      );
      final temporaryPassword = res['temporaryPassword'] as String;
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Geçici Şifre'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Bu şifre yalnızca burada, bir kereliğine gösteriliyor — kaydedilmiyor, '
                'tekrar görüntülenemez. Kullanıcıya güvenli bir şekilde iletin.',
                style: TextStyle(fontSize: 12.5),
              ),
              const SizedBox(height: 12),
              SelectableText(
                temporaryPassword,
                style: const TextStyle(fontWeight: FontWeight.w700, fontFamily: 'monospace', fontSize: 15),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Kapat')),
          ],
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Şifre sıfırlanamadı')),
        );
      }
    }
  }

  /// web/src/app/(dashboard)/personel/ImpersonateModal.tsx ile aynı akış.
  Future<void> _impersonate() async {
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Bu Kullanıcı Olarak Gir'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${_staff!.fullName} hesabına giriş yapacaksınız. Bu oturumda yaptığınız her '
              'işlem denetim kaydına gerçek aktör olarak sizi gösteren bir not ile işlenir.',
              style: const TextStyle(fontSize: 12.5),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(labelText: 'Gerekçe'),
              minLines: 2,
              maxLines: 4,
              autofocus: true,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Vazgeç')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(reasonController.text.trim()),
            child: const Text('Gir'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;

    try {
      final res = await ApiClient.instance.post<Map<String, dynamic>>(
        '/admin/impersonate',
        body: {'targetUserId': _staff!.userId, 'reason': reason},
      );
      if (!mounted) return;
      await context.read<AuthProvider>().beginImpersonation(
        token: res['token'] as String,
        targetUserJson: res['user'] as Map<String, dynamic>,
        impersonationMetaJson: res['impersonation'] as Map<String, dynamic>,
      );
      // Hedef kullanıcının rolü tamamen farklı bir kabuk (Shell) gerektirebilir
      // — kök widget'a (_AuthGate, artık yeni role göre yeniden render eder) dön.
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Impersonation başlatılamadı')),
        );
      }
    }
  }

  /// Gerekçe soran ortak dialog — Terfi/Rol Değiştir/İşten Çıkar aynı deseni
  /// paylaşır (web/src/app/(dashboard)/personel/ReasonModal.tsx ile aynı).
  Future<String?> _askReason(String title, String description, {bool danger = false}) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(description, style: const TextStyle(fontSize: 12.5)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'Gerekçe'),
              minLines: 2,
              maxLines: 4,
              autofocus: true,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Vazgeç')),
          FilledButton(
            style: danger ? FilledButton.styleFrom(backgroundColor: AppColors.danger500) : null,
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: Text(danger ? 'Onayla' : 'Devam Et'),
          ),
        ],
      ),
    );
  }

  Future<void> _promote() async {
    final reason = await _askReason(
      "Müdür'e Terfi Ettir",
      "${_staff!.fullName} Müdür'e terfi ettirilecek. Personel kaydı arşivlenir (silinmez), "
          "maaş/iş/değerlendirme geçmişi korunur.",
    );
    if (reason == null || reason.isEmpty) return;
    try {
      await ApiClient.instance.post('/staff/${_staff!.id}/promote-to-manager', body: {'reason': reason});
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Terfi ettirilemedi')),
        );
      }
    }
  }

  Future<void> _swapRole() async {
    final isTeamLead = _staff!.role == 'TEAM_LEAD';
    final newRole = isTeamLead ? 'STAFF' : 'TEAM_LEAD';
    final reason = await _askReason(
      isTeamLead ? 'Personel Yap' : 'Şef Yap',
      '${_staff!.fullName} ${isTeamLead ? 'Personel' : 'Ekip Lideri'} rolüne geçirilecek.',
    );
    if (reason == null || reason.isEmpty) return;
    try {
      await ApiClient.instance.patch(
        '/staff/${_staff!.id}/role',
        body: {'newRole': newRole, 'reason': reason},
      );
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Rol değiştirilemedi')),
        );
      }
    }
  }

  Future<void> _terminate() async {
    final reason = await _askReason(
      'İşten Çıkar',
      "${_staff!.fullName} işten çıkarılacak. Hesabı devre dışı kalır, tüm oturumları sonlanır; "
          'hiçbir veri silinmez.',
      danger: true,
    );
    if (reason == null || reason.isEmpty) return;
    try {
      await ApiClient.instance.post('/users/${_staff!.userId}/terminate', body: {'reason': reason});
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'İşten çıkarılamadı')),
        );
      }
    }
  }

  /// web/src/app/(dashboard)/personel/ArchivedStaffTab.tsx ile aynı akış —
  /// "Geçmiş Personel" görünümündeki tek aksiyon.
  Future<void> _reactivate() async {
    final reason = await _askReason(
      'Geri Aktif Et',
      '${_staff!.fullName} yeniden aktif edilecek ve tekrar giriş yapabilecek.',
    );
    if (reason == null || reason.isEmpty) return;
    try {
      await ApiClient.instance.post('/users/${_staff!.userId}/reactivate', body: {'reason': reason});
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Personel yeniden aktif edildi.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Geri aktif edilemedi')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_staff?.fullName ?? 'Personel'),
        actions: [
          if (_staff != null && _isOwner && _staff!.archivedAt != null)
            IconButton(
              icon: const Icon(Icons.restore_rounded),
              tooltip: 'Geri Aktif Et',
              onPressed: _reactivate,
            ),
          if (_staff != null && _isOwner && _staff!.archivedAt == null)
            PopupMenuButton<String>(
              icon: const Icon(Icons.admin_panel_settings_outlined),
              tooltip: 'Yönetici işlemleri',
              onSelected: (value) {
                if (value == 'reset') _resetPassword();
                if (value == 'impersonate') _impersonate();
                if (value == 'promote') _promote();
                if (value == 'swap_role') _swapRole();
                if (value == 'terminate') _terminate();
              },
              itemBuilder: (ctx) => [
                const PopupMenuItem(value: 'reset', child: Text('Şifreyi Sıfırla')),
                const PopupMenuItem(value: 'impersonate', child: Text('Bu Kullanıcı Olarak Gir')),
                const PopupMenuDivider(),
                const PopupMenuItem(value: 'promote', child: Text("Müdür'e Terfi Ettir")),
                PopupMenuItem(
                  value: 'swap_role',
                  child: Text(_staff!.role == 'TEAM_LEAD' ? 'Personel Yap' : 'Şef Yap'),
                ),
                const PopupMenuItem(
                  value: 'terminate',
                  child: Text('İşten Çıkar', style: TextStyle(color: AppColors.danger500)),
                ),
              ],
            ),
          if (_staff != null && _canManageStaff) ...[
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Düzenle',
              onPressed: () async {
                final updated = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => StaffFormScreen(staff: _staff),
                  ),
                );
                if (updated == true) {
                  _load();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Personel güncellendi.')),
                    );
                  }
                }
              },
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded),
              tooltip: 'Sil',
              onPressed: _delete,
            ),
          ],
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    final s = _staff!;
    final canChangeStatus = _isSelf || _isManagement;
    final allowedStatuses = _isSelf && !_isManagement
        ? selfServiceStaffStatuses
        : StaffStatus.values;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary600,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (s.archivedAt != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning50,
                borderRadius: BorderRadius.circular(AppRadius.card),
              ),
              child: Row(
                children: [
                  const Icon(Icons.inventory_2_outlined, size: 16, color: AppColors.warning600),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Bu personel arşivlenmiş — salt okunur görüntüleniyor.',
                      style: TextStyle(fontSize: 12, color: AppColors.warning600),
                    ),
                  ),
                ],
              ),
            ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(AppRadius.sheet),
              border: Border.all(color: AppColors.borderDefault),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s.position,
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  s.email,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.textFaint,
                  ),
                ),
                if (s.phone != null)
                  Text(
                    s.phone!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.textFaint,
                    ),
                  ),
                if (s.supervisor != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${roleLabelTr(roleFromString(s.supervisor!.role))}: '
                      '${s.supervisor!.fullName}',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Text(
                        staffStatusLabelTr(s.status),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (s.statusUntil != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        'Bitiş: ${DateFormat('HH:mm', 'tr_TR').format(s.statusUntil!)}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.textFaint,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          // Bölüm U (5. tur): işe alım kontrol listesi (yönetim işaretler, personel salt-okunur).
          OnboardingCard(staffId: s.id, editable: _canManageStaff),
          // Bölüm V (5. tur): dönemden döneme değerlendirme trendi (yetki yoksa gizli).
          EvaluationTrendCard(staffId: s.id),
          // Bölüm AH (8. tur): izin bakiyesi
          LeaveBalanceCard(staffId: s.id),

          if (canChangeStatus) ...[
            const SizedBox(height: 14),
            const Text(
              'Durumu Değiştir',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: allowedStatuses.map((st) {
                final selected = s.status == st;
                return ChoiceChip(
                  label: Text(staffStatusLabelTr(st)),
                  selected: selected,
                  onSelected: _busyStatus || selected
                      ? null
                      : (_) => _setStatus(
                          st,
                          until: st == StaffStatus.onBreak
                              ? const Duration(minutes: 30)
                              : null,
                        ),
                );
              }).toList(),
            ),
            if (allowedStatuses.contains(StaffStatus.onBreak))
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                  'Mola seçilirse 30 dakika sonra otomatik olarak müsait duruma döner.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.textFaint),
                ),
              ),
          ],

          if (_certifications.isNotEmpty || _canManageStaff) ...[
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Sertifikalar',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                ),
                if (_canManageStaff)
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline_rounded),
                    tooltip: 'Sertifika ekle',
                    color: AppColors.primary600,
                    onPressed: _addCertification,
                  ),
              ],
            ),
            if (_certifications.isEmpty)
              const Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: Text(
                  'Henüz sertifika eklenmemiş.',
                  style: TextStyle(fontSize: 12.5, color: AppColors.textFaint),
                ),
              ),
            const SizedBox(height: 8),
            ..._certifications.map((c) {
              final expiringSoon =
                  c.daysUntilExpiry <= 30 && c.daysUntilExpiry >= 0;
              final expired = c.daysUntilExpiry < 0;
              final color = expired
                  ? AppColors.danger600
                  : (expiringSoon
                        ? AppColors.warning600
                        : AppColors.success600);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceCard,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: AppColors.borderDefault),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              c.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                            Text(
                              'Bitiş: ${_dateFormat.format(c.expiryDate)}',
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.textFaint,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        expired
                            ? 'Süresi Doldu'
                            : (expiringSoon
                                  ? '${c.daysUntilExpiry} Gün Kaldı'
                                  : 'Geçerli'),
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                      if (_canManageStaff)
                        IconButton(
                          icon: const Icon(
                            Icons.delete_outline_rounded,
                            size: 18,
                            color: AppColors.textFaint,
                          ),
                          tooltip: 'Sertifikayı sil',
                          onPressed: () => _deleteCertification(c),
                        ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
