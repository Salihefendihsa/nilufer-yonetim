class AppNotification {
  final String id;
  final String title;
  final String? body;
  final String? type;
  final String? relatedType;
  final String? relatedId;
  final String? readAt;
  final String createdAt;

  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.relatedType,
    required this.relatedId,
    required this.readAt,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as String,
        title: json['title'] as String,
        body: json['body'] as String?,
        type: json['type'] as String?,
        relatedType: json['relatedType'] as String?,
        relatedId: json['relatedId'] as String?,
        readAt: json['readAt'] as String?,
        createdAt: json['createdAt'] as String,
      );
}
