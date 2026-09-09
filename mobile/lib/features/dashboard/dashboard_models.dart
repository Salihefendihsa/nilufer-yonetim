/// backend/src/controllers/dashboardController.ts:getDashboardSummary yanıtıyla birebir.
class DashboardSummary {
  final int todaysJobsCount;
  final double thisMonthPaymentsTotal;
  final int newQuoteRequestsCount;
  final int activeStaffCount;
  final int completedJobsThisMonth;

  // --- Müdür paneli alanları (mevcut alanlar korunarak eklendi) ---
  /// Bugünkü işlerin durum kırılımı: {'PENDING': 2, 'SCHEDULED': 5, ...}
  final Map<String, int> todaysJobsByStatus;

  /// Bugünkü işlerin hizmet türü kırılımı, çoktan aza sıralı.
  final List<ServiceBreakdownEntry> todaysServiceBreakdown;

  /// Personelin durum kırılımı: {'AVAILABLE': 3, 'ON_JOB': 7, ...}
  final Map<String, int> staffByStatus;
  final int staffOnJobCount;
  final int completedJobsLastMonth;
  final int cancelledJobsThisMonth;

  /// tamamlanan / (tamamlanan + iptal). Bu ay hiç sonuçlanan iş yoksa null —
  /// uydurma bir yüzde gösterilmez.
  final double? completionRateThisMonth;

  /// Onay bekleyen saha raporu sayısı.
  final int pendingReportApprovals;

  DashboardSummary({
    required this.todaysJobsCount,
    required this.thisMonthPaymentsTotal,
    required this.newQuoteRequestsCount,
    required this.activeStaffCount,
    required this.completedJobsThisMonth,
    this.todaysJobsByStatus = const {},
    this.todaysServiceBreakdown = const [],
    this.staffByStatus = const {},
    this.staffOnJobCount = 0,
    this.completedJobsLastMonth = 0,
    this.cancelledJobsThisMonth = 0,
    this.completionRateThisMonth,
    this.pendingReportApprovals = 0,
  });

  static Map<String, int> _intMap(dynamic value) {
    if (value is! Map) return const {};
    return value.map((k, v) => MapEntry(k.toString(), (v as num?)?.toInt() ?? 0));
  }

  factory DashboardSummary.fromJson(Map<String, dynamic> json) =>
      DashboardSummary(
        todaysJobsCount: json['todaysJobsCount'] as int? ?? 0,
        thisMonthPaymentsTotal:
            (json['thisMonthPaymentsTotal'] as num?)?.toDouble() ?? 0,
        newQuoteRequestsCount: json['newQuoteRequestsCount'] as int? ?? 0,
        activeStaffCount: json['activeStaffCount'] as int? ?? 0,
        completedJobsThisMonth: json['completedJobsThisMonth'] as int? ?? 0,
        todaysJobsByStatus: _intMap(json['todaysJobsByStatus']),
        todaysServiceBreakdown:
            (json['todaysServiceBreakdown'] as List<dynamic>? ?? [])
                .map(
                  (e) => ServiceBreakdownEntry.fromJson(
                    e as Map<String, dynamic>,
                  ),
                )
                .toList(),
        staffByStatus: _intMap(json['staffByStatus']),
        staffOnJobCount: json['staffOnJobCount'] as int? ?? 0,
        completedJobsLastMonth: json['completedJobsLastMonth'] as int? ?? 0,
        cancelledJobsThisMonth: json['cancelledJobsThisMonth'] as int? ?? 0,
        completionRateThisMonth:
            (json['completionRateThisMonth'] as num?)?.toDouble(),
        pendingReportApprovals: json['pendingReportApprovals'] as int? ?? 0,
      );
}

class ServiceBreakdownEntry {
  final String serviceType;
  final int count;

  ServiceBreakdownEntry({required this.serviceType, required this.count});

  factory ServiceBreakdownEntry.fromJson(Map<String, dynamic> json) =>
      ServiceBreakdownEntry(
        serviceType: json['serviceType'] as String? ?? '—',
        count: json['count'] as int? ?? 0,
      );
}

/// backend/src/controllers/dashboardController.ts:getActivityFeed ile birebir.
class ActivityEvent {
  final DateTime timestamp;
  final String text;

  ActivityEvent({required this.timestamp, required this.text});

  factory ActivityEvent.fromJson(Map<String, dynamic> json) => ActivityEvent(
    timestamp: DateTime.parse(json['timestamp'] as String),
    text: json['text'] as String,
  );
}

/// Bekleyen onay sayısı — web/bekleyen-onaylar sayfasıyla aynı desen:
/// quotes(status=NEW) + advances(status=PENDING) + contracts/expiring toplamı.
class PendingApprovalsCount {
  final int quotes;
  final int advances;
  final int expiringContracts;

  PendingApprovalsCount({
    required this.quotes,
    required this.advances,
    required this.expiringContracts,
  });

  int get total => quotes + advances + expiringContracts;
}
