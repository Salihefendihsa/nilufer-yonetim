import '../../core/api_client.dart';

/// Bölüm Z (6. tur): GET /jobs/suggest-staff satırı — öneri, otomatik atama değil.
class StaffSuggestion {
  final String staffId;
  final String fullName;
  final int todayJobCount;
  final bool isUnavailable;
  final String? unavailableReason;
  final bool isRecommended;

  const StaffSuggestion({
    required this.staffId,
    required this.fullName,
    required this.todayJobCount,
    required this.isUnavailable,
    required this.isRecommended,
    this.unavailableReason,
  });

  factory StaffSuggestion.fromJson(Map<String, dynamic> json) => StaffSuggestion(
        staffId: json['staffId'] as String,
        fullName: json['fullName'] as String? ?? '—',
        todayJobCount: (json['todayJobCount'] as num?)?.toInt() ?? 0,
        isUnavailable: json['isUnavailable'] as bool? ?? false,
        unavailableReason: json['unavailableReason'] as String?,
        isRecommended: json['isRecommended'] as bool? ?? false,
      );

  /// Dropdown alt etiketi: "Bugün 2 iş" (+ ⚠ neden).
  String get hint => 'Bugün $todayJobCount iş${isUnavailable ? ' · ⚠ ${unavailableReason ?? 'müsait değil'}' : ''}';
}

class StaffSuggestionApi {
  final _api = ApiClient.instance;

  /// [date] yyyy-MM-dd, [time] HH:mm (opsiyonel).
  Future<List<StaffSuggestion>> suggest(String date, {String? time}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/jobs/suggest-staff',
      query: {'date': date, 'time': ?time},
    );
    return ((json['data'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(StaffSuggestion.fromJson)
        .toList();
  }
}
