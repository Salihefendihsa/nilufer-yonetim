import 'package:flutter/material.dart';

import '../features/calendar/calendar_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/evaluations/evaluations_screen.dart';
import '../features/jobs/jobs_list_screen.dart';
import '../features/leave_requests/leave_requests_screen.dart';
import '../features/messages/messages_list_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../theme/app_colors.dart';
import 'app_drawer.dart';
import 'manager_nav.dart';

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

  static const _groups = <AppDrawerGroup>[
    AppDrawerGroup([
      AppDrawerEntry('Takvim', Icons.calendar_month_outlined, _buildCalendar),
      // Formal Değerlendirme sistemi — kendi aldığı değerlendirmeleri salt
      // okunur görür, değerlendirenin kimliği backend tarafından zaten gizlenir.
      AppDrawerEntry(
        'Değerlendirmelerim',
        Icons.checklist_rtl_outlined,
        _buildEvaluations,
      ),
      AppDrawerEntry(
        'İzinlerim',
        Icons.event_busy_outlined,
        _buildLeaveRequests,
      ),
    ]),
  ];

  static Widget _buildCalendar(BuildContext _) => const CalendarScreen();
  static Widget _buildEvaluations(BuildContext _) => const EvaluationsScreen();
  static Widget _buildLeaveRequests(BuildContext _) => const LeaveRequestsScreen();

  @override
  Widget build(BuildContext context) {
    return ManagerNav(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        drawer: const AppDrawer(roleLabel: 'Personel', groups: _groups),
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
