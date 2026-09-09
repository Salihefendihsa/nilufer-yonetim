import '../../core/api_client.dart';
import '../../models/paginated.dart';
import '../../models/decimal.dart';

class PaymentsSummary {
  final double thisMonthTotal;
  final int thisMonthPaymentCount;
  final double allTimeTotal;
  final double totalOutstandingBalance;
  final double pendingAdvancesTotal;
  final int pendingAdvancesCount;
  final double? netProfitThisMonth;
  final double? profitMargin;

  // --- Mudur fazi alanlari ---
  final double lastMonthTotal;

  /// Gecen ay 0 ise yuzde degisim tanimsizdir - null gelir.
  final double? monthOverMonthChangePercent;
  final List<PaymentTypeBreakdown> paymentTypeBreakdown;

  /// Isletme sahibi tarafindan /settings'te tanimlanir; tanimsizsa null
  /// gelir ve hedef gostergesi hic gosterilmez.
  final double? monthlyRevenueTarget;
  final double? revenueTargetCompletionPercent;

  PaymentsSummary({
    required this.thisMonthTotal,
    required this.thisMonthPaymentCount,
    required this.allTimeTotal,
    required this.totalOutstandingBalance,
    required this.pendingAdvancesTotal,
    required this.pendingAdvancesCount,
    required this.netProfitThisMonth,
    required this.profitMargin,
    this.lastMonthTotal = 0,
    this.monthOverMonthChangePercent,
    this.paymentTypeBreakdown = const [],
    this.monthlyRevenueTarget,
    this.revenueTargetCompletionPercent,
  });

  factory PaymentsSummary.fromJson(Map<String, dynamic> json) =>
      PaymentsSummary(
        thisMonthTotal: (json['thisMonthTotal'] as num?)?.toDouble() ?? 0,
        thisMonthPaymentCount: json['thisMonthPaymentCount'] as int? ?? 0,
        allTimeTotal: (json['allTimeTotal'] as num?)?.toDouble() ?? 0,
        totalOutstandingBalance:
            (json['totalOutstandingBalance'] as num?)?.toDouble() ?? 0,
        pendingAdvancesTotal:
            (json['pendingAdvancesTotal'] as num?)?.toDouble() ?? 0,
        pendingAdvancesCount: json['pendingAdvancesCount'] as int? ?? 0,
        netProfitThisMonth: (json['netProfitThisMonth'] as num?)?.toDouble(),
        profitMargin: (json['profitMargin'] as num?)?.toDouble(),
        lastMonthTotal: (json['lastMonthTotal'] as num?)?.toDouble() ?? 0,
        monthOverMonthChangePercent:
            (json['monthOverMonthChangePercent'] as num?)?.toDouble(),
        paymentTypeBreakdown:
            (json['paymentTypeBreakdown'] as List<dynamic>? ?? [])
                .map(
                  (e) => PaymentTypeBreakdown.fromJson(
                    e as Map<String, dynamic>,
                  ),
                )
                .toList(),
        monthlyRevenueTarget:
            (json['monthlyRevenueTarget'] as num?)?.toDouble(),
        revenueTargetCompletionPercent:
            (json['revenueTargetCompletionPercent'] as num?)?.toDouble(),
      );
}

class PaymentTypeBreakdown {
  final String paymentType;
  final double total;
  final int count;

  PaymentTypeBreakdown({
    required this.paymentType,
    required this.total,
    required this.count,
  });

  factory PaymentTypeBreakdown.fromJson(Map<String, dynamic> json) =>
      PaymentTypeBreakdown(
        paymentType: json['paymentType'] as String? ?? '-',
        total: (json['total'] as num?)?.toDouble() ?? 0,
        count: json['count'] as int? ?? 0,
      );
}

String paymentTypeLabelTr(String type) {
  switch (type) {
    case 'CASH':
      return 'Nakit';
    case 'CREDIT_CARD':
      return 'Kredi Kartı';
    case 'TRANSFER':
      return 'Havale/EFT';
    default:
      return type;
  }
}

class Payment {
  final String id;
  final String customerId;
  final double amount;
  final String paymentType;
  final String createdAt;
  final String? referenceNo;
  final String? customerName;
  final String? collectedByStaffName;

  Payment({
    required this.id,
    required this.customerId,
    required this.amount,
    required this.paymentType,
    required this.createdAt,
    this.referenceNo,
    this.customerName,
    this.collectedByStaffName,
  });

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
    id: json['id'] as String,
    customerId: json['customerId'] as String,
    amount: decimalOr(json['amount']),
    paymentType: json['paymentType'] as String,
    createdAt: json['createdAt'] as String,
    referenceNo: json['referenceNo'] as String?,
    customerName:
        (json['customer'] as Map<String, dynamic>?)?['fullName'] as String?,
    collectedByStaffName:
        ((json['collectedByStaff'] as Map<String, dynamic>?)?['user']
                as Map<String, dynamic>?)?['fullName']
            as String?,
  );
}

class FinanceApi {
  final _api = ApiClient.instance;

  /// Yalnızca OWNER/MANAGER (+ view_finance izni olan STAFF) —
  /// backend/src/routes/payments.ts:11.
  Future<PaymentsSummary> getSummary() async {
    final json = await _api.get<Map<String, dynamic>>('/payments/summary');
    return PaymentsSummary.fromJson(json);
  }

  Future<Paginated<Payment>> listPayments({int page = 1}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/payments',
      query: {'page': page, 'limit': 20},
    );
    return Paginated.fromJson(json, Payment.fromJson);
  }

  Future<Payment> createPayment({
    required String customerId,
    required double amount,
    required String paymentType,
    String? referenceNo,
    String? collectedByStaffId,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/payments',
      body: {
        'customerId': customerId,
        'amount': amount,
        'paymentType': paymentType,
        if (referenceNo != null && referenceNo.isNotEmpty)
          'referenceNo': referenceNo,
        if (collectedByStaffId != null && collectedByStaffId.isNotEmpty)
          'collectedByStaffId': collectedByStaffId,
      },
    );
    return Payment.fromJson(json);
  }
}
