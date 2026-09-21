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

/// TEAM_LEAD (Şef) rolüne özel kabuk — Stitch "sef" paketindeki 4 sekmeli alt
/// navigasyon + kayan çekmece düzeni.
///
/// Çekmecedeki liste, Stitch'in 8 ekranındaki `data-path` değerleriyle ve
/// şefin GERÇEK yetki haritasıyla birebir örtüşür: **7 sayfa** — Ana Sayfa,
/// Takvim, Bildirimler, Mesajlar, Performans, İşler, Ayarlar.
///
/// Burada BULUNMAYANLAR (şefin yetkisi yok, bilerek eklenmedi):
/// Müşteriler, Personel yönetimi, Sözleşmeler,
/// Teklifler, Para/Finans, Raporlar, Denetim/Sistem/Kullanım İstatistikleri.
/// Stok ise salt okunur + satın alma talebi (Faz 8'de zaten backend/Flutter'da
/// tam uygulanmıştı) kapsamında **çekmeceye eklendi** (2026-09-10 parite
/// denetiminde bulundu: backend + `StockListScreen` zaten TEAM_LEAD'i
/// destekliyordu, yalnızca menü yolu eksikti).
/// Stitch'in DESIGN.md metninde geçen "Kimyasal & Ekipman Stoğu",
/// "Müşteri & Lokasyon Dizini", "Ekip Yetkilendirme & Takip" gibi maddeler
/// gerçek ekranların çekmecesinde YOKTUR ve uygulanmamıştır
/// (bkz. docs/STITCH_FEATURE_MATRIX.md Faz 8 → Yetki Çelişkileri).
class TeamLeadShell extends StatefulWidget {
  const TeamLeadShell({super.key});

  @override
  State<TeamLeadShell> createState() => _TeamLeadShellState();
}

class _TeamLeadShellState extends State<TeamLeadShell> {
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

  /// Çekmece içeriği: navigation/nav_items.dart (tek kaynak). Tasarım
  /// denetimi #1 ile "Bekleyen Onaylar" eklendi (web'de TEAM_LEAD izin
  /// taleplerini oradan karara bağlıyordu, mobilde giriş yoktu).
  static final _groups = navGroupsFor(AppRole.teamLead);

  @override
  Widget build(BuildContext context) {
    return ManagerNav(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        drawer: AppDrawer(roleLabel: 'Ekip Lideri', groups: _groups),
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
