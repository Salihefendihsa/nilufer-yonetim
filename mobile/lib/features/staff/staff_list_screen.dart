import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/staff.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/staggered_fade_in.dart';
import '../../navigation/manager_nav.dart';
import '../../widgets/state_views.dart';
import '../search/search_action.dart';
import 'staff_api.dart';
import 'staff_detail_screen.dart';
import 'staff_form_screen.dart';

Map<StaffStatus, Color> _statusColors(AppPalette cs) => {
  StaffStatus.available: cs.success500,
  StaffStatus.onJob: cs.info500,
  StaffStatus.onBreak: cs.warning500,
  StaffStatus.onLeave: cs.textFaint,
  StaffStatus.offline: cs.neutral400,
};

/// backend/src/controllers/staffController.ts:listStaff kapsamı zaten role
/// göre filtreliyor (TEAM_LEAD → yalnızca kendi ekibi) — burada tekrar
/// filtrelenmez.
class StaffListScreen extends StatefulWidget {
  const StaffListScreen({super.key});

  @override
  State<StaffListScreen> createState() => _StaffListScreenState();
}

class _StaffListScreenState extends State<StaffListScreen> {
  final _api = StaffApi();
  List<Staff> _staff = [];
  bool _loading = true;
  String? _error;
  bool _showArchived = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool get _isOwner => context.read<AuthProvider>().user?.role == AppRole.owner;

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.list(includeArchived: _showArchived);
      setState(() => _staff = res.data);
    } catch (e) {
      setState(
        () => _error = e is ApiException
            ? e.message
            : 'Personel listesi yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  bool get _canManage {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner || role == AppRole.manager;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: ManagerNav.maybeLeading(context),
        title: Text(_showArchived ? 'Geçmiş Personel' : 'Personel'),
        actions: [
          const SearchAction(),
          if (_isOwner)
            IconButton(
              icon: Icon(
                _showArchived ? Icons.groups_outlined : Icons.history_rounded,
              ),
              tooltip: _showArchived ? 'Aktif Personel' : 'Geçmiş Personel',
              onPressed: () {
                setState(() => _showArchived = !_showArchived);
                _load();
              },
            ),
          if (_canManage && !_showArchived)
            IconButton(
              icon: const Icon(Icons.person_add_alt_1_rounded),
              tooltip: 'Yeni personel',
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const StaffFormScreen()),
                );
                if (created == true) {
                  _load();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Personel kaydedildi.')),
                    );
                  }
                }
              },
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    final cs = context.colors;
    final tx = context.text;
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_staff.isEmpty)
      return const EmptyStateView(
        title: 'Personel bulunamadı',
        icon: Icons.groups_outlined,
      );

    return RefreshIndicator(
      onRefresh: _load,
      color: cs.accentSoft,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _staff.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final s = _staff[i];
          final color = _statusColors(context.colors)[s.status]!;
          final initials = s.fullName
              .trim()
              .split(RegExp(r'\s+'))
              .map((w) => w.isNotEmpty ? w[0] : '')
              .take(2)
              .join()
              .toUpperCase();
          return StaggeredFadeIn(
            index: i,
            child: Material(
              color: cs.surfaceCard,
              borderRadius: BorderRadius.circular(AppRadius.card),
              child: InkWell(
                borderRadius: BorderRadius.circular(AppRadius.card),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => StaffDetailScreen(staffId: s.id),
                  ),
                ),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: cs.borderDefault),
                  ),
                  child: Row(
                    children: [
                      Stack(
                        children: [
                          CircleAvatar(
                            radius: 22,
                            backgroundColor: cs.primary100,
                            child: Text(
                              initials.isEmpty ? '?' : initials,
                              style: TextStyle(
                                color: cs.primary700,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: color,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 2,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              s.fullName,
                              style: tx.subtitle.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              [
                                s.position,
                                if (s.vehiclePlate != null) s.vehiclePlate!,
                              ].join(' · '),
                              style: tx.bodySmall,
                            ),
                            if (s.supervisor != null)
                              Text(
                                '${roleLabelTr(roleFromString(s.supervisor!.role))}: '
                                '${s.supervisor!.fullName}',
                                style: tx.caption.copyWith(color: cs.textFaint),
                              ),
                            const SizedBox(height: 4),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                // Kapasite tanimliysa doluluk, degilse yalnizca
                                // bugunku is sayisi gosterilir.
                                _Pill(
                                  text: s.dailyJobCapacity != null
                                      ? 'Bugün ${s.todaysJobsCount}/'
                                            '${s.dailyJobCapacity}'
                                      : 'Bugün ${s.todaysJobsCount} iş',
                                  color:
                                      s.dailyJobCapacity != null &&
                                          s.todaysJobsCount >
                                              s.dailyJobCapacity!
                                      ? cs.danger600
                                      : cs.textSecondary,
                                ),
                                if (s.averageRating != null)
                                  _Pill(
                                    text:
                                        '★ ${s.averageRating!.toStringAsFixed(1)}'
                                        ' (${s.ratedJobsCount})',
                                    color: cs.warning600,
                                  ),
                                if (s.expiringCertificationCount > 0)
                                  _Pill(
                                    text:
                                        '${s.expiringCertificationCount} belge '
                                        'bitiyor',
                                    color: cs.danger600,
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text(
                          staffStatusLabelTr(s.status),
                          style: tx.label.copyWith(color: color),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Personel kartindaki kucuk bilgi rozeti.
class _Pill extends StatelessWidget {
  final String text;
  final Color color;
  const _Pill({required this.text, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(AppRadius.pill),
    ),
    child: Text(text, style: context.text.label.copyWith(color: color)),
  );
}
