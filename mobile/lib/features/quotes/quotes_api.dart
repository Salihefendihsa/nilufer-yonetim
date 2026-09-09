import '../../core/api_client.dart';
import '../../models/paginated.dart';
import '../../models/quote.dart';

class QuotesApi {
  final _api = ApiClient.instance;

  Future<Paginated<QuoteRequest>> list({int page = 1, String? status}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/quotes',
      query: {'page': page, 'limit': 30, if (status != null) 'status': status},
    );
    return Paginated.fromJson(json, QuoteRequest.fromJson);
  }

  Future<QuoteRequest> updateStatus(String id, String status) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/quotes/$id',
      body: {'status': status},
    );
    return QuoteRequest.fromJson(json);
  }

  Future<QuoteRequest> updateAmount(String id, double? amount) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/quotes/$id',
      body: {'amount': amount},
    );
    return QuoteRequest.fromJson(json);
  }

  /// Yonetim notu ve kesif randevusu. Bos string -> null (alan temizlenir).
  Future<QuoteRequest> updateDetails(
    String id, {
    String? note,
    DateTime? surveyAt,
    bool clearSurvey = false,
  }) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/quotes/$id',
      body: {
        if (note != null) 'note': note.isEmpty ? null : note,
        if (clearSurvey)
          'surveyAt': null
        else if (surveyAt != null)
          'surveyAt': surveyAt.toIso8601String(),
      },
    );
    return QuoteRequest.fromJson(json);
  }

  Future<QuotesSummary> summary() async {
    final json = await _api.get<Map<String, dynamic>>('/quotes/summary');
    return QuotesSummary.fromJson(json);
  }

  /// Yalnizca bu teklife ait denetim kayitlari (GET /quotes/:id/history).
  /// `/audit-logs` isletme sahibine kisitli kalir.
  Future<List<QuoteHistoryEntry>> history(String id) async {
    final json = await _api.get<Map<String, dynamic>>('/quotes/$id/history');
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(QuoteHistoryEntry.fromJson)
        .toList();
  }

  Future<void> convert(String id) => _api.post('/quotes/$id/convert');
}
