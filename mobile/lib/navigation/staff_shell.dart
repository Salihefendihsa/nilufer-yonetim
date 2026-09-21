import 'package:flutter/material.dart';

import '../features/dashboard/dashboard_screen.dart';
import '../features/jobs/jobs_list_screen.dart';
import '../features/messages/messages_list_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../models/user.dart';
import '../theme/app_colors.dart';
import 'app_drawer.dart';
import 'manager_nav.dart';
import 'nav_items.dart';

/// STAFF (Personel) rolüne özel kabuk — Stitch "personel" paketindeki 4
/// sekmeli alt navigasyon + kayan çekmece düzeni (bkz. TeamLeadShell/
/// ManagerShell ile aynı desen).
///
/// Çekmecedeki liste, Stitch'in 8 ekranındaki `data-path` değerleriyle ve
/// personelin GERÇEK yetki haritasıyla birebir örtüşür: **6 sayfa** — Ana
/// Sayfa, Takvim, İşler, Bildirimler, Mesajlar, Ayarlar.
///
/// Burada BULUNMAYANLAR (personelin yetkisi yok, bilerek eklenmedi):
/// Müşteri listesi (kendi işlerindeki müşteriler dışında), Personel
/// yönetimi, Stok (yazma/tam liste — GET /products yalnızca rapor formunda
/// ürün seçmek için arka planda kullanılır, ayrı bir "Stok" sekmesi YOKTUR),
/// Para & Finans, Teklifler, Sözleşmeler, Raporlar, Performans (ekip
/// sıralaması), Denetim/Ayarlar (sistem geneli). Stitch'in alt
/// navigasyonundaki ortadaki "QR Kod Tara" hızlı işlem butonu ve
/// bildirimlerdeki "Merkez Depodan Talep Et" aksiyonu KASITLI OLARAK
/// uygulanmadı (bkz. docs/STITCH_FEATURE_MATRIX.md Faz 9 → Yetki
/// Çelişkileri / Açık Sorular).
class StaffShell extends StatefulWidget {
  const StaffShell({super.key});

  @override
  State<StaffShell> createState() => _StaffShellState();
}

class _StaffShellState extends State<StaffShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  int _index = 0;

  static const _tabs = <({String label, IconData icon, Widget screen})>[
    (
      label: 'Ana Sayfa',
      icon: Icons.home_rounded,
      screen: DashboardScreen(),
    ),
    (label: 'İşler', icon: Icons.build_rounded, screen: JobsListScreen()),
    (
      label: 'Bildirimler',
      icon: Icons.notifications_rounded,
      screen: NotificationsScreen(),
    ),
    (
      label: 'Mesajlar',
      icon: Icons.chat_bubble_rounded,
      screen: MessagesListScreen(),
    ),
  ];

  /// Çekmece içeriği: navigation/nav_items.dart (tek kaynak).
  static final _groups = navGroupsFor(AppRole.staff);

  @override
  Widget build(BuildContext context) {
    return ManagerNav(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        drawer: AppDrawer(roleLabel: 'Personel', groups: _groups),
        body: IndexedStack(
          index: _index,
          children: _tabs.map((t) => t.screen).toList(),
        ),
        bottomNavigationBar: NavigationBarTheme(
          data: NavigationBarThemeData(
            backgroundColor: Theme.of(context).colorScheme.surface,
            indicatorColor: Theme.of(context).brightness == Brightness.dark ? AppDarkColors.primary50 : AppColors.primary50,
            labelTextStyle: WidgetStateProperty.resolveWith((states) {
              final selected = states.contains(WidgetState.selected);
              return TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? AppColors.primary700
                    : AppColors.textSecondary,
              );
            }),
          ),
          child: NavigationBar(
            height: 68,
            selectedIndex: _index,
            onDestinationSelected: (i) => setState(() => _index = i),
            destinations: _tabs
                .map(
                  (t) => NavigationDestination(
                    icon: Icon(t.icon, color: AppColors.textSecondary),
                    selectedIcon: Icon(t.icon, color: AppColors.primary700),
                    label: t.label,
                  ),
                )
                .toList(),
          ),
        ),
      ),
    );
  }
}
