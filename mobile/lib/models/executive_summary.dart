import 'decimal.dart';

/// backend/src/controllers/executiveSummaryController.ts yanıtıyla birebir
/// (Bölüm G, 2. tur). Tüm sayısal değerler `decimalOrNull` ile okunur —
/// backend'de `value` bir `number` ama gelecekte Decimal alanı eklenirse
/// string gelmesi çökme yaratmasın diye (bkz. models/decimal.dart notu).
class KpiDrillDown {
  final String href;
  final String route;
  final String? filter;

  const KpiDrillDown({required this.href, required this.route, this.filter});

  factory KpiDrillDown.fromJson(Map<String, dynamic> json) => KpiDrillDown(
    href: json['href'] as String? ?? '/',
    route: json['route'] as String? ?? '',
    filter: json['filter'] as String?,
  );
}

class ExecutiveKpi {
  final String key;
  final String label;
  final double? value;

  /// currency | count | percent | score
  final String format;

  /// neutral | success | warning | danger | info
  final String tone;
  final String? hint;
  final KpiDrillDown drillDown;

  const ExecutiveKpi({
    required this.key,
    required this.label,
    required this.value,
    required this.format,
    required this.tone,
    required this.drillDown,
    this.hint,
  });

  factory ExecutiveKpi.fromJson(Map<String, dynamic> json) => ExecutiveKpi(
    key: json['key'] as String,
    label: json['label'] as String? ?? '',
    value: decimalOrNull(json['value']),
    format: json['format'] as String? ?? 'count',
    tone: json['tone'] as String? ?? 'neutral',
    hint: json['hint'] as String?,
    drillDown: KpiDrillDown.fromJson(
      (json['drillDown'] as Map?)?.cast<String, dynamic>() ?? const {},
    ),
  );
}

class ExecutiveSection {
  final String key;
  final List<ExecutiveKpi> kpis;
  const ExecutiveSection(this.key, this.kpis);
}

class ExecutiveSummary {
  final String range;
  /// Seçili aralığın sınırları (backend hesaplar, TR saat dilimi) — KPI
  /// kartından iş listesine gidilirken aynı aralık uygulanır.
  final DateTime? rangeStart;
  final DateTime? rangeEnd;
  final DateTime generatedAt;
  final List<ExecutiveSection> sections;
  final Map<String, int> pendingApprovalsBreakdown;

  const ExecutiveSummary({
    required this.range,
    this.rangeStart,
    this.rangeEnd,
    required this.generatedAt,
    required this.sections,
    required this.pendingApprovalsBreakdown,
  });

  /// Bölüm sırası web ile aynı: uyarılar en üstte.
  static const sectionOrder = [
    'alerts',
    'finance',
    'operations',
    'staff',
    'customers',
  ];

  factory ExecutiveSummary.fromJson(Map<String, dynamic> json) {
    final rawSections =
        (json['sections'] as Map?)?.cast<String, dynamic>() ?? const {};
    final sections = <ExecutiveSection>[];
    for (final key in sectionOrder) {
      final list = (rawSections[key] as List?) ?? const [];
      sections.add(
        ExecutiveSection(
          key,
          list
              .map((e) => ExecutiveKpi.fromJson((e as Map).cast<String, dynamic>()))
              .toList(),
        ),
      );
    }
    final breakdown =
        (json['pendingApprovalsBreakdown'] as Map?)?.cast<String, dynamic>() ??
        const {};
    return ExecutiveSummary(
      range: json['range'] as String? ?? 'today',
      rangeStart: DateTime.tryParse(json['rangeStart'] as String? ?? '')?.toLocal(),
      rangeEnd: DateTime.tryParse(json['rangeEnd'] as String? ?? '')?.toLocal(),
      generatedAt:
          DateTime.tryParse(json['generatedAt'] as String? ?? '') ??
          DateTime.now(),
      sections: sections,
      pendingApprovalsBreakdown: breakdown.map(
        (k, v) => MapEntry(k, decimalOr(v).toInt()),
      ),
    );
  }
}
