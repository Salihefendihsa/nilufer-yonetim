import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../models/job.dart';
import '../../theme/app_colors.dart';
import '../../auth/auth_provider.dart';
import '../../models/user.dart';
import '../../widgets/state_views.dart';
import '../team/team_api.dart';
import '../jobs/jobs_api.dart';
import '../jobs/job_detail_screen.dart';

/// web/src/app/(dashboard)/takvim/page.tsx ile aynı mantık: aylık ısı
/// haritası + seçili günün iş listesi. Backend kapsamı (STAFF→kendi işleri,
/// TEAM_LEAD→ekibi vb.) /jobs uctan zaten uygulanıyor.
class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  final _api = JobsApi();
  final _teamApi = TeamApi();

  /// Şef için ekip kapasitesi özeti (Stitch Şef → Takvim: "Ekip Kapasite
  /// Durumu 6/8 Slot Dolu"). Diğer rollerde null kalır ve blok gösterilmez.
  TeamCalendar? _teamCalendar;
  DateTime _monthStart = DateTime(DateTime.now().year, DateTime.now().month, 1);
  DateTime _selectedDate = DateTime.now();
  List<Job> _jobs = [];
  bool _loading = true;
  String? _error;

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
      final from = _monthStart;
      final to = DateTime(
        _monthStart.year,
        _monthStart.month + 1,
        0,
        23,
        59,
        59,
      );
      final res = await _api.list(from: from, to: to, limit: 200);

      // Kapasite/yoğunluk özeti yalnızca ekip lideri için anlamlıdır ve
      // sunucuda ekip kapsamıyla hesaplanır.
      TeamCalendar? teamCalendar;
      if (mounted && context.read<AuthProvider>().user?.role == AppRole.teamLead) {
        final month = DateFormat('yyyy-MM').format(_monthStart);
        try {
          teamCalendar = await _teamApi.calendar(month: month);
        } on ApiException {
          teamCalendar = null; // özet alınamazsa takvim yine gösterilir
        }
      }

      setState(() {
        _jobs = res.data;
        _teamCalendar = teamCalendar;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'İşler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Map<String, List<Job>> get _jobsByDay {
    final map = <String, List<Job>>{};
    for (final j in _jobs) {
      if (j.scheduledAt == null) continue;
      final key = DateFormat('yyyy-MM-dd').format(j.scheduledAt!);
      (map[key] ??= []).add(j);
    }
    return map;
  }

  void _changeMonth(int delta) {
    setState(
      () => _monthStart = DateTime(
        _monthStart.year,
        _monthStart.month + delta,
        1,
      ),
    );
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: const Text('Takvim')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _buildCalendar(),
    );
  }

  /// Ekip kapasite kartı — kapasite tanımlı değilse (dailyCapacity null)
  /// doluluk yüzdesi GÖSTERİLMEZ, yalnızca iş sayıları yazılır.
  Widget _buildCapacityCard(TeamCalendar c) {
    final today = c.todayCapacity;
    return Container(
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
              const Icon(
                Icons.speed_rounded,
                size: 18,
                color: AppColors.primary700,
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Ekip Kapasite Durumu (Bugün)',
                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                today != null
                    ? '${c.todayJobCount} / $today slot'
                    : '${c.todayJobCount} iş',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          if (today != null && today > 0) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (c.todayJobCount / today).clamp(0.0, 1.0),
                minHeight: 6,
                backgroundColor: AppColors.surfaceMuted,
                valueColor: AlwaysStoppedAnimation(
                  c.todayJobCount > today
                      ? AppColors.danger500
                      : AppColors.primary500,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Kalan boşluk: ${(today - c.todayJobCount).clamp(0, today)} görev',
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Bu hafta: ${c.weekJobCount}'
                  '${c.weekCapacity != null ? ' / ${c.weekCapacity}' : ''}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              if (c.busiestDay != null)
                Text(
                  'En yoğun: '
                  '${DateFormat('d MMM', 'tr_TR').format(DateTime.parse(c.busiestDay!.date))}'
                  ' (${c.busiestDay!.jobCount})',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCalendar() {
    final byDay = _jobsByDay;
    final maxCount = byDay.values.fold(
      0,
      (m, l) => l.length > m ? l.length : m,
    );
    final daysInMonth = DateTime(
      _monthStart.year,
      _monthStart.month + 1,
      0,
    ).day;
    final firstWeekday = (_monthStart.weekday - 1) % 7; // Monday = 0

    final selectedKey = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final selectedJobs = byDay[selectedKey] ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Şef için ekip kapasitesi (diğer rollerde _teamCalendar null kalır).
        if (_teamCalendar != null) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildCapacityCard(_teamCalendar!),
          ),
        ],
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              icon: const Icon(Icons.chevron_left_rounded),
              onPressed: () => _changeMonth(-1),
            ),
            Text(
              DateFormat('MMMM yyyy', 'tr_TR').format(_monthStart),
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            IconButton(
              icon: const Icon(Icons.chevron_right_rounded),
              onPressed: () => _changeMonth(1),
            ),
          ],
        ),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
          ),
          itemCount: daysInMonth + firstWeekday,
          itemBuilder: (context, i) {
            if (i < firstWeekday) return const SizedBox.shrink();
            final day = i - firstWeekday + 1;
            final date = DateTime(_monthStart.year, _monthStart.month, day);
            final key = DateFormat('yyyy-MM-dd').format(date);
            final count = byDay[key]?.length ?? 0;
            final ratio = maxCount == 0 ? 0.0 : count / maxCount;
            final isSelected = key == selectedKey;
            final bg = count == 0
                ? AppColors.surfaceBase
                : Color.lerp(AppColors.primary50, AppColors.primary400, ratio)!;

            return GestureDetector(
              onTap: () => setState(() => _selectedDate = date),
              child: Container(
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isSelected
                        ? AppColors.primary700
                        : AppColors.borderDefault,
                    width: isSelected ? 2 : 1,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  '$day',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 18),
        Text(
          DateFormat('d MMMM yyyy, EEEE', 'tr_TR').format(_selectedDate),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
        ),
        const SizedBox(height: 8),
        if (selectedJobs.isEmpty)
          const EmptyStateView(
            title: 'Bu gün için iş yok',
            icon: Icons.event_busy_rounded,
          )
        else
          ...selectedJobs.map(
            (j) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                tileColor: AppColors.surfaceCard,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: const BorderSide(color: AppColors.borderDefault),
                ),
                title: Text(
                  j.customerName ?? j.serviceType,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13.5,
                  ),
                ),
                subtitle: Text(
                  '${j.serviceType} · ${DateFormat('HH:mm').format(j.scheduledAt!)} · ${jobStatusLabelTr(j.status)}',
                  style: const TextStyle(fontSize: 12),
                ),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => JobDetailScreen(jobId: j.id),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
