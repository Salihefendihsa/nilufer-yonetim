import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_palette.dart';

/// Solda renkli bir şerit + tekdüze gri kenarlıklı kart kabuğu. BoxDecoration'da
/// farklı renkli kenarlarla (Border(left: renkli, top/right/bottom: gri)
/// borderRadius birlikte kullanılamaz — Flutter bunu paint() sırasında bir
/// assertion ile reddediyor ve kartın TÜM içeriği (metin dahil) hiç
/// çizilmeden boş kalıyordu (gerçek cihazda görsel doğrulama sırasında
/// bulundu). Renkli şerit burada ayrı bir Container ile çiziliyor.
class AccentCard extends StatelessWidget {
  final Color accentColor;
  final Widget child;
  final VoidCallback? onTap;
  const AccentCard({
    required this.accentColor,
    required this.child,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 4, color: accentColor),
            Expanded(
              child: onTap == null
                  ? Padding(padding: const EdgeInsets.all(12), child: child)
                  : Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: onTap,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: child,
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
