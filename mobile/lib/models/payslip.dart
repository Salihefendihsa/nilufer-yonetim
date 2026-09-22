import 'decimal.dart';

/// Bölüm AN (9. tur): GET /staff/me/payslip?month=YYYY-MM — salt görüntüleme
/// aylık maaş+prim özeti (backend/src/lib/payslip.ts). Sunucu bu alanları
/// zaten Number()'a çevirip döndürüyor, ama diğer Decimal alanlarıyla aynı
/// güvenli yardımcı (decimalOr) kullanılır — tutarlılık için ve ileride
/// sunucu tarafı değişirse (ör. ham Decimal include) sessizce bozulmasın diye.
class PayslipLine {
  final String id;
  final double amount;
  final String label;
  final String? date;

  const PayslipLine({
    required this.id,
    required this.amount,
    required this.label,
    this.date,
  });
}

class Payslip {
  final String month;
  final double salaryBase;
  final double bonusTotal;
  final int bonusCount;
  final double advanceTotal;
  final int advanceCount;
  final double net;
  final List<PayslipLine> bonuses;
  final List<PayslipLine> advances;

  const Payslip({
    required this.month,
    required this.salaryBase,
    required this.bonusTotal,
    required this.bonusCount,
    required this.advanceTotal,
    required this.advanceCount,
    required this.net,
    required this.bonuses,
    required this.advances,
  });

  factory Payslip.fromJson(Map<String, dynamic> json) => Payslip(
    month: json['month'] as String,
    salaryBase: decimalOr(json['salaryBase']),
    bonusTotal: decimalOr(json['bonusTotal']),
    bonusCount: (json['bonusCount'] as num?)?.toInt() ?? 0,
    advanceTotal: decimalOr(json['advanceTotal']),
    advanceCount: (json['advanceCount'] as num?)?.toInt() ?? 0,
    net: decimalOr(json['net']),
    bonuses: ((json['bonuses'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(
          (b) => PayslipLine(
            id: b['id'] as String,
            amount: decimalOr(b['amount']),
            label: 'Prim · ${b['periodName'] ?? ''}',
            date: b['approvedAt'] as String?,
          ),
        )
        .toList(),
    advances: ((json['advances'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(
          (a) => PayslipLine(
            id: a['id'] as String,
            amount: decimalOr(a['amount']),
            label: 'Avans · ${a['reason'] ?? ''}',
            date: a['createdAt'] as String?,
          ),
        )
        .toList(),
  );

  /// İstemci tarafı tutarlılık kontrolü — sunucu net'i ile aynı olmalı.
  double get computedNet => salaryBase + bonusTotal - advanceTotal;
}
