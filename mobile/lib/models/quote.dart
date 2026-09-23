import 'decimal.dart';

class QuoteRequest {
  final String id;
  final String fullName;
  final String phone;
  final String? email;
  final String propertyType;
  final String serviceType;
  final String? address;
  final String? district;
  final double? amount;
  final String status;
  final String createdAt;

  // --- Mudur fazi alanlari ---
  final String? note;
  final DateTime? surveyAt;
  final DateTime? convertedAt;

  QuoteRequest({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.email,
    required this.propertyType,
    required this.serviceType,
    required this.address,
    required this.district,
    required this.amount,
    required this.status,
    required this.createdAt,
    this.note,
    this.surveyAt,
    this.convertedAt,
  });

  factory QuoteRequest.fromJson(Map<String, dynamic> json) => QuoteRequest(
    id: json['id'] as String,
    fullName: json['fullName'] as String,
    phone: json['phone'] as String,
    email: json['email'] as String?,
    propertyType: json['propertyType'] as String,
    serviceType: json['serviceType'] as String,
    address: json['address'] as String?,
    district: json['district'] as String?,
    amount: decimalOrNull(json['amount']),
    status: json['status'] as String,
    createdAt: json['createdAt'] as String,
    note: json['note'] as String?,
    surveyAt: json['surveyAt'] != null
        ? DateTime.parse(json['surveyAt'] as String)
        : null,
    convertedAt: json['convertedAt'] != null
        ? DateTime.parse(json['convertedAt'] as String)
        : null,
  );
}

/// GET /quotes/:id/history kaydi.
class QuoteHistoryEntry {
  final String id;
  final String action;
  final String? detail;
  final String createdAt;
  final String actorName;

  QuoteHistoryEntry({
    required this.id,
    required this.action,
    required this.detail,
    required this.createdAt,
    required this.actorName,
  });

  factory QuoteHistoryEntry.fromJson(Map<String, dynamic> json) =>
      QuoteHistoryEntry(
        id: json['id'] as String,
        action: json['action'] as String,
        // Backend detailText: ham JSON ({"status":"CONTACTED"}) yerine
        // okunur Türkçe ("Durum: İletişime Geçildi"); eski backend'de ham detay.
        detail: (json['detailText'] ?? json['detail']) as String?,
        createdAt: json['createdAt'] as String,
        actorName:
            (json['actor'] as Map<String, dynamic>?)?['fullName'] as String? ??
            '—',
      );
}

String quoteHistoryActionLabelTr(String action) {
  switch (action) {
    case 'quote.update':
      return 'Güncellendi';
    case 'quote.convert':
      return 'Müşteriye dönüştürüldü';
    default:
      return action;
  }
}

/// GET /quotes/summary — teklif hunisi ozeti.
class QuotesSummary {
  final Map<String, int> byStatus;
  final double openAmountTotal;

  /// CONVERTED / (CONVERTED + REJECTED); hic sonuclanmamissa null.
  final double? conversionRate;

  QuotesSummary({
    required this.byStatus,
    required this.openAmountTotal,
    required this.conversionRate,
  });

  factory QuotesSummary.fromJson(Map<String, dynamic> json) => QuotesSummary(
    byStatus:
        (json['byStatus'] as Map?)?.map(
          (k, v) => MapEntry(k.toString(), (v as num?)?.toInt() ?? 0),
        ) ??
        const {},
    openAmountTotal: decimalOr(json['openAmountTotal']),
    conversionRate: (json['conversionRate'] as num?)?.toDouble(),
  );
}

/// backend/prisma/schema.prisma:QuoteRequest.status serbest string —
/// "REVISION" backend'de yeni bir enum değeri değil, web ile aynı sabit
/// değer seti (bkz. web/src/app/(dashboard)/teklifler/page.tsx).
const List<String> quoteStatusOptions = [
  'NEW',
  'CONTACTED',
  'REVISION',
  'CONVERTED',
  'REJECTED',
];

String quoteStatusLabelTr(String status) {
  switch (status) {
    case 'NEW':
      return 'Yeni';
    case 'CONTACTED':
      return 'İletişime Geçildi';
    case 'REVISION':
      return 'Revize Edilecek';
    case 'CONVERTED':
      return 'Dönüştürüldü';
    case 'REJECTED':
      return 'Reddedildi';
    default:
      return status;
  }
}
