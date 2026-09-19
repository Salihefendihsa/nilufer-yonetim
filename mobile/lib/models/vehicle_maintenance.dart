/// Bölüm AQ (9. tur): backend/prisma/schema.prisma:VehicleMaintenance —
/// zimmetli araç bakım/muayene kaydı. daysLeft/isOverdue sunucuda hesaplanır.
class VehicleMaintenance {
  final String id;
  final String staffId;
  final String maintenanceType; // INSPECTION | OIL_CHANGE | TIRE | OTHER
  final String lastServiceDate;
  final String nextDueDate;
  final String? note;
  final int daysLeft;
  final bool isOverdue;

  const VehicleMaintenance({
    required this.id,
    required this.staffId,
    required this.maintenanceType,
    required this.lastServiceDate,
    required this.nextDueDate,
    required this.daysLeft,
    required this.isOverdue,
    this.note,
  });

  factory VehicleMaintenance.fromJson(Map<String, dynamic> json) => VehicleMaintenance(
    id: json['id'] as String,
    staffId: json['staffId'] as String,
    maintenanceType: json['maintenanceType'] as String,
    lastServiceDate: json['lastServiceDate'] as String,
    nextDueDate: json['nextDueDate'] as String,
    note: json['note'] as String?,
    daysLeft: (json['daysLeft'] as num?)?.toInt() ?? 0,
    isOverdue: json['isOverdue'] == true,
  );

  String get dueLabel {
    if (isOverdue) return '${daysLeft.abs()} gün gecikti';
    if (daysLeft == 0) return 'Bugün';
    return '$daysLeft gün kaldı';
  }
}

const vehicleMaintenanceTypes = ['INSPECTION', 'OIL_CHANGE', 'TIRE', 'OTHER'];

String vehicleMaintenanceTypeLabel(String type) {
  switch (type) {
    case 'INSPECTION':
      return 'Muayene';
    case 'OIL_CHANGE':
      return 'Yağ Değişimi';
    case 'TIRE':
      return 'Lastik';
    default:
      return 'Diğer';
  }
}
