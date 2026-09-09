/// Prisma `Decimal` alanları JSON'a **string** olarak serileşir
/// (`"currentStock": "-8"`), `Int`/`Float` alanları ise sayı olarak gelir.
/// Bu yüzden `json['x'] as num` bir Decimal alanında çalışma anında
/// `TypeError` fırlatır.
///
/// Aşağıdaki yardımcılar her iki gösterimi de kabul eder; parse edilemeyen
/// değer için sessizce 0 döndürmek yerine `null` verirler, böylece çağıran
/// taraf "veri yok" ile "sıfır" arasındaki farkı koruyabilir.
double? decimalOrNull(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

/// Zorunlu sayısal alanlar için; alan hiç yoksa veya bozuksa [fallback].
double decimalOr(dynamic value, [double fallback = 0]) =>
    decimalOrNull(value) ?? fallback;
