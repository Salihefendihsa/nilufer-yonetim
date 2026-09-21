import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Tema-duyarlı renk paleti (tasarım turu #9 — mobil koyu mod).
///
/// `AppColors` / `AppDarkColors` derleme-zamanı sabitleridir ve ekranlarda
/// doğrudan `AppColors.x` yazıldığında koyu modda açık tema rengi kalır
/// (bkz. app_colors.dart notu). `AppPalette` aynı alan adlarını bir
/// ÖRNEK üzerinden sunar; `context.colors` o anki parlaklığa göre
/// `AppPalette.light` ya da `AppPalette.dark` döndürür. Migrasyon mekanik:
///
/// ```dart
/// // önce                       // sonra
/// color: AppColors.surfaceCard  →  color: context.colors.surfaceCard
/// ```
/// (`const` widget'lar `const` olmaktan çıkar — analizör uyarır.)
///
/// Aşamalı geçiş: 76 dosyadan önce kabuklar, ortak widget'lar ve en çok
/// kullanılan ekranlar; ilerleme docs/DESIGN_AUDIT.md §0'da.
class AppPalette {
  final Color primary50, primary100, primary200, primary300, primary400;
  final Color primary500, primary600, primary700, primary800, primary900;
  final Color neutral50, neutral100, neutral200, neutral300, neutral400;
  final Color neutral500, neutral600, neutral700, neutral800, neutral900;
  final Color success50, success500, success600;
  final Color warning50, warning500, warning600;
  final Color danger50, danger500, danger600;
  final Color info50, info500, info600;
  final Color ink;
  final Color surfacePage, surfaceBase, surfaceCard, surfaceCardHover;
  final Color surfaceSubtle, surfaceMuted;
  final Color borderDefault, borderStrong, borderAccent;
  final Color textPrimary, textSecondary, textFaint, textInverse;
  final bool isDark;

  const AppPalette({
    required this.primary50,
    required this.primary100,
    required this.primary200,
    required this.primary300,
    required this.primary400,
    required this.primary500,
    required this.primary600,
    required this.primary700,
    required this.primary800,
    required this.primary900,
    required this.neutral50,
    required this.neutral100,
    required this.neutral200,
    required this.neutral300,
    required this.neutral400,
    required this.neutral500,
    required this.neutral600,
    required this.neutral700,
    required this.neutral800,
    required this.neutral900,
    required this.success50,
    required this.success500,
    required this.success600,
    required this.warning50,
    required this.warning500,
    required this.warning600,
    required this.danger50,
    required this.danger500,
    required this.danger600,
    required this.info50,
    required this.info500,
    required this.info600,
    required this.ink,
    required this.surfacePage,
    required this.surfaceBase,
    required this.surfaceCard,
    required this.surfaceCardHover,
    required this.surfaceSubtle,
    required this.surfaceMuted,
    required this.borderDefault,
    required this.borderStrong,
    required this.borderAccent,
    required this.textPrimary,
    required this.textSecondary,
    required this.textFaint,
    required this.textInverse,
    required this.isDark,
  });

  /// Koyu zeminde primary-700 çok koyu kalır; vurgu (ikon, seçili sekme,
  /// link) için koyu modda primary-400 kullanılır. Açık modda primary-700.
  Color get accent => isDark ? primary400 : primary700;

  /// Vurgu rengiyle aynı mantık, bir ton açık (ör. çubuk/ilerleme dolgusu).
  Color get accentSoft => isDark ? primary300 : primary600;

  static const light = AppPalette(
    primary50: AppColors.primary50,
    primary100: AppColors.primary100,
    primary200: AppColors.primary200,
    primary300: AppColors.primary300,
    primary400: AppColors.primary400,
    primary500: AppColors.primary500,
    primary600: AppColors.primary600,
    primary700: AppColors.primary700,
    primary800: AppColors.primary800,
    primary900: AppColors.primary900,
    neutral50: AppColors.neutral50,
    neutral100: AppColors.neutral100,
    neutral200: AppColors.neutral200,
    neutral300: AppColors.neutral300,
    neutral400: AppColors.neutral400,
    neutral500: AppColors.neutral500,
    neutral600: AppColors.neutral600,
    neutral700: AppColors.neutral700,
    neutral800: AppColors.neutral800,
    neutral900: AppColors.neutral900,
    success50: AppColors.success50,
    success500: AppColors.success500,
    success600: AppColors.success600,
    warning50: AppColors.warning50,
    warning500: AppColors.warning500,
    warning600: AppColors.warning600,
    danger50: AppColors.danger50,
    danger500: AppColors.danger500,
    danger600: AppColors.danger600,
    info50: AppColors.info50,
    info500: AppColors.info500,
    info600: AppColors.info600,
    ink: AppColors.ink,
    surfacePage: AppColors.surfacePage,
    surfaceBase: AppColors.surfaceBase,
    surfaceCard: AppColors.surfaceCard,
    surfaceCardHover: AppColors.surfaceCardHover,
    surfaceSubtle: AppColors.surfaceSubtle,
    surfaceMuted: AppColors.surfaceMuted,
    borderDefault: AppColors.borderDefault,
    borderStrong: AppColors.borderStrong,
    borderAccent: AppColors.borderAccent,
    textPrimary: AppColors.textPrimary,
    textSecondary: AppColors.textSecondary,
    textFaint: AppColors.textFaint,
    textInverse: AppColors.textInverse,
    isDark: false,
  );

  static const dark = AppPalette(
    primary50: AppDarkColors.primary50,
    primary100: AppDarkColors.primary100,
    primary200: AppDarkColors.primary200,
    primary300: AppDarkColors.primary300,
    primary400: AppDarkColors.primary400,
    primary500: AppDarkColors.primary500,
    primary600: AppDarkColors.primary600,
    primary700: AppDarkColors.primary700,
    primary800: AppDarkColors.primary800,
    primary900: AppDarkColors.primary900,
    neutral50: AppDarkColors.neutral50,
    neutral100: AppDarkColors.neutral100,
    neutral200: AppDarkColors.neutral200,
    neutral300: AppDarkColors.neutral300,
    neutral400: AppDarkColors.neutral400,
    neutral500: AppDarkColors.neutral500,
    neutral600: AppDarkColors.neutral600,
    neutral700: AppDarkColors.neutral700,
    neutral800: AppDarkColors.neutral800,
    neutral900: AppDarkColors.neutral900,
    success50: AppDarkColors.success50,
    success500: AppDarkColors.success500,
    success600: AppDarkColors.success600,
    warning50: AppDarkColors.warning50,
    warning500: AppDarkColors.warning500,
    warning600: AppDarkColors.warning600,
    danger50: AppDarkColors.danger50,
    danger500: AppDarkColors.danger500,
    danger600: AppDarkColors.danger600,
    info50: AppDarkColors.info50,
    info500: AppDarkColors.info500,
    info600: AppDarkColors.info600,
    ink: AppDarkColors.ink,
    surfacePage: AppDarkColors.surfacePage,
    surfaceBase: AppDarkColors.surfaceBase,
    surfaceCard: AppDarkColors.surfaceCard,
    surfaceCardHover: AppDarkColors.surfaceCardHover,
    surfaceSubtle: AppDarkColors.surfaceSubtle,
    surfaceMuted: AppDarkColors.surfaceMuted,
    borderDefault: AppDarkColors.borderDefault,
    borderStrong: AppDarkColors.borderStrong,
    borderAccent: AppDarkColors.borderAccent,
    textPrimary: AppDarkColors.textPrimary,
    textSecondary: AppDarkColors.textSecondary,
    textFaint: AppDarkColors.textFaint,
    textInverse: AppDarkColors.textInverse,
    isDark: true,
  );

  static AppPalette of(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? dark : light;
}

extension AppPaletteX on BuildContext {
  /// O anki temanın paleti — `context.colors.surfaceCard` gibi.
  AppPalette get colors => AppPalette.of(this);
}
