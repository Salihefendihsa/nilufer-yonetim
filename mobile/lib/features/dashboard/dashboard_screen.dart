import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import 'package:url_launcher/url_launcher.dart';

import '../../auth/auth_provider.dart';
import '../../models/job.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../navigation/manager_nav.dart';
import '../../widgets/state_views.dart';
import '../../widgets/stat_card.dart';
import '../advances/advance_request_sheet.dart';
import '../jobs/job_detail_screen.dart';
import '../jobs/jobs_api.dart';
import '../team/team_api.dart';
import 'dashboard_api.dart';
import 'dashboard_models.dart';

final _currency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);
final _timeFormat = DateFormat('d MMMM, HH:mm', 'tr_TR');

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = DashboardApi();
  final _teamApi = TeamApi();
  final _jobsApi = JobsApi();

  bool _loading = true;
  String? _error;

  DashboardSummary? _summary;
  List<ActivityEvent> _activity = [];
  PendingApprovalsCount? _pending;
  int? _staffTodaysJobs;
  List<Job> _staffTodaysJobsList = [];
  TeamSummary? _team;

  bool get _isManagement {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner || role == AppRole.manager;
  }

  bool get _isTeamLead =>
      context.read<AuthProvider>().user?.role == AppRole.teamLead;

  bool get _isStaff =>
      context.read<AuthProvider>().user?.role == AppRole.staff;

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
      if (_isManagement) {
        final results = await Future.wait([
          _api.getSummary(),
          _api.getActivityFeed(),
          _api.getPendingApprovalsCount(),
        ]);
        _summary = results[0] as DashboardSummary;
        _activity = results[1] as List<ActivityEvent>;
        _pending = results[2] as PendingApprovalsCount;
      } else if (_isTeamLead) {
        // Şef, şirket geneli /dashboard/summary'ye erişemez; ekip kapsamlı
        // /team/summary kullanılır.
        _team = await _teamApi.summary();
      } else if (_isStaff) {
        // STAFF'ın /dashboard/summary'ye erişimi yok (OWNER/MANAGER'a
        // kısıtlı) — backend zaten /jobs'ı kendi işleriyle sınırlıyor
        // (jobsController.listJobs: assignedStaffId = getStaffIdForUser),
        // bu yüzden tam liste çekilip istemcide özetlenir (Stitch Personel
        // → Ana Sayfa: 3 stat kartı + Vardiya Durumu dağılımı + görev listesi).
        final today = DateTime.now();
        final dateStr =
            '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
        final res = await _jobsApi.list(date: dateStr, limit: 100);
        _staffTodaysJobsList = res.data;
        _staffTodaysJobs = res.data.length;
      } else {
        _staffTodaysJobs = await _api.getTodaysJobsCountForCurrentUser();
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(
        leading: ManagerNav.maybeLeading(context),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Nilüfer İlaçlama',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            Text(
              'Ana Sayfa · ${user != null ? roleLabelTr(user.role) : ''}',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Çıkış yap',
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary600,
        child: _buildBody(user),
      ),
    );
  }

  Widget _buildBody(AppUser? user) {
    if (_loading) return const LoadingView();
    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          ErrorRetryView(
            message: 'Veriler yüklenemedi: $_error',
            onRetry: _load,
          ),
        ],
      );
    }

    if (_isManagement) return _buildManagementBody();
    if (_isTeamLead) return _buildTeamLeadBody(user);
    if (_isStaff) return _buildStaffBody(user);
    return _buildFieldBody(user);
  }

  Widget _buildManagementBody() {
    final s = _summary!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        StatCardGrid(
          children: [
            AppStatCard(
              label: 'Bugünkü İş',
              value: '${s.todaysJobsCount}',
              icon: Icons.assignment_rounded,
              caption: 'Planlanan işler',
            ),
            AppStatCard(
              label: 'Bekleyen Onay',
              value: '${_pending?.total ?? 0}',
              icon: Icons.fact_check_rounded,
              iconColor: AppColors.danger500,
              iconBackground: AppColors.danger50,
              caption: _pending == null
                  ? null
                  : '${_pending!.quotes} teklif, ${_pending!.advances} avans, ${_pending!.expiringContracts} sözleşme',
              badge: (_pending?.total ?? 0) > 0 ? 'DİKKAT' : null,
              badgeColor: AppColors.danger500,
            ),
            AppStatCard(
              label: 'Bu Ay Tahsilat',
              value: _currency.format(s.thisMonthPaymentsTotal),
              icon: Icons.payments_rounded,
              iconColor: AppColors.info600,
              iconBackground: AppColors.info50,
            ),
            AppStatCard(
              label: 'Tamamlanan İş (Ay)',
              value: '${s.completedJobsThisMonth}',
              icon: Icons.check_circle_rounded,
              iconColor: AppColors.success600,
              iconBackground: AppColors.success50,
            ),
            AppStatCard(
              label: 'Sahadaki Personel',
              value: '${s.staffOnJobCount}/${s.activeStaffCount}',
              icon: Icons.groups_rounded,
              iconColor: AppColors.primary700,
              caption: 'İşteki / toplam personel',
            ),
            AppStatCard(
              label: 'Yeni Teklif Talebi',
              value: '${s.newQuoteRequestsCount}',
              icon: Icons.request_quote_rounded,
              iconColor: AppColors.warning600,
              iconBackground: AppColors.warning50,
            ),
            AppStatCard(
              label: 'Rapor Onayı',
              value: '${s.pendingReportApprovals}',
              icon: Icons.rate_review_rounded,
              iconColor: AppColors.warning600,
              iconBackground: AppColors.warning50,
              caption: 'Onay bekleyen saha raporu',
              badge: s.pendingReportApprovals > 0 ? 'BEKLİYOR' : null,
              badgeColor: AppColors.warning600,
            ),
            AppStatCard(
              // Formül: tamamlanan / (tamamlanan + iptal). Bu ay hiç
              // sonuçlanan iş yoksa yüzde hesaplanamaz ve "—" gösterilir.
              label: 'Tamamlama Oranı',
              value: s.completionRateThisMonth == null
                  ? '—'
                  : '%${s.completionRateThisMonth!.toStringAsFixed(0)}',
              icon: Icons.insights_rounded,
              iconColor: AppColors.success600,
              iconBackground: AppColors.success50,
              caption: 'Bu ay tamamlanan / sonuçlanan',
            ),
          ],
        ),
        if (s.todaysServiceBreakdown.isNotEmpty) ...[
          const SizedBox(height: 24),
          const Text(
            'Bugünün Hizmet Türü Kırılımı',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.borderDefault),
            ),
            child: Column(
              children: [
                for (final entry in s.todaysServiceBreakdown.take(6))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            entry.serviceType,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13.5),
                          ),
                        ),
                        const SizedBox(width: 12),
                        SizedBox(
                          width: 90,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              value: s.todaysJobsCount > 0
                                  ? entry.count / s.todaysJobsCount
                                  : 0,
                              minHeight: 6,
                              backgroundColor: AppColors.surfaceMuted,
                              valueColor: const AlwaysStoppedAnimation(
                                AppColors.primary500,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          '${entry.count}',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
        const Text(
          'Son Hareketler',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 10),
        if (_activity.isEmpty)
          const EmptyStateView(
            title: 'Henüz hareket yok',
            icon: Icons.history_rounded,
          )
        else
          Container(
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.borderDefault),
            ),
            child: Column(
              children: List.generate(_activity.length, (i) {
                final e = _activity[i];
                return Column(
                  children: [
                    ListTile(
                      dense: true,
                      leading: const Icon(
                        Icons.circle,
                        size: 8,
                        color: AppColors.primary500,
                      ),
                      title: Text(
                        e.text,
                        style: const TextStyle(fontSize: 13.5),
                      ),
                      subtitle: Text(
                        _timeFormat.format(e.timestamp),
                        style: const TextStyle(fontSize: 11.5),
                      ),
                    ),
                    if (i != _activity.length - 1) const Divider(height: 1),
                  ],
                );
              }),
            ),
          ),
      ],
    );
  }

  /// Şef ana sayfası — Stitch "sef/ana_sayfa": bugünkü ekip işleri, tamamlama
  /// oranı, sahadaki teknisyen sayısı, durum dağılımı ve ekip iş yükü.
  Widget _buildTeamLeadBody(AppUser? user) {
    final t = _team;
    if (t == null) {
      return const EmptyStateView(
        title: 'Ekip verisi yüklenemedi',
        icon: Icons.groups_outlined,
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Merhaba, ${user?.fullName.split(' ').first ?? ''}. '
          'Ekibinin bugünkü işleri burada.',
          style: const TextStyle(
            fontSize: 14,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 14),
        StatCardGrid(
          children: [
            AppStatCard(
              label: 'Bugün',
              value: '${t.todaysJobsCount} İş',
              icon: Icons.calendar_today_rounded,
              caption: 'Ekibe atanan',
            ),
            AppStatCard(
              label: 'Tamamlandı',
              value: t.completionRateToday == null
                  ? '${t.completedTodayCount}/${t.todaysJobsCount}'
                  : '%${t.completionRateToday!.toStringAsFixed(0)}',
              icon: Icons.check_circle_rounded,
              iconColor: AppColors.success600,
              iconBackground: AppColors.success50,
              caption: '${t.completedTodayCount} / ${t.todaysJobsCount}',
            ),
            AppStatCard(
              label: 'Sahada Aktif',
              value: '${t.activeTechnicianCount} Teknisyen',
              icon: Icons.badge_rounded,
              iconColor: AppColors.info600,
              iconBackground: AppColors.info50,
              caption: '${t.teamSize} kişilik ekip',
            ),
            AppStatCard(
              label: 'Devam Eden',
              value: '${t.todaysJobsByStatus['IN_PROGRESS'] ?? 0}',
              icon: Icons.timelapse_rounded,
              iconColor: AppColors.warning600,
              iconBackground: AppColors.warning50,
              caption: 'Şu an sürüyor',
            ),
          ],
        ),
        const SizedBox(height: 20),
        const Text(
          'Bugünkü Durum Dağılımı',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.borderDefault),
          ),
          child: Column(
            children: [
              for (final entry in const [
                ('PENDING', 'Bekliyor'),
                ('SCHEDULED', 'Planlandı'),
                ('IN_PROGRESS', 'Devam Ediyor'),
                ('COMPLETED', 'Tamamlandı'),
                ('CANCELLED', 'İptal'),
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          entry.$2,
                          style: const TextStyle(fontSize: 13.5),
                        ),
                      ),
                      Text(
                        '${t.todaysJobsByStatus[entry.$1] ?? 0}',
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Ekip İş Yükü',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Bugün kişi başına düşen iş',
          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 10),
        if (t.workload.isEmpty)
          const EmptyStateView(
            title: 'Ekibinize bağlı personel yok',
            icon: Icons.groups_outlined,
          )
        else
          Column(
            children: [
              for (final w in t.workload)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.borderDefault),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: AppColors.primary100,
                            child: Text(
                              w.fullName
                                  .trim()
                                  .split(RegExp(r'\s+'))
                                  .map((p) => p.isNotEmpty ? p[0] : '')
                                  .take(2)
                                  .join()
                                  .toUpperCase(),
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.primary700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  w.fullName,
                                  style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  [
                                    w.position,
                                    if (w.vehiclePlate != null) w.vehiclePlate!,
                                  ].join(' · '),
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            w.dailyJobCapacity != null
                                ? '${w.todaysJobsCount}/${w.dailyJobCapacity}'
                                : '${w.todaysJobsCount} iş',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      // Kapasite tanımlı değilse doluluk çubuğu HİÇ gösterilmez
                      // (varsayılan bir üst sınır uydurulmaz).
                      if (w.dailyJobCapacity != null) ...[
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: (w.todaysJobsCount / w.dailyJobCapacity!)
                                .clamp(0.0, 1.0),
                            minHeight: 6,
                            backgroundColor: AppColors.surfaceMuted,
                            valueColor: AlwaysStoppedAnimation(
                              w.todaysJobsCount > w.dailyJobCapacity!
                                  ? AppColors.danger500
                                  : w.todaysJobsCount == w.dailyJobCapacity!
                                  ? AppColors.warning500
                                  : AppColors.primary500,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }

  /// Stitch Personel → Ana Sayfa: karşılama + Avans Talep Et, 3 stat kartı,
  /// Vardiya Durumu segmentli dağılım ve bugünkü görev listesi. Tüm veriler
  /// backend'in zaten STAFF'a kendi işleriyle sınırlayarak döndürdüğü
  /// `/jobs?date=` sonucundan (bkz. _load) istemcide özetlenir.
  Widget _buildStaffBody(AppUser? user) {
    final jobs = _staffTodaysJobsList;
    final total = jobs.length;
    final completed = jobs.where((j) => j.status == JobStatus.completed).length;
    final pending = jobs.where((j) => j.status == JobStatus.pending).length;
    final scheduled = jobs.where((j) => j.status == JobStatus.scheduled).length;
    final inProgress = jobs.where((j) => j.status == JobStatus.inProgress).length;
    final cancelled = jobs.where((j) => j.status == JobStatus.cancelled).length;
    final active = pending + scheduled + inProgress;
    final completionPct = total > 0 ? (completed / total * 100).round() : 0;
    final firstName = (user?.fullName ?? '').trim().split(' ').first;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Merhaba, $firstName',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'Bugünkü işlerin burada.',
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton.icon(
              onPressed: () => showAdvanceRequestSheet(context),
              icon: const Icon(Icons.payments_rounded, size: 16),
              label: const Text('Avans Talep Et'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary700,
                side: const BorderSide(color: AppColors.borderDefault),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        StatCardGrid(
          crossAxisCount: 3,
          children: [
            AppStatCard(
              label: 'Bugünkü İş',
              value: '$total',
              icon: Icons.calendar_today_rounded,
              caption: 'Toplam kayıt',
            ),
            AppStatCard(
              label: 'Tamamlanan',
              value: '$completed',
              icon: Icons.check_circle_rounded,
              iconColor: AppColors.success600,
              iconBackground: AppColors.success50,
              badge: total > 0 ? '%$completionPct' : null,
              badgeColor: AppColors.success600,
            ),
            AppStatCard(
              label: 'Bekleyen',
              value: '$active',
              icon: Icons.schedule_rounded,
              iconColor: AppColors.primary700,
              caption: 'Sırada bekliyor',
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.borderDefault),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Vardiya Durumu',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                  Text(
                    '$completed / $total Tamamlandı',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _ShiftStatusDot(color: AppColors.warning500, label: 'Bekliyor', count: pending),
                  _ShiftStatusDot(color: AppColors.primary300, label: 'Planlandı', count: scheduled),
                  _ShiftStatusDot(color: AppColors.primary600, label: 'Tamam', count: completed),
                  _ShiftStatusDot(color: AppColors.danger500, label: 'İptal', count: cancelled),
                ],
              ),
              const SizedBox(height: 10),
              if (total > 0)
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: SizedBox(
                    height: 8,
                    child: Row(
                      children: [
                        if (completed > 0)
                          Expanded(
                            flex: completed,
                            child: Container(color: AppColors.primary600),
                          ),
                        if (active > 0)
                          Expanded(
                            flex: active,
                            child: Container(color: AppColors.warning500),
                          ),
                        if (cancelled > 0)
                          Expanded(
                            flex: cancelled,
                            child: Container(color: AppColors.danger500),
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Bugünkü Görevlerin',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.success50,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '$active Aktif',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.success600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (jobs.isEmpty)
          const EmptyStateView(
            title: 'Bugün için atanmış işiniz yok',
            icon: Icons.event_available_rounded,
          )
        else
          for (final job in jobs) _StaffJobCard(job: job, onChanged: _load),
      ],
    );
  }

  Widget _buildFieldBody(AppUser? user) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.primary700,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Merhaba, ${user?.fullName ?? ''}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                DateFormat('d MMMM yyyy, EEEE', 'tr_TR').format(DateTime.now()),
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppStatCard(
          label: 'Bugünkü İşleriniz',
          value: '${_staffTodaysJobs ?? 0}',
          icon: Icons.assignment_rounded,
          caption: 'İşler sekmesinden detaylara ulaşabilirsiniz',
        ),
      ],
    );
  }
}

class _ShiftStatusDot extends StatelessWidget {
  final Color color;
  final String label;
  final int count;
  const _ShiftStatusDot({
    required this.color,
    required this.label,
    required this.count,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(
                  '$count',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Stitch Personel → Ana Sayfa/İşler: görev kartı — ara/yol tarifi/durum
/// aksiyonu. Durum geçişleri backend'in VALID_TRANSITIONS tablosuyla
/// uyumludur (bkz. models/job.dart:validJobStatusTransitions).
class _StaffJobCard extends StatefulWidget {
  final Job job;
  final VoidCallback onChanged;
  const _StaffJobCard({required this.job, required this.onChanged});

  @override
  State<_StaffJobCard> createState() => _StaffJobCardState();
}

class _StaffJobCardState extends State<_StaffJobCard> {
  final _api = JobsApi();
  bool _updating = false;

  Future<void> _startJob() async {
    setState(() => _updating = true);
    try {
      await _api.updateStatus(widget.job.id, JobStatus.inProgress);
      widget.onChanged();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('İş başlatılamadı, tekrar deneyin')),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Color _statusColor(JobStatus s) {
    switch (s) {
      case JobStatus.completed:
        return AppColors.success600;
      case JobStatus.inProgress:
        return AppColors.primary600;
      case JobStatus.cancelled:
        return AppColors.danger500;
      case JobStatus.pending:
      case JobStatus.scheduled:
        return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final job = widget.job;
    final timeLabel = job.scheduledAt != null
        ? (job.scheduledEndAt != null
              ? '${DateFormat('HH:mm').format(job.scheduledAt!)} - ${DateFormat('HH:mm').format(job.scheduledEndAt!)}'
              : DateFormat('HH:mm').format(job.scheduledAt!))
        : 'Saat belirtilmedi';
    final locationLabel = [
      job.customerDistrict,
      job.customerAddress,
    ].where((s) => s != null && s.isNotEmpty).join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: job.status == JobStatus.inProgress
              ? AppColors.primary500
              : AppColors.borderDefault,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                timeLabel,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: _statusColor(job.status).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  jobStatusLabelTr(job.status),
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: _statusColor(job.status),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            job.customerName ?? '—',
            style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 2),
          Text(
            job.serviceType,
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.primary700,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (locationLabel.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(
                  Icons.location_on_outlined,
                  size: 15,
                  color: AppColors.textFaint,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    locationLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (job.status == JobStatus.pending ||
              job.status == JobStatus.scheduled ||
              job.status == JobStatus.inProgress) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                if (job.customerPhone != null && job.customerPhone!.isNotEmpty)
                  _RoundIconButton(
                    icon: Icons.call_rounded,
                    onTap: () =>
                        launchUrl(Uri.parse('tel:${job.customerPhone}')),
                  ),
                if (locationLabel.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  _RoundIconButton(
                    icon: Icons.directions_rounded,
                    onTap: () => launchUrl(
                      Uri.parse(
                        'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(locationLabel)}',
                      ),
                    ),
                  ),
                ],
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _updating
                        ? null
                        : job.status == JobStatus.inProgress
                        ? () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) =>
                                  JobDetailScreen(jobId: job.id),
                            ),
                          )
                        : _startJob,
                    icon: _updating
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Icon(
                            job.status == JobStatus.inProgress
                                ? Icons.fact_check_rounded
                                : Icons.play_arrow_rounded,
                            size: 18,
                          ),
                    label: Text(
                      job.status == JobStatus.inProgress
                          ? 'Tamamla ve Raporla'
                          : 'İşe Başla',
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _RoundIconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, size: 20, color: AppColors.primary700),
      ),
    );
  }
}
