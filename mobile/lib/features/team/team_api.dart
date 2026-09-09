import '../../core/api_client.dart';
import '../../models/decimal.dart';

/// GET /team/summary — şef ana sayfası. Kapsam sunucuda `getTeamStaffIds` ile
/// tek seviyeli ekibe sınırlanır; şirket geneli özet (/dashboard/summary)
/// TEAM_LEAD'e KAPALIDIR ve burada kullanılmaz.
class TeamSummary {
  final int teamSize;
  final int todaysJobsCount;
  final Map<String, int> todaysJobsByStatus;
  final int completedTodayCount;

  /// Bugün hiç iş yoksa null — "%0" uydurulmaz.
  final double? completionRateToday;
  final int activeTechnicianCount;
  final List<TeamWorkloadEntry> workload;

  TeamSummary({
    required this.teamSize,
    required this.todaysJobsCount,
    required this.todaysJobsByStatus,
    required this.completedTodayCount,
    required this.completionRateToday,
    required this.activeTechnicianCount,
    required this.workload,
  });

  factory TeamSummary.fromJson(Map<String, dynamic> json) => TeamSummary(
    teamSize: json['teamSize'] as int? ?? 0,
    todaysJobsCount: json['todaysJobsCount'] as int? ?? 0,
    todaysJobsByStatus:
        (json['todaysJobsByStatus'] as Map?)?.map(
          (k, v) => MapEntry(k.toString(), (v as num?)?.toInt() ?? 0),
        ) ??
        const {},
    completedTodayCount: json['completedTodayCount'] as int? ?? 0,
    completionRateToday: decimalOrNull(json['completionRateToday']),
    activeTechnicianCount: json['activeTechnicianCount'] as int? ?? 0,
    workload: (json['workload'] as List<dynamic>? ?? [])
        .map((e) => TeamWorkloadEntry.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class TeamWorkloadEntry {
  final String staffId;
  final String fullName;
  final String position;
  final String status;
  final String? vehiclePlate;

  /// Tanımlı değilse doluluk yüzdesi gösterilmez (varsayılan kapasite yok).
  final int? dailyJobCapacity;
  final int todaysJobsCount;

  TeamWorkloadEntry({
    required this.staffId,
    required this.fullName,
    required this.position,
    required this.status,
    required this.vehiclePlate,
    required this.dailyJobCapacity,
    required this.todaysJobsCount,
  });

  factory TeamWorkloadEntry.fromJson(Map<String, dynamic> json) =>
      TeamWorkloadEntry(
        staffId: json['staffId'] as String,
        fullName: json['fullName'] as String? ?? '—',
        position: json['position'] as String? ?? '',
        status: json['status'] as String? ?? 'AVAILABLE',
        vehiclePlate: json['vehiclePlate'] as String?,
        dailyJobCapacity: (json['dailyJobCapacity'] as num?)?.toInt(),
        todaysJobsCount: (json['todaysJobsCount'] as num?)?.toInt() ?? 0,
      );
}

/// GET /team/calendar — aylık yoğunluk + kapasite.
class TeamCalendar {
  final String month;
  final List<TeamCalendarDay> days;

  /// Ekip üyelerinin `dailyJobCapacity` toplamı; hiçbiri tanımlı değilse null.
  final int? dailyCapacity;
  final int todayJobCount;
  final int? todayCapacity;
  final int weekJobCount;
  final int? weekCapacity;
  final TeamCalendarDay? busiestDay;

  TeamCalendar({
    required this.month,
    required this.days,
    required this.dailyCapacity,
    required this.todayJobCount,
    required this.todayCapacity,
    required this.weekJobCount,
    required this.weekCapacity,
    required this.busiestDay,
  });

  factory TeamCalendar.fromJson(Map<String, dynamic> json) {
    final today = json['today'] as Map<String, dynamic>? ?? {};
    final week = json['thisWeek'] as Map<String, dynamic>? ?? {};
    final busiest = json['busiestDay'] as Map<String, dynamic>?;
    return TeamCalendar(
      month: json['month'] as String? ?? '',
      days: (json['days'] as List<dynamic>? ?? [])
          .map((e) => TeamCalendarDay.fromJson(e as Map<String, dynamic>))
          .toList(),
      dailyCapacity: (json['dailyCapacity'] as num?)?.toInt(),
      todayJobCount: (today['jobCount'] as num?)?.toInt() ?? 0,
      todayCapacity: (today['capacity'] as num?)?.toInt(),
      weekJobCount: (week['jobCount'] as num?)?.toInt() ?? 0,
      weekCapacity: (week['capacity'] as num?)?.toInt(),
      busiestDay: busiest != null ? TeamCalendarDay.fromJson(busiest) : null,
    );
  }
}

class TeamCalendarDay {
  final String date;
  final int jobCount;

  TeamCalendarDay({required this.date, required this.jobCount});

  factory TeamCalendarDay.fromJson(Map<String, dynamic> json) =>
      TeamCalendarDay(
        date: json['date'] as String,
        jobCount: (json['jobCount'] as num?)?.toInt() ?? 0,
      );
}

class TeamApi {
  final _api = ApiClient.instance;

  Future<TeamSummary> summary() async {
    final json = await _api.get<Map<String, dynamic>>('/team/summary');
    return TeamSummary.fromJson(json);
  }

  /// [month] biçimi `YYYY-MM`; verilmezse içinde bulunulan ay.
  Future<TeamCalendar> calendar({String? month}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/team/calendar',
      query: {if (month != null) 'month': month},
    );
    return TeamCalendar.fromJson(json);
  }
}
