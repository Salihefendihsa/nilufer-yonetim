import 'package:flutter/material.dart';

import 'app_palette.dart';

/// Merkezi tipografi ölçeği (tasarım turu #8).
///
/// Önceden 561 satır-içi `TextStyle(` ve 18 farklı `fontSize` (10.5, 11.5,
/// 12.5, 13.5, 14.5, 15.5 gibi yarım puntolar dahil) vardı. Bu sınıf 8
/// adlandırılmış stile indirger; renkler `AppPalette`'ten geldiği için
/// koyu modda da doğrudur. Kullanım:
///
/// ```dart
/// Text('Başlık', style: context.text.title)
/// Text('…', style: context.text.caption.copyWith(color: context.colors.danger500))
/// ```
///
/// Eşleme rehberi (eski fontSize → stil):
/// - 28 / 22 / 20 → `display` (istatistik değeri, ekran başlığı)
/// - 18 / 17 / 16 / 15.5 → `title` (kart/bölüm başlığı)
/// - 15 / 14.5 / 14 (w600+) → `subtitle` (liste satırı başlığı, buton)
/// - 14 / 13.5 (w400-500) → `body`
/// - 13 / 12.5 → `bodySmall` (ikincil açıklama)
/// - 12 / 11.5 → `caption` (meta bilgi, tarih)
/// - 11 / 10.5 / 10 → `label` (rozet, büyük harf grup başlığı)
/// - Sekmeler/nav etiketi → `navLabel`
class AppTextStyles {
  final AppPalette c;
  const AppTextStyles(this.c);

  /// Büyük sayı / ekran başlığı.
  TextStyle get display => TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.3,
    height: 1.2,
    color: c.textPrimary,
  );

  /// İstatistik kartı değeri (AppStatCard).
  TextStyle get stat => TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.5,
    height: 1.1,
    color: c.textPrimary,
  );

  /// Kart / bölüm başlığı.
  TextStyle get title => TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    height: 1.3,
    color: c.textPrimary,
  );

  /// Liste satırı başlığı, vurgulu metin.
  TextStyle get subtitle => TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    height: 1.35,
    color: c.textPrimary,
  );

  /// Gövde metni.
  TextStyle get body => TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    height: 1.45,
    color: c.textPrimary,
  );

  /// İkincil açıklama satırı.
  TextStyle get bodySmall => TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    height: 1.4,
    color: c.textSecondary,
  );

  /// Meta bilgi (tarih, sayaç), yardımcı metin.
  TextStyle get caption => TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.35,
    color: c.textSecondary,
  );

  /// Rozet metni ve BÜYÜK HARF grup başlıkları.
  TextStyle get label => TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.5,
    height: 1.2,
    color: c.textFaint,
  );

  /// Alt navigasyon / sekme etiketi (seçili hali `copyWith` ile).
  TextStyle get navLabel => TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    height: 1.2,
    color: c.textSecondary,
  );

  /// Buton metni (ElevatedButton/OutlinedButton temayla aynı ölçü).
  TextStyle get button => TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    height: 1.2,
    color: c.textPrimary,
  );
}

extension AppTextStylesX on BuildContext {
  /// O anki temanın tipografi ölçeği — `context.text.body` gibi.
  AppTextStyles get text => AppTextStyles(colors);
}
