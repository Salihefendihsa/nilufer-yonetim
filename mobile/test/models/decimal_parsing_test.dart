// Bölüm H (2. tur): Decimal serileşme regresyon testleri.
//
// Prisma `Decimal` alanları JSON'a STRING olarak gelir ("currentStock": "-8",
// "salaryBase": "15000", "amount": "900.5"); Int/Float alanları ise sayı.
// Bugün bulunan bug: bazı modeller `json['x'] as num` kullandığı için gerçek
// API yanıtıyla çalışma anında TypeError fırlatıyordu. Bu dosya her Decimal
// taşıyan modelin hem string hem sayı hem null gösterimini kabul ettiğini
// sabitler — biri `as num`'a geri dönerse burada kırılır.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/advance.dart';
import 'package:nilufer_mobile/models/contract.dart';
import 'package:nilufer_mobile/models/decimal.dart';
import 'package:nilufer_mobile/models/evaluation.dart';
import 'package:nilufer_mobile/models/executive_summary.dart';
import 'package:nilufer_mobile/models/job.dart';
import 'package:nilufer_mobile/models/product.dart';
import 'package:nilufer_mobile/models/quote.dart';
import 'package:nilufer_mobile/models/staff.dart';

void main() {
  group('decimalOrNull / decimalOr', () {
    test('string, int, double ve null gösterimlerini kabul eder', () {
      expect(decimalOrNull('15000'), 15000.0);
      expect(decimalOrNull('900.50'), 900.5);
      expect(decimalOrNull('-8'), -8.0);
      expect(decimalOrNull(42), 42.0);
      expect(decimalOrNull(3.25), 3.25);
      expect(decimalOrNull(null), isNull);
    });

    test('bozuk değerde çökmez: null / fallback', () {
      expect(decimalOrNull('abc'), isNull);
      expect(decimalOrNull(<String, dynamic>{}), isNull);
      expect(decimalOr('abc'), 0);
      expect(decimalOr(null, 7), 7);
    });
  });

  group('Product.fromJson (currentStock/criticalThreshold Decimal)', () {
    Map<String, dynamic> base(Object? stock, Object? threshold) => {
      'id': 'p1',
      'name': 'Ürün',
      'unit': 'lt',
      'category': 'BIOCIDAL',
      'currentStock': stock,
      'criticalThreshold': threshold,
    };

    test('string Decimal (gerçek API yanıtı) parse edilir', () {
      final p = Product.fromJson(base('-8', '5'));
      expect(p.currentStock, -8.0);
      expect(p.criticalThreshold, 5.0);
      expect(p.isCritical, isTrue);
    });

    test('sayısal değerler de parse edilir', () {
      final p = Product.fromJson(base(12, 5.5));
      expect(p.currentStock, 12.0);
      expect(p.isCritical, isFalse);
    });

    test('pendingPurchaseQuantity yoksa 0', () {
      expect(Product.fromJson(base('1', '1')).pendingPurchaseQuantity, 0);
    });
  });

  group('Job.fromJson (price Decimal?)', () {
    Map<String, dynamic> base(Object? price) => {
      'id': 'j1',
      'customerId': 'c1',
      'serviceType': 'Haşere',
      'status': 'PENDING',
      'createdAt': '2026-09-13T00:00:00.000Z',
      'price': price,
    };

    test('string / sayı / null price', () {
      expect(Job.fromJson(base('1234.00')).price, 1234.0);
      expect(Job.fromJson(base(1234)).price, 1234.0);
      expect(Job.fromJson(base(null)).price, isNull);
    });
  });

  group('Staff.fromJson (salaryBase Decimal)', () {
    Map<String, dynamic> base(Object? salary) => {
      'id': 's1',
      'userId': 'u1',
      'position': 'Teknisyen',
      'createdAt': '2026-09-13T00:00:00.000Z',
      'salaryBase': salary,
      'user': {'fullName': 'Ad Soyad', 'email': 'a@b.c', 'role': 'STAFF'},
    };

    test('string Decimal parse edilir', () {
      expect(Staff.fromJson(base('15000.00')).salaryBase, 15000.0);
    });

    test('STAFF/TEAM_LEAD yanıtında alan hiç yoksa (redaction) çökmez, 0 döner', () {
      final json = base(null)..remove('salaryBase');
      expect(Staff.fromJson(json).salaryBase, 0);
    });
  });

  group('Contract / Quote / Advance / StaffBonus / EvaluationPeriod (amount Decimal)', () {
    test('Contract.amount string ve null', () {
      Map<String, dynamic> c(Object? amount) => {
        'id': 'c1',
        'customerId': 'cu1',
        'startDate': '2026-01-01T00:00:00.000Z',
        'endDate': '2026-12-31T00:00:00.000Z',
        'durationMonths': 12,
        'status': 'ACTIVE',
        'amount': amount,
      };
      expect(Contract.fromJson(c('2500.75')).amount, 2500.75);
      expect(Contract.fromJson(c(null)).amount, isNull);
    });

    test('QuoteRequest.amount string ve null', () {
      Map<String, dynamic> q(Object? amount) => {
        'id': 'q1',
        'fullName': 'Ad',
        'phone': '0500',
        'propertyType': 'Ev',
        'serviceType': 'Haşere',
        'status': 'NEW',
        'createdAt': '2026-09-13T00:00:00.000Z',
        'amount': amount,
      };
      expect(QuoteRequest.fromJson(q('750')).amount, 750.0);
      expect(QuoteRequest.fromJson(q(null)).amount, isNull);
    });

    test('AdvanceRequest.amount string', () {
      final a = AdvanceRequest.fromJson({
        'id': 'a1',
        'staffId': 's1',
        'amount': '1500.00',
        'reason': 'x',
        'status': 'PENDING',
        'createdAt': '2026-09-13T00:00:00.000Z',
      });
      expect(a.amount, 1500.0);
    });

    test('StaffBonus.amount ve EvaluationPeriod.bonusAmount string', () {
      final b = StaffBonus.fromJson({
        'id': 'b1',
        'staffId': 's1',
        'evaluationPeriodId': 'p1',
        'evaluationId': 'e1',
        'amount': '900.00',
        'status': 'PENDING',
      });
      expect(b.amount, 900.0);

      final p = EvaluationPeriod.fromJson({
        'id': 'p1',
        'label': 'Q3',
        'startDate': '2026-07-01T00:00:00.000Z',
        'endDate': '2026-09-30T00:00:00.000Z',
        'isLocked': false,
        'bonusThreshold': 15,
        'bonusAmount': '500.00',
      });
      expect(p.bonusAmount, 500.0);
      expect(p.bonusThreshold, 15);
    });
  });

  group('ExecutiveSummary.fromJson (Bölüm G)', () {
    test('bölümler sıralı gelir, value null/sayı/string kabul edilir, drillDown taşınır', () {
      final s = ExecutiveSummary.fromJson({
        'range': 'week',
        'generatedAt': '2026-09-13T10:00:00.000Z',
        'sections': {
          'finance': [
            {
              'key': 'revenueThisMonth',
              'label': 'Bu Ay Ciro',
              'value': '1952.00',
              'format': 'currency',
              'tone': 'success',
              'drillDown': {'href': '/para?tab=payments', 'route': 'finance', 'filter': 'payments'},
            },
            {
              'key': 'netProfitThisMonth',
              'label': 'Net Kâr',
              'value': null,
              'format': 'currency',
              'tone': 'success',
              'hint': 'Finans görüntüleme izni gerekli',
              'drillDown': {'href': '/para?tab=expenses', 'route': 'finance'},
            },
          ],
          'alerts': [
            {
              'key': 'criticalStock',
              'label': 'Kritik Stok',
              'value': 3,
              'format': 'count',
              'tone': 'danger',
              'drillDown': {'href': '/stok?filter=critical', 'route': 'stock', 'filter': 'critical'},
            },
          ],
        },
        'pendingApprovalsBreakdown': {'quotes': 3, 'advances': '2'},
      });

      expect(s.range, 'week');
      expect(s.sections.map((x) => x.key).toList(), ExecutiveSummary.sectionOrder);
      final finance = s.sections.firstWhere((x) => x.key == 'finance').kpis;
      expect(finance[0].value, 1952.0);
      expect(finance[1].value, isNull);
      expect(finance[1].hint, 'Finans görüntüleme izni gerekli');
      final alerts = s.sections.firstWhere((x) => x.key == 'alerts').kpis;
      expect(alerts.single.value, 3.0);
      expect(alerts.single.drillDown.route, 'stock');
      expect(alerts.single.drillDown.filter, 'critical');
      // Eksik bölümler boş liste — çökmez.
      expect(s.sections.firstWhere((x) => x.key == 'staff').kpis, isEmpty);
      expect(s.pendingApprovalsBreakdown, {'quotes': 3, 'advances': 2});
    });
  });
}
