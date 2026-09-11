import 'decimal.dart';

enum ProductCategory { biocidal, consumable, equipment, disinfectant }

ProductCategory productCategoryFromString(String value) {
  switch (value) {
    case 'CONSUMABLE':
      return ProductCategory.consumable;
    case 'EQUIPMENT':
      return ProductCategory.equipment;
    case 'DISINFECTANT':
      return ProductCategory.disinfectant;
    case 'BIOCIDAL':
    default:
      return ProductCategory.biocidal;
  }
}

String productCategoryToApiString(ProductCategory c) {
  switch (c) {
    case ProductCategory.biocidal:
      return 'BIOCIDAL';
    case ProductCategory.consumable:
      return 'CONSUMABLE';
    case ProductCategory.equipment:
      return 'EQUIPMENT';
    case ProductCategory.disinfectant:
      return 'DISINFECTANT';
  }
}

String productCategoryLabelTr(ProductCategory c) {
  switch (c) {
    case ProductCategory.biocidal:
      return 'Kimyasal';
    case ProductCategory.consumable:
      return 'Sarf Malzemesi';
    case ProductCategory.equipment:
      return 'Ekipman';
    case ProductCategory.disinfectant:
      return 'Dezenfektan';
  }
}

class Product {
  final String id;
  final String? code;
  final String name;
  final String? description;
  final String unit;
  final ProductCategory category;
  final double currentStock;
  final double criticalThreshold;

  /// Liste yanıtında sunucu tarafında eklenir (ürün başına ek istek yok).
  final StockMovement? lastMovement;

  /// Henüz mal kabulü yapılmamış satın alma taleplerinin toplam miktarı.
  final double pendingPurchaseQuantity;

  Product({
    required this.id,
    required this.name,
    required this.unit,
    required this.category,
    required this.currentStock,
    required this.criticalThreshold,
    this.code,
    this.description,
    this.lastMovement,
    this.pendingPurchaseQuantity = 0,
  });

  bool get isCritical => currentStock <= criticalThreshold;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
    id: json['id'] as String,
    code: json['code'] as String?,
    name: json['name'] as String,
    description: json['description'] as String?,
    unit: json['unit'] as String,
    category: productCategoryFromString(
      json['category'] as String? ?? 'BIOCIDAL',
    ),
    currentStock: decimalOr(json['currentStock']),
    criticalThreshold: decimalOr(json['criticalThreshold']),
    lastMovement: json['lastMovement'] != null
        ? StockMovement.fromJson(json['lastMovement'] as Map<String, dynamic>)
        : null,
    pendingPurchaseQuantity:
        decimalOr(json['pendingPurchaseQuantity']),
  );
}

/// backend/prisma/schema.prisma:StockPurchaseRequest
class StockPurchaseRequest {
  final String id;
  final String productId;
  final double quantity;
  final String status; // PENDING | RECEIVED | CANCELLED
  final String? note;
  final String createdAt;
  final String? productName;
  final String? productUnit;
  final String? requestedByName;
  final String? supplierId;
  final String? supplierName;
  final String? orderTrackingNumber;

  StockPurchaseRequest({
    required this.id,
    required this.productId,
    required this.quantity,
    required this.status,
    required this.note,
    required this.createdAt,
    this.productName,
    this.productUnit,
    this.requestedByName,
    this.supplierId,
    this.supplierName,
    this.orderTrackingNumber,
  });

  factory StockPurchaseRequest.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>?;
    final supplier = json['supplier'] as Map<String, dynamic>?;
    return StockPurchaseRequest(
      id: json['id'] as String,
      productId: json['productId'] as String,
      quantity: decimalOr(json['quantity']),
      status: json['status'] as String,
      note: json['note'] as String?,
      createdAt: json['createdAt'] as String,
      productName: product?['name'] as String?,
      productUnit: product?['unit'] as String?,
      requestedByName:
          (json['requestedBy'] as Map<String, dynamic>?)?['fullName'] as String?,
      supplierId: supplier?['id'] as String?,
      supplierName: supplier?['name'] as String?,
      orderTrackingNumber: json['orderTrackingNumber'] as String?,
    );
  }
}

class Supplier {
  final String id;
  final String name;
  final String? contactPerson;
  final String? phone;
  final String? email;
  final String? address;
  final bool isActive;

  Supplier({
    required this.id,
    required this.name,
    this.contactPerson,
    this.phone,
    this.email,
    this.address,
    required this.isActive,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) => Supplier(
    id: json['id'] as String,
    name: json['name'] as String,
    contactPerson: json['contactPerson'] as String?,
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    address: json['address'] as String?,
    isActive: json['isActive'] as bool? ?? true,
  );
}

class StockMovement {
  final String id;
  final String type; // IN | OUT
  final double quantity;
  final String? note;
  final String createdAt;

  StockMovement({
    required this.id,
    required this.type,
    required this.quantity,
    required this.note,
    required this.createdAt,
  });

  factory StockMovement.fromJson(Map<String, dynamic> json) => StockMovement(
    id: json['id'] as String,
    type: json['type'] as String,
    quantity: decimalOr(json['quantity']),
    note: json['note'] as String?,
    createdAt: json['createdAt'] as String,
  );
}
