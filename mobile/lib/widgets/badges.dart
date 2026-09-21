import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';

/// Bölüm Q (4. tur): yalnızca GÖRSEL rozetler — değerler backend'de hesaplanır
/// (Customer.isLoyal, leaderboard.achievementTier).

class LoyalCustomerBadge extends StatelessWidget {
  const LoyalCustomerBadge({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: cs.primary50,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: cs.primary100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.favorite_rounded, size: 12, color: cs.accent),
          SizedBox(width: 4),
          Text('Sadık Müşteri', style: tx.label.copyWith(color: cs.accent)),
        ],
      ),
    );
  }
}

/// Personel başarı kademesi: GOLD / SILVER / BRONZE (backend
/// lib/badges.ts ile aynı eşikler: ≥18 / ≥15 / ≥12). Bilinmeyen değer → boş.
String? achievementTierLabelTr(String? tier) {
  switch (tier) {
    case 'GOLD':
      return 'Altın';
    case 'SILVER':
      return 'Gümüş';
    case 'BRONZE':
      return 'Bronz';
    default:
      return null;
  }
}

class AchievementBadge extends StatelessWidget {
  final String? tier;
  const AchievementBadge({super.key, required this.tier});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final label = achievementTierLabelTr(tier);
    if (label == null) return const SizedBox.shrink();
    final (bg, fg) = switch (tier) {
      'GOLD' => (cs.warning50, cs.warning600),
      'SILVER' => (cs.surfaceMuted, cs.textSecondary),
      _ => (cs.danger50, cs.danger500),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.workspace_premium_rounded, size: 12, color: fg),
          const SizedBox(width: 3),
          Text(label, style: tx.label.copyWith(color: fg)),
        ],
      ),
    );
  }
}
