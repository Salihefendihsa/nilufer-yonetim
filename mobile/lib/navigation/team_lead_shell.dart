import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../features/calendar/calendar_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/jobs/jobs_list_screen.dart';
import '../features/messages/messages_list_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/performance/performance_screen.dart';
import '../features/settings/settings_screen.dart';
import '../theme/app_colors.dart';
import 'manager_nav.dart';

class _DrawerEntry {
  final String label;
  final IconData icon;
  final WidgetBuilder builder;
  const _DrawerEntry(this.label, this.icon, this.builder);
}

/// TEAM_LEAD (Şef) rolüne özel kabuk — Stitch "sef" paketindeki 4 sekmeli alt
/// navigasyon + kayan çekmece düzeni.
///
/// Çekmecedeki liste, Stitch'in 8 ekranındaki `data-path` değerleriyle ve
/// şefin GERÇEK yetki haritasıyla birebir örtüşür: **7 sayfa** — Ana Sayfa,
/// Takvim, Bildirimler, Mesajlar, Performans, İşler, Ayarlar.
///
/// Burada BULUNMAYANLAR (şefin yetkisi yok, bilerek eklenmedi):
/// Bekleyen Onaylar, Müşteriler, Personel yönetimi, Stok yazma, Sözleşmeler,
/// Teklifler, Para/Finans, Raporlar, Denetim/Sistem/Kullanım İstatistikleri.
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

  static const _drawerEntries = <_DrawerEntry>[
    _DrawerEntry('Takvim', Icons.calendar_month_outlined, _buildCalendar),
    _DrawerEntry('Performans', Icons.emoji_events_outlined, _buildPerformance),
  ];

  static Widget _buildCalendar(BuildContext _) => const CalendarScreen();
  static Widget _buildPerformance(BuildContext _) => const PerformanceScreen();

  void _open(WidgetBuilder builder) {
    Navigator.of(context).pop();
    Navigator.of(context).push(MaterialPageRoute(builder: builder));
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return ManagerNav(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: AppColors.surfacePage,
        drawer: Drawer(
          backgroundColor: AppColors.surfaceBase,
          child: SafeArea(
            bottom: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.primary700, Color(0xFF1E3621)],
                    ),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor: Colors.white24,
                        child: Text(
                          (user?.fullName.trim().isNotEmpty ?? false)
                              ? user!.fullName.trim()[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?.fullName ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text(
                                'Ekip Lideri',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: [
                      // Alt sekmedeki 4 sayfa burada tekrar edilmez; çekmece
                      // yalnızca sekmesi olmayan sayfaları taşır.
                      for (final entry in _drawerEntries)
                        ListTile(
                          dense: true,
                          leading: Icon(
                            entry.icon,
                            size: 21,
                            color: AppColors.primary700,
                          ),
                          title: Text(
                            entry.label,
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          onTap: () => _open(entry.builder),
                        ),
                      const Divider(height: 24),
                      ListTile(
                        dense: true,
                        leading: const Icon(
                          Icons.settings_outlined,
                          size: 21,
                          color: AppColors.textSecondary,
                        ),
                        title: const Text(
                          'Ayarlar',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        onTap: () => _open((_) => const SettingsScreen()),
                      ),
                      ListTile(
                        dense: true,
                        leading: const Icon(
                          Icons.logout_rounded,
                          size: 21,
                          color: AppColors.danger500,
                        ),
                        title: const Text(
                          'Çıkış Yap',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.danger500,
                          ),
                        ),
                        onTap: () {
                          Navigator.of(context).pop();
                          context.read<AuthProvider>().logout();
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        body: IndexedStack(
          index: _index,
          children: _tabs.map((t) => t.screen).toList(),
        ),
        bottomNavigationBar: NavigationBarTheme(
          data: NavigationBarThemeData(
            backgroundColor: AppColors.surfaceBase,
            indicatorColor: AppColors.primary50,
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
