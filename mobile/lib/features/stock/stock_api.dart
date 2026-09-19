import '../../core/api_client.dart';
import '../../models/paginated.dart';
import '../../models/product.dart';
import '../../models/product_batch.dart';

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

  /// Bölüm AM (9. tur): `batchNumber` + `expiryDate` (YYYY-AA-GG) birlikte
  /// verilirse ProductBatch açılır; ikisi de boşsa eski partisiz giriş.
  Future<Product> restock(
    String id,
    double quantity, {
    String? note,
    String? batchNumber,
    String? expiryDate,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/products/$id/restock',
      body: {
        'quantity': quantity,
        if (note != null && note.isNotEmpty) 'note': note,
        if (batchNumber != null && batchNumber.isNotEmpty)
          'batchNumber': batchNumber,
        if (expiryDate != null && expiryDate.isNotEmpty)
          'expiryDate': expiryDate,
      },
    );
    return Product.fromJson(json);
  }

  /// GET /products/:id/batches — SKT sırasıyla (OWNER/MANAGER).
  Future<List<ProductBatch>> batches(String productId) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/products/$productId/batches',
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(ProductBatch.fromJson)
        .toList();
  }

  /// GET /products/expiring-batches?days= — dolmuş partiler isExpired ile gelir.
  Future<List<ProductBatch>> expiringBatches({int days = 30}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/products/expiring-batches',
      query: {'days': days},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(ProductBatch.fromJson)
        .toList();
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
    String? supplierId,
    String? orderTrackingNumber,
  }) => _api.post('/products/$productId/purchase-requests', body: {
    'quantity': quantity,
    if (note != null && note.isNotEmpty) 'note': note,
    if (supplierId != null && supplierId.isNotEmpty) 'supplierId': supplierId,
    if (orderTrackingNumber != null && orderTrackingNumber.isNotEmpty)
      'orderTrackingNumber': orderTrackingNumber,
  });

  /// status: RECEIVED (mal kabul, stoğu artırır) veya CANCELLED.
  /// Bölüm AM: mal kabulde opsiyonel parti no + SKT.
  Future<void> resolvePurchaseRequest(
    String id,
    String status, {
    String? batchNumber,
    String? expiryDate,
  }) => _api.patch('/products/purchase-requests/$id', body: {
    'status': status,
    if (batchNumber != null && batchNumber.isNotEmpty)
      'batchNumber': batchNumber,
    if (expiryDate != null && expiryDate.isNotEmpty) 'expiryDate': expiryDate,
  });

  // --- Tedarikçiler (Bölüm E) ---

  Future<List<Supplier>> listSuppliers() async {
    final json = await _api.get<Map<String, dynamic>>('/suppliers');
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(Supplier.fromJson)
        .toList();
  }

  Future<Supplier> createSupplier({
    required String name,
    String? contactPerson,
    String? phone,
    String? email,
    String? address,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/suppliers',
      body: {
        'name': name,
        if (contactPerson != null && contactPerson.isNotEmpty)
          'contactPerson': contactPerson,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (email != null && email.isNotEmpty) 'email': email,
        if (address != null && address.isNotEmpty) 'address': address,
      },
    );
    return Supplier.fromJson(json);
  }

  Future<Supplier> updateSupplier(
    String id, {
    String? name,
    String? contactPerson,
    String? phone,
    String? email,
    String? address,
    bool? isActive,
  }) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/suppliers/$id',
      body: {
        if (name != null) 'name': name,
        'contactPerson': contactPerson,
        'phone': phone,
        'email': email,
        'address': address,
        if (isActive != null) 'isActive': isActive,
      },
    );
    return Supplier.fromJson(json);
  }

  Future<void> deleteSupplier(String id) => _api.delete('/suppliers/$id');
}
