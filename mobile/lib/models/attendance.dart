/// Bölüm AR (9. tur): backend/prisma/schema.prisma:AttendanceRecord —
/// günlük puantaj (gün başına tek kayıt). workedHours sunucuda hesaplanır;
/// çıkış yapılmamışsa null.
class AttendanceRecord {
  final String id;
  final String staffId;
  final String date;
  final String? clockInAt;
  final String? clockOutAt;
  final String? note;
  final double? workedHours;

  const AttendanceRecord({
    required this.id,
    required this.staffId,
    required this.date,
    this.clockInAt,
    this.clockOutAt,
    this.note,
    this.workedHours,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) => AttendanceRecord(
    id: json['id'] as String,
    staffId: json['staffId'] as String,
    date: json['date'] as String,
    clockInAt: json['clockInAt'] as String?,
    clockOutAt: json['clockOutAt'] as String?,
    note: json['note'] as String?,
    workedHours: (json['workedHours'] as num?)?.toDouble(),
  );

  bool get isOpen => clockInAt != null && clockOutAt == null;
  bool get isComplete => clockInAt != null && clockOutAt != null;
}

/// GET /staff/:id/attendance?month= yanıtı.
class AttendanceMonth {
  final String month;
  final double totalHours;
  final int completedDays;
  final int openCount;
  final List<AttendanceRecord> records;

  const AttendanceMonth({
    required this.month,
    required this.totalHours,
    required this.completedDays,
    required this.openCount,
    required this.records,
  });

  factory AttendanceMonth.fromJson(Map<String, dynamic> json) => AttendanceMonth(
    month: json['month'] as String,
    totalHours: (json['totalHours'] as num?)?.toDouble() ?? 0,
    completedDays: (json['completedDays'] as num?)?.toInt() ?? 0,
    openCount: (json['openCount'] as num?)?.toInt() ?? 0,
    records: ((json['data'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(AttendanceRecord.fromJson)
        .toList(),
  );

  /// İstemci tarafı tutarlılık: tamamlanmış kayıtların saat toplamı.
  double get computedTotalHours => records
      .where((r) => r.workedHours != null)
      .fold(0.0, (s, r) => s + r.workedHours!);
}
