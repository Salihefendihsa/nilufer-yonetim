import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';

/// Henüz bu oturumda gerçek veriye bağlanmamış ekranlar için dürüst bir
/// yer tutucu — YANLIŞLIKLA "çalışıyor" izlenimi vermemesi için sahte veri
/// GÖSTERMEZ, sadece hangi fazda ekleneceğini belirtir
/// (bkz. docs/STITCH_FEATURE_MATRIX.md).
class ComingSoonScreen extends StatelessWidget {
  final String title;
  final String phaseNote;
  final IconData icon;

  const ComingSoonScreen({
    super.key,
    required this.title,
    required this.phaseNote,
    this.icon = Icons.construction_rounded,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 44, color: cs.textFaint),
              const SizedBox(height: 16),
              Text(
                '$title ekranı henüz bağlanmadı',
                textAlign: TextAlign.center,
                style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              Text(phaseNote, textAlign: TextAlign.center, style: tx.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}
