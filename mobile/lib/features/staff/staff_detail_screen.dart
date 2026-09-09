import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/staff.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'staff_api.dart';

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

  bool get _isSelf =>
      _staff != null && _staff!.userId == context.read<AuthProvider>().user?.id;

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: Text(_staff?.fullName ?? 'Personel')),
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
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(18),
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
                        borderRadius: BorderRadius.circular(999),
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

          if (_certifications.isNotEmpty) ...[
            const SizedBox(height: 18),
            const Text(
              'Sertifikalar',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
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
                    borderRadius: BorderRadius.circular(14),
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
