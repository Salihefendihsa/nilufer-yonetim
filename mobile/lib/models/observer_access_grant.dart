/// backend/prisma/schema.prisma: ObserverAccessGrant — OWNER'ın Gözlemci
/// Modu'na (GET /conversations/all) erişebilmesi için gerekli, gerekçeli ve
/// süreli (veya acil durumda süresiz) izin kaydı.
class ObserverAccessGrant {
  final String id;
  final String reason;
  final String? expiresAt;
  final bool isEmergency;
  final String createdAt;

  ObserverAccessGrant({
    required this.id,
    required this.reason,
    this.expiresAt,
    required this.isEmergency,
    required this.createdAt,
  });

  factory ObserverAccessGrant.fromJson(Map<String, dynamic> json) =>
      ObserverAccessGrant(
        id: json['id'] as String,
        reason: json['reason'] as String,
        expiresAt: json['expiresAt'] as String?,
        isEmergency: json['isEmergency'] as bool? ?? false,
        createdAt: json['createdAt'] as String,
      );
}
