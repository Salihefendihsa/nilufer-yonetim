import 'package:flutter/material.dart';

import '../features/contracts/contracts_list_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../theme/app_colors.dart';

/// CUSTOMER'ın alt navigasyonunda sabit sekmesi olmayan modüllerin listesi.
/// web/src/components/Sidebar.tsx'te CUSTOMER için görünür ama mobilin
/// 5 sekmelik alt navigasyonuna sığmayan sayfalar buraya taşınır (bkz.
/// docs/WEB_MOBILE_PARITY.md §"Rol Bazlı Fark Analizi" → CUSTOMER).
/// "Para" burada YOKTUR — web'de de `/para` yalnızca OWNER/MANAGER'a açık
/// (Sidebar.tsx satır 59), CUSTOMER'a hiç gösterilmiyor; bu bir eksik değil.
class CustomerMoreMenuScreen extends StatelessWidget {
  const CustomerMoreMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = <({String label, IconData icon, WidgetBuilder builder})>[
      (
        label: 'Sözleşmelerim',
        icon: Icons.description_outlined,
        builder: (_) => const MyContractsScreen(),
      ),
      (
        label: 'Bildirimler',
        icon: Icons.notifications_outlined,
        builder: (_) => const NotificationsScreen(),
      ),
    ];

    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: const Text('Diğer')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final item = items[i];
          return Material(
            color: AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(AppRadius.card),
            child: ListTile(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.card),
                side: const BorderSide(color: AppColors.borderDefault),
              ),
              leading: Icon(item.icon, color: AppColors.primary700),
              title: Text(
                item.label,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              trailing: const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textFaint,
              ),
              onTap: () =>
                  Navigator.of(context)
                      .push(MaterialPageRoute(builder: item.builder)),
            ),
          );
        },
      ),
    );
  }
}
