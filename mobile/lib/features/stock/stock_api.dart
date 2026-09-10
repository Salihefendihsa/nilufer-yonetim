import '../../core/api_client.dart';
import '../../models/paginated.dart';
import '../../models/product.dart';

class StockApi {
  final _api = ApiClient.instance;

  Future<Paginated<Product>> list({
    int page = 1,
    String? search,
    ProductCategory? category,
  }) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/products',
      query: {
        'page': page,
        'limit': 30,
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null) 'category': productCategoryToApiString(category),
      },
    );
    return Paginated.fromJson(json, Product.fromJson);
  }

  Future<Product> create({
    String? code,
    String? description,
    required String name,
    required String unit,
    required ProductCategory category,
    required double currentStock,
    required double criticalThreshold,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/products',
      body: {
        if (code != null && code.isNotEmpty) 'code': code,
        if (description != null && description.isNotEmpty)
          'description': description,
        'name': name,
        'unit': unit,
        'category': productCategoryToApiString(category),
        'currentStock': currentStock,
        'criticalThreshold': criticalThreshold,
      },
    );
    return Product.fromJson(json);
  }

  /// backend/src/routes/products.ts: PATCH /:id — stok miktarı (`currentStock`)
  /// buradan DEĞİŞTİRİLEMEZ (yalnızca restock/count uçlarından) — web'in
  /// `ProductFormModal`'ıyla aynı kısıt.
  Future<Product> update(
    String id, {
    String? code,
    String? description,
    required String name,
    required String unit,
    required ProductCategory category,
    required double criticalThreshold,
  }) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/products/$id',
      body: {
        'code': code != null && code.isNotEmpty ? code : null,
        'description': description != null && description.isNotEmpty
            ? description
            : null,
        'name': name,
        'unit': unit,
        'category': productCategoryToApiString(category),
        'criticalThreshold': criticalThreshold,
      },
    );
    return Product.fromJson(json);
  }

  Future<Product> restock(String id, double quantity, {String? note}) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/products/$id/restock',
      body: {
        'quantity': quantity,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    return Product.fromJson(json);
  }

  Future<void> delete(String id) => _api.delete('/products/$id');

  /// Fiili sayim mutabakati. Fark pozitifse IN, negatifse OUT yonunde tek bir
  /// stok hareketi olusturulur ve stok sayilan degere esitlenir. Fark yoksa
  /// backend hicbir kayit yazmaz ve `adjusted: false` doner.
  Future<({bool adjusted, double difference})> adjustCount(
    String productId,
    double countedQuantity,
  ) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/products/$productId/count',
      body: {'countedQuantity': countedQuantity},
    );
    return (
      adjusted: json['adjusted'] == true,
      difference: (json['difference'] as num?)?.toDouble() ?? 0,
    );
  }

  Future<Paginated<StockMovement>> movements(
    String productId, {
    int page = 1,
  }) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/products/$productId/movements',
      query: {'page': page, 'limit': 20},
    );
    return Paginated.fromJson(json, StockMovement.fromJson);
  }

  // --- Satın alma (ikmal) talepleri ---

  Future<List<StockPurchaseRequest>> pendingPurchaseRequests() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/products/purchase-requests',
      query: {'status': 'PENDING', 'limit': 50},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(StockPurchaseRequest.fromJson)
        .toList();
  }

  /// Talep oluşturur — stok bu aşamada ARTMAZ, mal kabulünde artar.
  Future<void> createPurchaseRequest(
    String productId,
    double quantity, {
    String? note,
  }) => _api.post('/products/$productId/purchase-requests', body: {
    'quantity': quantity,
    if (note != null && note.isNotEmpty) 'note': note,
  });

  /// status: RECEIVED (mal kabul, stoğu artırır) veya CANCELLED.
  Future<void> resolvePurchaseRequest(String id, String status) =>
      _api.patch('/products/purchase-requests/$id', body: {'status': status});
}
