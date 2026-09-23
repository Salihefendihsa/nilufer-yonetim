import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';
import 'animated_stat_value.dart';

/// [AppStatCard] listelerini sabit `childAspectRatio` ile kırpan
/// `GridView.count` yerine kullanılır — her kartın yüksekliği kendi
/// içeriğine göre belirlenir (uzun `caption`/büyük sistem font ölçeği
/// altında "BOTTOM OVERFLOWED" hatası vermez).
class StatCardGrid extends StatelessWidget {
  final List<Widget> children;
  final int crossAxisCount;
  final double spacing;

  const StatCardGrid({
    super.key,
    required this.children,
    this.crossAxisCount = 2,
    this.spacing = 12,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final totalSpacing = spacing * (crossAxisCount - 1);
        final itemWidth =
            (constraints.maxWidth - totalSpacing) / crossAxisCount;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final child in children)
              SizedBox(width: itemWidth, child: child),
          ],
        );
      },
    );
  }
}

/// web/src/components/StatCard.tsx'in Flutter karşılığı — aynı kart/etiket
/// düzeni: ikon rozeti, büyük değer, alt açıklama, opsiyonel köşe etiketi.
class AppStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final String? caption;
  final String? badge;
  final Color? badgeColor;

  /// null → tema vurgu rengi (koyu modda otomatik açık ton).
  final Color? iconColor;
  final Color? iconBackground;

  /// Verilirse kart tıklanabilir olur (ilgili liste/detay ekranına gider).
  final VoidCallback? onTap;

  const AppStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.caption,
    this.badge,
    this.badgeColor,
    this.iconColor,
    this.iconBackground,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final radius = BorderRadius.circular(AppRadius.sheet);
    final card = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: onTap == null ? cs.surfaceCard : null,
        borderRadius: radius,
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconBackground ?? cs.primary50,
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                ),
                child: Icon(icon, size: 18, color: iconColor ?? cs.accentSoft),
              ),
              if (badge != null) ...[
                const SizedBox(width: 6),
                // Flexible: dar kart + büyük yazı boyutunda rozet taşmasın.
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: (badgeColor ?? cs.primary500).withValues(
                        alpha: 0.1,
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      badge!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tx.label.copyWith(
                        color: badgeColor ?? cs.primary700,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          AnimatedStatValue(
            value: value,
            style: tx.display.copyWith(
              fontWeight: FontWeight.w800,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: tx.bodySmall.copyWith(fontWeight: FontWeight.w600),
          ),
          if (caption != null) ...[
            const SizedBox(height: 4),
            Text(
              caption!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: tx.caption.copyWith(color: cs.textFaint),
            ),
          ],
        ],
      ),
    );
    if (onTap == null) return card;
    // Material + InkWell: dokunma geri bildirimi (ripple) kartın yuvarlak
    // köşeleri içinde kalır; arka plan rengi Material'dan gelir.
    return Material(
      color: cs.surfaceCard,
      borderRadius: radius,
      child: InkWell(borderRadius: radius, onTap: onTap, child: card),
    );
  }
}
