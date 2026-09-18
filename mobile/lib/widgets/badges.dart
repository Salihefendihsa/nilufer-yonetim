import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Bölüm Q (4. tur): yalnızca GÖRSEL rozetler — değerler backend'de hesaplanır
/// (Customer.isLoyal, leaderboard.achievementTier).

class LoyalCustomerBadge extends StatelessWidget {
  const LoyalCustomerBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.primary50,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: AppColors.primary100),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.favorite_rounded, size: 12, color: AppColors.primary700),
          SizedBox(width: 4),
          Text(
            'Sadık Müşteri',
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.primary700,
            ),
          ),
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
    final label = achievementTierLabelTr(tier);
    if (label == null) return const SizedBox.shrink();
    final (bg, fg) = switch (tier) {
      'GOLD' => (AppColors.warning50, AppColors.warning600),
      'SILVER' => (AppColors.surfaceMuted, AppColors.textSecondary),
      _ => (AppColors.danger50, AppColors.danger500),
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
          Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}
