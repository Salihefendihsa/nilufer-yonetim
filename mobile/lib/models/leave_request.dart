/// backend/prisma/schema.prisma: LeaveRequest.
class LeaveRequest {
  final String id;
  final String staffId;
  final String startDate;
  final String endDate;
  final String reason;
  final String status; // PENDING | APPROVED | REJECTED
  final String requestedAt;
  final String? decidedAt;
  final String? decisionNote;
  final String? staffName;
  /// Bölüm AH (8. tur): liste/decide yanıtında bakiye bilgisi (yalnızca bekleyenlerde bayrak).
  final int? requestedDays;
  final int? remainingDays;
  final bool exceedsBalance;

  LeaveRequest({
    required this.id,
    required this.staffId,
    required this.startDate,
    required this.endDate,
    required this.reason,
    required this.status,
    required this.requestedAt,
    this.decidedAt,
    this.decisionNote,
    this.staffName,
    this.requestedDays,
    this.remainingDays,
    this.exceedsBalance = false,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    final staff = json['staff'] as Map<String, dynamic>?;
    final user = staff?['user'] as Map<String, dynamic>?;
    return LeaveRequest(
      id: json['id'] as String,
      staffId: json['staffId'] as String,
      startDate: json['startDate'] as String,
      endDate: json['endDate'] as String,
      reason: json['reason'] as String,
      status: json['status'] as String,
      requestedAt: json['requestedAt'] as String,
      decidedAt: json['decidedAt'] as String?,
      decisionNote: json['decisionNote'] as String?,
      staffName: user?['fullName'] as String?,
      requestedDays: (json['requestedDays'] as num?)?.toInt(),
      remainingDays: (json['remainingDays'] as num?)?.toInt(),
      exceedsBalance: json['exceedsBalance'] == true,
    );
  }
}
