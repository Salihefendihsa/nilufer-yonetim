import 'decimal.dart';

/// Bölüm AM (9. tur): backend/prisma/schema.prisma:ProductBatch — kimyasal
/// parti (lot) + son kullanma tarihi. `daysLeft`/`isExpired` sunucuda
/// hesaplanır (lib/productBatches.ts:decorateBatch).
class ProductBatch {
  final String id;
  final String productId;
  final String batchNumber;
  final String expiryDate;
  final double quantityReceived;
  final double quantityRemaining;
  final String receivedAt;
  final int daysLeft;
  final bool isExpired;
  final String? supplierName;
  final String? productName;
  final String? productUnit;

  ProductBatch({
    required this.id,
    required this.productId,
    required this.batchNumber,
    required this.expiryDate,
    required this.quantityReceived,
    required this.quantityRemaining,
    required this.receivedAt,
    required this.daysLeft,
    required this.isExpired,
    this.supplierName,
    this.productName,
    this.productUnit,
  });

  factory ProductBatch.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>?;
    return ProductBatch(
      id: json['id'] as String,
      productId: json['productId'] as String,
      batchNumber: json['batchNumber'] as String,
      expiryDate: json['expiryDate'] as String,
      quantityReceived: decimalOr(json['quantityReceived']),
      quantityRemaining: decimalOr(json['quantityRemaining']),
      receivedAt: json['receivedAt'] as String,
      daysLeft: (json['daysLeft'] as num?)?.toInt() ?? 0,
      isExpired: json['isExpired'] == true,
      supplierName:
          (json['supplier'] as Map<String, dynamic>?)?['name'] as String?,
      productName: product?['name'] as String?,
      productUnit: product?['unit'] as String?,
    );
  }

  bool get isDepleted => quantityRemaining <= 0;

  /// Web `batchTone` ile aynı eşikler: dolmuş/≤7 gün kırmızı, ≤30 sarı, aksi yeşil.
  BatchTone get tone {
    if (isExpired || daysLeft <= 7) return BatchTone.red;
    if (daysLeft <= 30) return BatchTone.yellow;
    return BatchTone.green;
  }

  String get expiryLabel {
    if (isExpired) return 'Süresi ${daysLeft.abs()} gün önce doldu';
    if (daysLeft == 0) return 'Bugün son gün';
    return '$daysLeft gün kaldı';
  }
}

enum BatchTone { red, yellow, green }
