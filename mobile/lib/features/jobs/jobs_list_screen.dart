import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/job.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../navigation/manager_nav.dart';
import '../search/search_action.dart';
import '../../widgets/staggered_fade_in.dart';
import '../../widgets/state_views.dart';
import 'jobs_api.dart';
import 'job_detail_screen.dart';
import 'job_form_screen.dart';

final _timeFormat = DateFormat('d MMM, HH:mm', 'tr_TR');

Map<JobStatus, Color> _statusColors(AppPalette cs) => {
  JobStatus.pending: cs.warning500,
  JobStatus.scheduled: cs.primary400,
  JobStatus.inProgress: cs.info500,
  JobStatus.completed: cs.success500,
  JobStatus.cancelled: cs.danger500,
};

/// backend/src/controllers/jobsController.ts:listJobs kapsamı zaten role göre
/// filtreliyor (STAFF→kendi işleri, TEAM_LEAD→ekibi, CUSTOMER→kendisi,
/// OWNER/MANAGER→hepsi) — burada ekstra bir rol filtresi UYGULANMAZ.
class JobsListScreen extends StatefulWidget {
  const JobsListScreen({super.key});

  @override
  State<JobsListScreen> createState() => _JobsListScreenState();
}

class _JobsListScreenState extends State<JobsListScreen> {
  final _api = JobsApi();
  List<Job> _jobs = [];
  bool _loading = true;
  String? _error;
  JobStatus? _filter;
  String _search = '';
  Timer? _debounce;
  final _searchController = TextEditingController();

  bool get _canCreate {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner || role == AppRole.manager;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.list(
        status: _filter != null ? jobStatusToApiString(_filter!) : null,
        search: _search.isEmpty ? null : _search,
      );
      setState(() => _jobs = res.data);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'İşler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      _search = value.trim();
      _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // Müdür kabuğunda çekmece butonu; diğer rollerde null (varsayılan geri oku).
        leading: ManagerNav.maybeLeading(context),
        title: const Text('İşler'),
        actions: [
          const SearchAction(),
          if (_canCreate)
            IconButton(
              icon: const Icon(Icons.add_task_rounded),
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const JobFormScreen()),
                );
                if (created == true) _load();
              },
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: const InputDecoration(
                hintText: 'İş no, müşteri, adres veya hizmet ara...',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
          ),
          SizedBox(
            height: 46,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              children: [
                _FilterChip(
                  label: 'Tümü',
                  selected: _filter == null,
                  onTap: () => setState(() {
                    _filter = null;
                    _load();
                  }),
                ),
                for (final s in JobStatus.values)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: _FilterChip(
                      label: jobStatusLabelTr(s),
                      selected: _filter == s,
                      color: _statusColors(context.colors)[s],
                      onTap: () => setState(() {
                        _filter = s;
                        _load();
                      }),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    final cs = context.colors;
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_jobs.isEmpty)
      return const EmptyStateView(
        title: 'İş bulunamadı',
        icon: Icons.assignment_outlined,
      );

    return RefreshIndicator(
      onRefresh: _load,
      color: cs.accentSoft,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _jobs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final job = _jobs[i];
          return StaggeredFadeIn(
            index: i,
            child: _JobCard(
              job: job,
              onTap: () async {
                final changed = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => JobDetailScreen(jobId: job.id),
                  ),
                );
                if (changed == true) _load();
              },
            ),
          );
        },
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final base = color ?? cs.primary600;
    return Material(
      color: selected ? base : cs.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(color: selected ? base : cs.borderDefault),
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

class _JobCard extends StatelessWidget {
  final Job job;
  final VoidCallback onTap;
  const _JobCard({required this.job, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final color = _statusColors(context.colors)[job.status]!;
    // NOT: BoxDecoration'da farklı renkli kenarlarla (Border(left: ..., top: ...))
    // borderRadius birlikte kullanılamaz — Flutter bunu paint() sırasında bir
    // assertion ile reddediyor ve bu kartın TÜM içeriği (metin dahil) hiç
    // çizilmeden boş kalıyordu (gerçek cihazda görsel doğrulama sırasında
    // bulundu). Sol renkli şerit artık ayrı bir Container ile, tekdüze gri
    // kenarlıktan bağımsız olarak çiziliyor.
    return Material(
      color: cs.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.card),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: cs.borderDefault),
          ),
          clipBehavior: Clip.antiAlias,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(width: 4, color: color),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                job.customerName ?? 'Müşteri',
                                style: tx.subtitle.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(
                                  AppRadius.pill,
                                ),
                              ),
                              child: Text(
                                jobStatusLabelTr(job.status),
                                style: tx.label.copyWith(color: color),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          job.sequenceNo != null
                              ? '#${job.sequenceNo} · ${job.serviceType}'
                              : job.serviceType,
                          style: tx.bodySmall,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(
                              Icons.person_outline_rounded,
                              size: 13,
                              color: cs.textFaint,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              job.assignedStaffName ?? 'Atanmadı',
                              style: tx.caption.copyWith(color: cs.textFaint),
                            ),
                            if (job.scheduledAt != null) ...[
                              const SizedBox(width: 10),
                              Icon(
                                Icons.schedule_rounded,
                                size: 13,
                                color: cs.textFaint,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${_timeFormat.format(job.scheduledAt!)}'
                                '${job.scheduledEndAt != null ? ' – ${_timeFormat.format(job.scheduledEndAt!)}' : ''}',
                                style: tx.caption.copyWith(color: cs.textFaint),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
