import 'package:flutter/material.dart';

/// Renk token'ları — web/tailwind.config.ts ve references/stitch/.../DESIGN.md ile
/// birebir aynı hex değerleri kullanır, iki platform arasında tutarlı bir görünüm için.
class AppColors {
  AppColors._();

  // Primary (yeşil) skala
  static const primary50 = Color(0xFFF1F8F2);
  static const primary100 = Color(0xFFDEEFE1);
  static const primary200 = Color(0xFFBFDFC5);
  static const primary300 = Color(0xFF94C79E);
  static const primary400 = Color(0xFF61A870);
  static const primary500 = Color(0xFF3D8A4E);
  static const primary600 = Color(0xFF2F6B3D);
  static const primary700 = Color(0xFF2F5233);
  static const primary800 = Color(0xFF243F28);
  static const primary900 = Color(0xFF17281A);

  // Nötr griler (hafif yeşilimsi)
  static const neutral50 = Color(0xFFF7F9F7);
  static const neutral100 = Color(0xFFEFF2EF);
  static const neutral200 = Color(0xFFE3E8E3);
  static const neutral300 = Color(0xFFCFD8D0);
  static const neutral400 = Color(0xFFA3B0A5);
  static const neutral500 = Color(0xFF7C8A7F);
  static const neutral600 = Color(0xFF5A6B5E);
  static const neutral700 = Color(0xFF425145);
  static const neutral800 = Color(0xFF2A352C);
  static const neutral900 = Color(0xFF16211A);

  // Semantik renkler
  static const success50 = Color(0xFFECFBF0);
  static const success500 = Color(0xFF15803D);
  static const success600 = Color(0xFF166534);

  static const warning50 = Color(0xFFFEF7E7);
  static const warning500 = Color(0xFFB57F13);
  static const warning600 = Color(0xFF96690F);

  static const danger50 = Color(0xFFFDF0EF);
  static const danger500 = Color(0xFFC0392B);
  static const danger600 = Color(0xFF9B1C1C);

  static const info50 = Color(0xFFEDF5FB);
  static const info500 = Color(0xFF1F6FA8);
  static const info600 = Color(0xFF175A8A);

  static const ink = Color(0xFF16211A);

  // Yüzeyler
  static const surfacePage = Color(0xFFF4F7F4);
  static const surfaceBase = Color(0xFFFFFFFF);
  static const surfaceCard = Color(0xFFFFFFFF);
  static const surfaceCardHover = Color(0xFFF7FAF7);
  static const surfaceSubtle = Color(0xFFF2F6F2);
  static const surfaceMuted = Color(0xFFE8EEE8);

  static const borderDefault = Color(0xFFE3E8E3);
  static const borderStrong = Color(0xFFCFD8D0);
  static const borderAccent = Color(0xFFBFDFC5);

  static const textPrimary = Color(0xFF16211A);
  static const textSecondary = Color(0xFF5A6B5E);
  static const textFaint = Color(0xFF8B9A8E);
  static const textInverse = Color(0xFFFFFFFF);
}
