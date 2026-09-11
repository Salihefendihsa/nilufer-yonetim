import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
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
  final Color iconColor;
  final Color iconBackground;

  const AppStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.caption,
    this.badge,
    this.badgeColor,
    this.iconColor = AppColors.primary600,
    this.iconBackground = AppColors.primary50,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.sheet),
        border: Border.all(color: AppColors.borderDefault),
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
                  color: iconBackground,
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                ),
                child: Icon(icon, size: 18, color: iconColor),
              ),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: (badgeColor ?? AppColors.primary500).withValues(
                      alpha: 0.1,
                    ),
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    badge!,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: badgeColor ?? AppColors.primary700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          AnimatedStatValue(
            value: value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (caption != null) ...[
            const SizedBox(height: 4),
            Text(
              caption!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.textFaint,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
