/// Bölüm J (3. tur): backend/prisma/schema.prisma → AppointmentRequest.
/// Giriş yapmış müşterinin kendi hesabından açtığı randevu talebi.
class AppointmentRequest {
  final String id;
  final String customerId;
  final String serviceTypeId;
  final String preferredDateStart;
  final String preferredDateEnd;
  final String? note;
  final String status; // PENDING | SCHEDULED | DECLINED
  final String? respondedAt;
  final String? declineReason;
  final String? resultingJobId;
  final String createdAt;
  final String? customerName;
  final String? customerPhone;
  final String? serviceTypeName;
  final String? resultingJobScheduledAt;

  const AppointmentRequest({
    required this.id,
    required this.customerId,
    required this.serviceTypeId,
    required this.preferredDateStart,
    required this.preferredDateEnd,
    required this.status,
    required this.createdAt,
    this.note,
    this.respondedAt,
    this.declineReason,
    this.resultingJobId,
    this.customerName,
    this.customerPhone,
    this.serviceTypeName,
    this.resultingJobScheduledAt,
  });

  factory AppointmentRequest.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>?;
    final serviceType = json['serviceType'] as Map<String, dynamic>?;
    final job = json['resultingJob'] as Map<String, dynamic>?;
    return AppointmentRequest(
      id: json['id'] as String,
      customerId: json['customerId'] as String,
      serviceTypeId: json['serviceTypeId'] as String,
      preferredDateStart: json['preferredDateStart'] as String,
      preferredDateEnd: json['preferredDateEnd'] as String,
      note: json['note'] as String?,
      status: (json['status'] as String?) ?? 'PENDING',
      respondedAt: json['respondedAt'] as String?,
      declineReason: json['declineReason'] as String?,
      resultingJobId: json['resultingJobId'] as String?,
      createdAt: (json['createdAt'] as String?) ?? '',
      customerName: customer?['fullName'] as String?,
      customerPhone: customer?['phone'] as String?,
      serviceTypeName: serviceType?['name'] as String?,
      resultingJobScheduledAt: job?['scheduledAt'] as String?,
    );
  }

  bool get isPending => status == 'PENDING';
}

String appointmentRequestStatusLabelTr(String status) {
  switch (status) {
    case 'SCHEDULED':
      return 'Planlandı';
    case 'DECLINED':
      return 'Reddedildi';
    default:
      return 'Bekliyor';
  }
}
