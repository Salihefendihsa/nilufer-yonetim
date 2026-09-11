import '../../core/api_client.dart';
import '../../models/observer_access_grant.dart';

/// backend/src/routes/observerAccess.ts — yalnızca OWNER.
class ObserverAccessApi {
  final _api = ApiClient.instance;

  Future<ObserverAccessGrant?> getCurrent() async {
    final json = await _api.get<Map<String, dynamic>>('/observer-access/current');
    final data = json['data'] as Map<String, dynamic>?;
    return data == null ? null : ObserverAccessGrant.fromJson(data);
  }

  /// [duration] "1h" | "1d" | "1w" olabilir; [isEmergency] true ise ikisi de
  /// gerekli değildir (sınırsız erişim, ama gerekçe hâlâ zorunlu).
  Future<ObserverAccessGrant> requestAccess({
    required String reason,
    bool isEmergency = false,
    String? duration,
    DateTime? expiresAt,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/observer-access',
      body: {
        'reason': reason,
        'isEmergency': isEmergency,
        if (!isEmergency && duration != null) 'duration': duration,
        if (!isEmergency && expiresAt != null)
          'expiresAt': expiresAt.toIso8601String(),
      },
    );
    return ObserverAccessGrant.fromJson(json);
  }
}
