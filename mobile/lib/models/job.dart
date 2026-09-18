import 'decimal.dart';

/// backend/prisma/schema.prisma:JobStatus ile birebir (IN_PROGRESS bu oturumda eklendi).
enum JobStatus { pending, scheduled, inProgress, completed, cancelled }

JobStatus jobStatusFromString(String value) {
  switch (value) {
    case 'PENDING':
      return JobStatus.pending;
    case 'SCHEDULED':
      return JobStatus.scheduled;
    case 'IN_PROGRESS':
      return JobStatus.inProgress;
    case 'COMPLETED':
      return JobStatus.completed;
    case 'CANCELLED':
    default:
      return JobStatus.cancelled;
  }
}

String jobStatusToApiString(JobStatus status) {
  switch (status) {
    case JobStatus.pending:
      return 'PENDING';
    case JobStatus.scheduled:
      return 'SCHEDULED';
    case JobStatus.inProgress:
      return 'IN_PROGRESS';
    case JobStatus.completed:
      return 'COMPLETED';
    case JobStatus.cancelled:
      return 'CANCELLED';
  }
}

String jobStatusLabelTr(JobStatus status) {
  switch (status) {
    case JobStatus.pending:
      return 'Bekliyor';
    case JobStatus.scheduled:
      return 'Planlandı';
    case JobStatus.inProgress:
      return 'Devam Ediyor';
    case JobStatus.completed:
      return 'Tamamlandı';
    case JobStatus.cancelled:
      return 'İptal Edildi';
  }
}

/// backend/src/controllers/jobsController.ts:VALID_TRANSITIONS ile birebir —
/// web/src/lib/jobStatus.ts ile de aynı tablo. Üç tarafta da senkron tutulmalı.
const Map<JobStatus, List<JobStatus>> validJobStatusTransitions = {
  JobStatus.pending: [
    JobStatus.pending,
    JobStatus.scheduled,
    JobStatus.inProgress,
    JobStatus.cancelled,
  ],
  JobStatus.scheduled: [
    JobStatus.scheduled,
    JobStatus.pending,
    JobStatus.inProgress,
    JobStatus.cancelled,
  ],
  JobStatus.inProgress: [
    JobStatus.inProgress,
    JobStatus.completed,
    JobStatus.cancelled,
  ],
  JobStatus.completed: [JobStatus.completed],
  JobStatus.cancelled: [JobStatus.cancelled],
};

/// Bölüm N (4. tur): kontrol listesi satırı (lib/checklist.ts şablonu).
class JobChecklistEntry {
  final String item;
  final bool isChecked;
  final String? checkedAt;

  const JobChecklistEntry({
    required this.item,
    required this.isChecked,
    this.checkedAt,
  });

  factory JobChecklistEntry.fromJson(Map<String, dynamic> json) =>
      JobChecklistEntry(
        item: json['item'] as String? ?? '',
        isChecked: json['isChecked'] as bool? ?? false,
        checkedAt: json['checkedAt'] as String?,
      );
}

class Job {
  /// Bölüm O (4. tur): müşteri adresi (+ semt) için Google Maps arama linki;
  /// adres yoksa null (buton gizlenir).
  Uri? get directionsUri {
    final query = [customerAddress, customerDistrict]
        .whereType<String>()
        .where((s) => s.trim().isNotEmpty)
        .join(', ');
    if (query.isEmpty) return null;
    return Uri.https('www.google.com', '/maps/search/', {
      'api': '1',
      'query': query,
    });
  }

  final String id;
  final String customerId;
  final String? assignedStaffId;
  final String serviceType;
  final JobStatus status;
  final DateTime? scheduledAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final String? notes;
  final double? price;
  final int? rating;
  final String? ratingComment;
  /// Bölüm S (5. tur): detaylı geri bildirim gönderildi mi (bir kez).
  final String? feedbackSubmittedAt;
  /// Bölüm Y (6. tur): garanti bitişi; türde tanımlı değilse null.
  final DateTime? warrantyExpiresAt;

