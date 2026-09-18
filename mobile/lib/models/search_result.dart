/// Bölüm I (3. tur): GET /search yanıtındaki normalize sonuç satırı.
/// `route` web paneline özgü bir yoldur; mobil hedef ekranı `type` + `id`
/// üzerinden türetir (bkz. features/search/search_screen.dart).
enum SearchResultType { customer, job, staff, contract, quote, unknown }

SearchResultType searchResultTypeFromString(String? value) {
  switch (value) {
    case 'customer':
      return SearchResultType.customer;
    case 'job':
      return SearchResultType.job;
    case 'staff':
      return SearchResultType.staff;
    case 'contract':
      return SearchResultType.contract;
    case 'quote':
      return SearchResultType.quote;
    default:
      return SearchResultType.unknown;
  }
}

String searchResultTypeLabelTr(SearchResultType type) {
  switch (type) {
    case SearchResultType.customer:
      return 'Müşteri';
    case SearchResultType.job:
      return 'İş';
    case SearchResultType.staff:
      return 'Personel';
    case SearchResultType.contract:
      return 'Sözleşme';
    case SearchResultType.quote:
      return 'Teklif';
    case SearchResultType.unknown:
      return 'Diğer';
  }
}

class SearchResult {
  final SearchResultType type;
  final String id;
  final String title;
  final String subtitle;
  final String route;

  const SearchResult({
    required this.type,
    required this.id,
    required this.title,
    required this.subtitle,
    required this.route,
  });

  factory SearchResult.fromJson(Map<String, dynamic> json) {
    return SearchResult(
      type: searchResultTypeFromString(json['type'] as String?),
      id: json['id'] as String,
      title: (json['title'] as String?) ?? '',
      subtitle: (json['subtitle'] as String?) ?? '',
      route: (json['route'] as String?) ?? '',
    );
  }
}

class SearchResponse {
  final String query;
  final List<SearchResult> results;

  const SearchResponse({required this.query, required this.results});

  factory SearchResponse.fromJson(Map<String, dynamic> json) {
    final raw = (json['results'] as List<dynamic>?) ?? const [];
    return SearchResponse(
      query: (json['query'] as String?) ?? '',
      results: raw
          .map((e) => SearchResult.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  /// Sonuçları türe göre, sabit sırayla gruplar (boş gruplar atlanır).
  Map<SearchResultType, List<SearchResult>> grouped() {
    final map = <SearchResultType, List<SearchResult>>{};
    for (final type in SearchResultType.values) {
      final items = results.where((r) => r.type == type).toList();
      if (items.isNotEmpty) map[type] = items;
    }
    return map;
  }
}
