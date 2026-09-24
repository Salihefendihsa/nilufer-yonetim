import 'user.dart';

/// backend/prisma/schema.prisma:StaffRequest — personel → Patron genel talep
/// kanalı (CustomerComplaint'in tersi).
class StaffRequest {
  final String id;
  final String staffUserId;
  final String subject;
  final String description;
  final String category; // EQUIPMENT | SUGGESTION | COMPLAINT | OTHER
  final String status; // OPEN | IN_PROGRESS | RESOLVED | REJECTED
  final String priority; // LOW | MEDIUM | HIGH
  final String? responseNote;
  final String createdAt;
  final String? resolvedAt;
  final String? staffName;
  final AppRole? staffRole;
  final String? respondedByName;

  const StaffRequest({
    required this.id,
    required this.staffUserId,
    required this.subject,
    required this.description,
    required this.category,
    required this.status,
    required this.priority,
    required this.createdAt,
    this.responseNote,
    this.resolvedAt,
    this.staffName,
    this.staffRole,
    this.respondedByName,
  });

  factory StaffRequest.fromJson(Map<String, dynamic> json) {
    final staffUser = json['staffUser'] as Map<String, dynamic>?;
    final role = staffUser?['role'] as String?;
    return StaffRequest(
      id: json['id'] as String,
      staffUserId: json['staffUserId'] as String,
      subject: json['subject'] as String,
      description: json['description'] as String,
      category: json['category'] as String? ?? 'OTHER',
      status: json['status'] as String,
      priority: json['priority'] as String? ?? 'MEDIUM',
      responseNote: json['responseNote'] as String?,
      createdAt: json['createdAt'] as String,
      resolvedAt: json['resolvedAt'] as String?,
      staffName: staffUser?['fullName'] as String?,
      staffRole: role != null ? roleFromString(role) : null,
      respondedByName:
          (json['respondedBy'] as Map<String, dynamic>?)?['fullName']
              as String?,
    );
  }

  bool get isOpen => status == 'OPEN' || status == 'IN_PROGRESS';
  bool get isClosed => status == 'RESOLVED' || status == 'REJECTED';
}

const staffRequestStatusLabels = {
  'OPEN': 'Açık',
  'IN_PROGRESS': 'İşlemde',
  'RESOLVED': 'Çözüldü',
  'REJECTED': 'Reddedildi',
};

const staffRequestCategoryLabels = {
  'EQUIPMENT': 'Ekipman',
  'SUGGESTION': 'Öneri',
  'COMPLAINT': 'Şikayet',
  'OTHER': 'Diğer',
};

const staffRequestPriorityLabels = {
  'LOW': 'Düşük',
  'MEDIUM': 'Orta',
  'HIGH': 'Yüksek',
};
