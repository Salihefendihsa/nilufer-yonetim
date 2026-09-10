import '../../core/api_client.dart';
import '../../models/app_notification.dart';
import '../../models/paginated.dart';

class NotificationsApi {
  final _api = ApiClient.instance;

  Future<Paginated<AppNotification>> list({
    int page = 1,
    String? status,
  }) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/notifications',
      query: {'page': page, 'limit': 30, if (status != null) 'status': status},
    );
    return Paginated.fromJson(json, AppNotification.fromJson);
  }

  Future<int> unreadCount() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/notifications/unread-count',
    );
    return json['count'] as int;
  }

  Future<void> markRead(String id) => _api.patch('/notifications/$id/read');
  Future<void> markAllRead() => _api.patch('/notifications/read-all');

  /// web/src/lib/notifications.ts: {total, unread, today, byCategory:
  /// {job, payment, message, alert, other}} — özet kartlar ve "Tip Dağılımı"
  /// için kullanılır.
  Future<NotificationSummary> summary() async {
    final json = await _api.get<Map<String, dynamic>>('/notifications/summary');
    return NotificationSummary.fromJson(json);
  }
}

class NotificationSummary {
  final int total;
  final int unread;
  final int today;
  final Map<String, int> byCategory;

  NotificationSummary({
    required this.total,
    required this.unread,
    required this.today,
    required this.byCategory,
  });

  factory NotificationSummary.fromJson(Map<String, dynamic> json) =>
      NotificationSummary(
        total: json['total'] as int? ?? 0,
        unread: json['unread'] as int? ?? 0,
        today: json['today'] as int? ?? 0,
        byCategory: (json['byCategory'] as Map<String, dynamic>? ?? {}).map(
          (k, v) => MapEntry(k, v as int),
        ),
      );
}
