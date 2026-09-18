import '../../core/api_client.dart';
import '../../models/search_result.dart';

class SearchApi {
  final _api = ApiClient.instance;

  /// GET /search?q= — sunucu 2 karakterden kısa sorguda boş liste döner.
  Future<SearchResponse> search(String query) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/search',
      query: {'q': query},
    );
    return SearchResponse.fromJson(json);
  }
}
