import 'decimal.dart';

class Contract {
  final String id;
  final String customerId;
  final String startDate;
  final String endDate;
  final int durationMonths;
  final String status;
  final double? amount;
  final String? serviceType;
  final String? recurrenceType;
  final String? nextGenerationDate;
  final String? customerName;

  Contract({
    required this.id,
    required this.customerId,
    required this.startDate,
    required this.endDate,
    required this.durationMonths,
    required this.status,
    required this.amount,
    required this.serviceType,
    required this.recurrenceType,
    required this.nextGenerationDate,
    required this.customerName,
  });

  factory Contract.fromJson(Map<String, dynamic> json) => Contract(
    id: json['id'] as String,
    customerId: json['customerId'] as String,
    startDate: json['startDate'] as String,
    endDate: json['endDate'] as String,
    durationMonths: json['durationMonths'] as int,
    status: json['status'] as String,
    amount: decimalOrNull(json['amount']),
    serviceType: json['serviceType'] as String?,
    recurrenceType: json['recurrenceType'] as String?,
    nextGenerationDate: json['nextGenerationDate'] as String?,
    customerName:
        (json['customer'] as Map<String, dynamic>?)?['fullName'] as String?,
  );
}

/// GET /contracts/summary — portfoy ozeti.
class ContractsSummary {
  final int activeCount;
  final int expiringIn30DaysCount;

  /// Periyodu ayliga normalize edilmis tekrarlayan gelir (yillik/12, 3 aylik/3...).
  final double monthlyRecurringRevenue;
  final double activeContractValueTotal;

  ContractsSummary({
    required this.activeCount,
    required this.expiringIn30DaysCount,
    required this.monthlyRecurringRevenue,
    required this.activeContractValueTotal,
  });

  factory ContractsSummary.fromJson(Map<String, dynamic> json) =>
      ContractsSummary(
        activeCount: json['activeCount'] as int? ?? 0,
        expiringIn30DaysCount: json['expiringIn30DaysCount'] as int? ?? 0,
        monthlyRecurringRevenue:
            (json['monthlyRecurringRevenue'] as num?)?.toDouble() ?? 0,
        activeContractValueTotal:
            (json['activeContractValueTotal'] as num?)?.toDouble() ?? 0,
      );
}

/// Bölüm E (2. tur) — GET /contracts/health-check.
class ContractHealthCheckItem {
  final String id;
  final String customerId;
  final String customerName;
  final String? serviceType;
  final String nextGenerationDate;
  final int daysOverdue;

  ContractHealthCheckItem({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.serviceType,
    required this.nextGenerationDate,
    required this.daysOverdue,
  });

  factory ContractHealthCheckItem.fromJson(Map<String, dynamic> json) =>
      ContractHealthCheckItem(
        id: json['id'] as String,
        customerId: json['customerId'] as String,
        customerName: json['customerName'] as String,
        serviceType: json['serviceType'] as String?,
        nextGenerationDate: json['nextGenerationDate'] as String,
        daysOverdue: (json['daysOverdue'] as num?)?.toInt() ?? 0,
      );
}

const List<String> contractStatusOptions = [
  'ACTIVE',
  'RENEWED',
  'EXPIRED',
  'CANCELLED',
];

/// backend/prisma/schema.prisma:RecurrenceType
const List<String> recurrenceTypeOptions = [
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
];

String recurrenceTypeLabelTr(String? type) {
  switch (type) {
    case 'MONTHLY':
      return 'Aylık';
    case 'QUARTERLY':
      return '3 Aylık';
    case 'SEMIANNUAL':
      return '6 Aylık';
    case 'ANNUAL':
      return 'Yıllık';
    default:
      return 'Yok';
  }
}

String contractStatusLabelTr(String status) {
  switch (status) {
    case 'ACTIVE':
      return 'Aktif';
    case 'RENEWED':
      return 'Yenilendi';
    case 'EXPIRED':
      return 'Süresi Doldu';
    case 'CANCELLED':
      return 'İptal Edildi';
    default:
      return status;
  }
}
