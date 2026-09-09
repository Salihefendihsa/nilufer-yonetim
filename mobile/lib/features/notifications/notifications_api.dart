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
}
