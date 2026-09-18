/// Bölüm K (3. tur): backend/prisma/schema.prisma → StaffUnavailability.
/// `startTime`/`endTime` ("HH:mm") null ise tüm gün.
class StaffUnavailability {
  final String id;
  final String staffId;
  /// YYYY-MM-DD
  final String date;
  final String? startTime;
  final String? endTime;
  final String? reason;

  const StaffUnavailability({
    required this.id,
    required this.staffId,
    required this.date,
    this.startTime,
    this.endTime,
    this.reason,
  });

  factory StaffUnavailability.fromJson(Map<String, dynamic> json) {
    return StaffUnavailability(
      id: json['id'] as String,
      staffId: json['staffId'] as String,
      // /staff/unavailability?date= yanıtında satır başına date yok — çağıran doldurur.
      date: (json['date'] as String?) ?? '',
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
      reason: json['reason'] as String?,
    );
  }

  bool get isAllDay => startTime == null || endTime == null;

  /// "Tüm gün" veya "13:00 – 17:00".
  String get rangeLabel => isAllDay ? 'Tüm gün' : '$startTime – $endTime';
}