  /// Garanti hâlâ geçerliyse kalan gün; değilse null (rozet gizli).
  int? get warrantyDaysLeft {
    final w = warrantyExpiresAt;
    if (w == null) return null;
    final days = w.difference(DateTime.now()).inMinutes / (24 * 60);
    return days > 0 ? days.ceil() : null;
  }
  final String createdAt;
  final String? calendarLink;
  /// Bölüm N (4. tur): iş öncesi kontrol listesi — GET /jobs/:id her zaman
  /// tam şablonu döner; liste uçlarında gelmeyebilir (boş liste).
  final List<JobChecklistEntry> checklist;
  final String? customerName;
  final String? customerPhone;
  final String? customerAddress;
  final String? customerDistrict;
  final String? assignedStaffName;

  // --- Müdür fazı alanları ---
  /// İnsan tarafından okunabilir iş numarası (#1042).
  final int? sequenceNo;

  /// Randevu penceresinin bitişi — Stitch kartlarındaki "09:00 – 11:00".
  final DateTime? scheduledEndAt;
  final DateTime? cancelledAt;
  final String? cancellationReason;

  Job({
    required this.id,
    required this.customerId,
    required this.assignedStaffId,
    required this.serviceType,
    required this.status,
    required this.scheduledAt,
    required this.startedAt,
    required this.completedAt,
    required this.notes,
    required this.price,
    required this.rating,
    required this.ratingComment,
    this.feedbackSubmittedAt,
    this.warrantyExpiresAt,
    required this.createdAt,
    required this.calendarLink,
    this.checklist = const [],
    required this.customerName,
    this.customerPhone,
    this.customerAddress,
    this.customerDistrict,
    required this.assignedStaffName,
    this.sequenceNo,
    this.scheduledEndAt,
    this.cancelledAt,
    this.cancellationReason,
  });

  /// Gerçek çalışma süresi — yalnızca hem startedAt hem completedAt doluysa
  /// hesaplanır (bkz. backend timestampsForTransition: eksik başlangıç
  /// geriye dönük doldurulmaz, bu yüzden burada da sıfıra yakın sahte süre
  /// üretmemek için ikisi de yoksa null döner).
  Duration? get actualDuration {
    if (startedAt == null || completedAt == null) return null;
    return completedAt!.difference(startedAt!);
  }

  factory Job.fromJson(Map<String, dynamic> json) => Job(
    id: json['id'] as String,
    customerId: json['customerId'] as String,
    assignedStaffId: json['assignedStaffId'] as String?,
    serviceType: json['serviceType'] as String,
    status: jobStatusFromString(json['status'] as String),
    scheduledAt: json['scheduledAt'] != null
        ? DateTime.parse(json['scheduledAt'] as String)
        : null,
    startedAt: json['startedAt'] != null
        ? DateTime.parse(json['startedAt'] as String)
        : null,
    completedAt: json['completedAt'] != null
        ? DateTime.parse(json['completedAt'] as String)
        : null,
    notes: json['notes'] as String?,
    price: decimalOrNull(json['price']),
    rating: json['rating'] as int?,
    feedbackSubmittedAt: json['feedbackSubmittedAt'] as String?,
    warrantyExpiresAt: json['warrantyExpiresAt'] != null
        ? DateTime.parse(json['warrantyExpiresAt'] as String)
        : null,
    ratingComment: json['ratingComment'] as String?,
    createdAt: json['createdAt'] as String,
    calendarLink: json['calendarLink'] as String?,
    checklist: ((json['checklist'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(JobChecklistEntry.fromJson)
        .toList(),
    customerName:
        (json['customer'] as Map<String, dynamic>?)?['fullName'] as String?,
    customerPhone:
        (json['customer'] as Map<String, dynamic>?)?['phone'] as String?,
    customerAddress:
        (json['customer'] as Map<String, dynamic>?)?['address'] as String?,
    customerDistrict:
        (json['customer'] as Map<String, dynamic>?)?['district'] as String?,
    assignedStaffName:
        ((json['assignedStaff'] as Map<String, dynamic>?)?['user']
                as Map<String, dynamic>?)?['fullName']
            as String?,
    sequenceNo: (json['sequenceNo'] as num?)?.toInt(),
    scheduledEndAt: json['scheduledEndAt'] != null
        ? DateTime.parse(json['scheduledEndAt'] as String)
        : null,
    cancelledAt: json['cancelledAt'] != null
        ? DateTime.parse(json['cancelledAt'] as String)
        : null,
    cancellationReason: json['cancellationReason'] as String?,
  );
}
