/// backend/src/lib/pagination.ts:paginatedResponse ile birebir.
class Pagination {
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  Pagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory Pagination.fromJson(Map<String, dynamic> json) => Pagination(
    page: json['page'] as int,
    limit: json['limit'] as int,
    total: json['total'] as int,
    totalPages: json['totalPages'] as int,
  );
}

class Paginated<T> {
  final List<T> data;
  final Pagination pagination;

  Paginated({required this.data, required this.pagination});

  factory Paginated.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJson,
  ) => Paginated(
    data: (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(fromJson)
        .toList(),
    pagination: Pagination.fromJson(json['pagination'] as Map<String, dynamic>),
  );
}
