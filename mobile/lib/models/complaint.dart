/// Bölüm AO (9. tur): backend/prisma/schema.prisma:CustomerComplaint —
/// müşteri şikayet/sorun bildirimi (Job.rating'den ayrı, çözüm takipli).
class CustomerComplaint {
  final String id;
  final String customerId;
  final String? jobId;
  final String subject;
  final String description;
  final String status; // OPEN | IN_PROGRESS | RESOLVED | CLOSED
  final String priority; // LOW | MEDIUM | HIGH
  final String? assignedToUserId;
  final String? assignedToName;
  final String? resolutionNote;
  final String createdAt;
  final String? resolvedAt;
  final String? customerName;
  final int? jobSequenceNo;
  final String? jobServiceType;

  const CustomerComplaint({
    required this.id,
    required this.customerId,
    required this.subject,
    required this.description,
    required this.status,
    required this.priority,
    required this.createdAt,
    this.jobId,
    this.assignedToUserId,
    this.assignedToName,
    this.resolutionNote,
    this.resolvedAt,
    this.customerName,
    this.jobSequenceNo,
    this.jobServiceType,
  });

  factory CustomerComplaint.fromJson(Map<String, dynamic> json) {
    final job = json['job'] as Map<String, dynamic>?;
    return CustomerComplaint(
      id: json['id'] as String,
      customerId: json['customerId'] as String,
      jobId: json['jobId'] as String?,
      subject: json['subject'] as String,
      description: json['description'] as String,
      status: json['status'] as String,
      priority: json['priority'] as String? ?? 'MEDIUM',
      assignedToUserId: json['assignedToUserId'] as String?,
      assignedToName:
          (json['assignedTo'] as Map<String, dynamic>?)?['fullName'] as String?,
      resolutionNote: json['resolutionNote'] as String?,
      createdAt: json['createdAt'] as String,
      resolvedAt: json['resolvedAt'] as String?,
      customerName:
          (json['customer'] as Map<String, dynamic>?)?['fullName'] as String?,
      jobSequenceNo: (job?['sequenceNo'] as num?)?.toInt(),
      jobServiceType: job?['serviceType'] as String?,
    );
  }

  bool get isOpen => status == 'OPEN' || status == 'IN_PROGRESS';
  bool get isResolved => status == 'RESOLVED' || status == 'CLOSED';
}

const complaintStatusLabels = {
  'OPEN': 'Açık',
  'IN_PROGRESS': 'İşlemde',
  'RESOLVED': 'Çözüldü',
  'CLOSED': 'Kapatıldı',
};

const complaintPriorityLabels = {
  'LOW': 'Düşük',
  'MEDIUM': 'Orta',
  'HIGH': 'Yüksek',
};
