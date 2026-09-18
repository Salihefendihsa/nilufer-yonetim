import 'package:flutter/material.dart';

import '../features/appointment_requests/my_appointment_requests_screen.dart';
import '../features/contracts/contracts_list_screen.dart';
import '../features/admin/data_deletion_screens.dart';
import '../features/customers/customer_data_export_screen.dart';
import '../features/customers/referral_screen.dart';
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
      // Bölüm J (3. tur): müşteri kendi hesabından randevu talebi açar.
      (
        label: 'Randevu Taleplerim',
        icon: Icons.event_available_outlined,
        builder: (_) => const MyAppointmentRequestsScreen(),
      ),
      // Bölüm P (4. tur): davet kodu/linki — indirim/ödül yok, yalnızca takip.
      (
        label: 'Arkadaşını Davet Et',
        icon: Icons.card_giftcard_outlined,
        builder: (_) => const ReferralScreen(),
      ),
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
      // Bölüm AJ (8. tur): KVKK veri taşınabilirliği — kendi verisini indir.
      (
        label: 'Verilerimi İndir',
        icon: Icons.download_outlined,
        builder: (_) => const CustomerDataExportScreen(),
      ),
      // Bölüm AD (7. tur): KVKK veri silme talebi.
      (
        label: 'Hesabımı ve Verilerimi Sil',
        icon: Icons.person_off_outlined,
        builder: (_) => const CustomerDataDeletionScreen(),
      ),
    ];

    return Scaffold(
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
