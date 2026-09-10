import 'decimal.dart';

enum StaffStatus { available, onJob, onBreak, onLeave, offline }

StaffStatus staffStatusFromString(String value) {
  switch (value) {
    case 'ON_JOB':
      return StaffStatus.onJob;
    case 'ON_BREAK':
      return StaffStatus.onBreak;
    case 'ON_LEAVE':
      return StaffStatus.onLeave;
    case 'OFFLINE':
      return StaffStatus.offline;
    case 'AVAILABLE':
    default:
      return StaffStatus.available;
  }
}

String staffStatusToApiString(StaffStatus status) {
  switch (status) {
    case StaffStatus.available:
      return 'AVAILABLE';
    case StaffStatus.onJob:
      return 'ON_JOB';
    case StaffStatus.onBreak:
      return 'ON_BREAK';
    case StaffStatus.onLeave:
      return 'ON_LEAVE';
    case StaffStatus.offline:
      return 'OFFLINE';
  }
}

String staffStatusLabelTr(StaffStatus status) {
  switch (status) {
    case StaffStatus.available:
      return 'Müsait';
    case StaffStatus.onJob:
      return 'Görevde';
    case StaffStatus.onBreak:
      return 'Molada';
    case StaffStatus.onLeave:
      return 'İzinli';
    case StaffStatus.offline:
      return 'Çevrimdışı';
  }
}

/// backend/src/controllers/staffController.ts:SELF_SERVICE_STAFF_STATUSES ile
/// birebir — personel kendi durumunu yalnızca bunlara ayarlayabilir; ON_LEAVE
/// (izin, onay gerektirir) ve ON_JOB (sistem türetir) burada YOK.
const List<StaffStatus> selfServiceStaffStatuses = [
  StaffStatus.available,
  StaffStatus.onBreak,
  StaffStatus.offline,
];

class Staff {
  final String id;
  final String userId;
  final String position;
  final double salaryBase;
  final String? supervisorId;
  final StaffStatus status;
  final DateTime? statusUntil;
  final String createdAt;
  final String fullName;
  final String email;
  final String? phone;
  final String role;

  // --- Mudur fazi alanlari ---
  final String? vehiclePlate;

  /// Gunluk is kapasitesi; tanimli degilse doluluk yuzdesi gosterilmez.
  final int? dailyJobCapacity;

  /// Liste yanitinda sunucu tarafinda hesaplanir (personel basina ek istek yok).
  final int todaysJobsCount;
  final int expiringCertificationCount;
  final double? averageRating;
  final int ratedJobsCount;

  /// backend/src/lib/access.ts:resolveSupervisorInfo — supervisorId bir
  /// Staff.id (TEAM_LEAD) veya User.id (MANAGER/OWNER) olabilir, ikisi de
  /// burada tek bir tutarlı şekle çözülmüş olarak gelir.
  final SupervisorInfo? supervisor;

  Staff({
    required this.id,
    required this.userId,
    required this.position,
    required this.salaryBase,
    required this.supervisorId,
    required this.status,
    required this.statusUntil,
    required this.createdAt,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.role,
    this.vehiclePlate,
    this.dailyJobCapacity,
    this.todaysJobsCount = 0,
    this.expiringCertificationCount = 0,
    this.averageRating,
    this.ratedJobsCount = 0,
    this.supervisor,
  });

  factory Staff.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? {};
    return Staff(
      id: json['id'] as String,
      userId: json['userId'] as String,
      position: json['position'] as String,
      salaryBase: decimalOr(json['salaryBase']),
      supervisorId: json['supervisorId'] as String?,
      status: staffStatusFromString(json['status'] as String? ?? 'AVAILABLE'),
      statusUntil: json['statusUntil'] != null
          ? DateTime.parse(json['statusUntil'] as String)
          : null,
      createdAt: json['createdAt'] as String,
      fullName: user['fullName'] as String? ?? '—',
      email: user['email'] as String? ?? '',
      phone: user['phone'] as String?,
      role: user['role'] as String? ?? 'STAFF',
      vehiclePlate: json['vehiclePlate'] as String?,
      dailyJobCapacity: (json['dailyJobCapacity'] as num?)?.toInt(),
      todaysJobsCount: (json['todaysJobsCount'] as num?)?.toInt() ?? 0,
      expiringCertificationCount:
          (json['expiringCertificationCount'] as num?)?.toInt() ?? 0,
      averageRating: (json['averageRating'] as num?)?.toDouble(),
      ratedJobsCount: (json['ratedJobsCount'] as num?)?.toInt() ?? 0,
      supervisor: json['supervisor'] != null
          ? SupervisorInfo.fromJson(json['supervisor'] as Map<String, dynamic>)
          : null,
    );
  }
}

class SupervisorInfo {
  final String userId;
  final String fullName;
  final String role;

  SupervisorInfo({required this.userId, required this.fullName, required this.role});

  factory SupervisorInfo.fromJson(Map<String, dynamic> json) => SupervisorInfo(
    userId: json['userId'] as String,
    fullName: json['fullName'] as String,
    role: json['role'] as String,
  );
}

class StaffCertification {
  final String id;
  final String staffId;
  final String name;
  final DateTime issuedDate;
  final DateTime expiryDate;
  final String? documentUrl;

  StaffCertification({
    required this.id,
    required this.staffId,
    required this.name,
    required this.issuedDate,
    required this.expiryDate,
    required this.documentUrl,
  });

  factory StaffCertification.fromJson(Map<String, dynamic> json) =>
      StaffCertification(
        id: json['id'] as String,
        staffId: json['staffId'] as String,
        name: json['name'] as String,
        issuedDate: DateTime.parse(json['issuedDate'] as String),
        expiryDate: DateTime.parse(json['expiryDate'] as String),
        documentUrl: json['documentUrl'] as String?,
      );

  int get daysUntilExpiry => expiryDate.difference(DateTime.now()).inDays;
}
