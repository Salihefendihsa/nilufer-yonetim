/// API'ye tarih gönderme kuralı (docs/HEALTH_AUDIT.md §2.3) — web ile aynı:
///
/// - **Takvim günü** (izin, sözleşme, dönem, gider, sertifika): `"YYYY-AA-GG"`.
///   Web de böyle gönderir; iki istemci aynı günü aynı ana yazar. Eskiden mobil
///   saat dilimsiz yerel ISO (`2026-09-10T00:00:00.000`) gönderiyordu, sunucu
///   bunu KENDİ saat dilimine göre yorumlayıp web'den farklı bir ana kaydediyordu.
/// - **An** (keşif saati, erişim bitişi, durum bitişi, randevu penceresi):
///   UTC ISO (`…Z`) — sunucunun saat diliminden bağımsız.
library;

String _two(int v) => v.toString().padLeft(2, '0');

/// Takvim günü → `"YYYY-AA-GG"` (yerel gün; saat bileşeni yok sayılır).
String apiDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${_two(d.month)}-${_two(d.day)}';

/// Saatli an → UTC ISO 8601 (`…Z`).
String apiInstant(DateTime d) => d.toUtc().toIso8601String();
