import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../features/approvals/approvals_screen.dart';
import '../features/calendar/calendar_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/jobs/jobs_list_screen.dart';
import '../features/messages/messages_list_screen.dart';
import '../models/user.dart';
import '../theme/app_colors.dart';
import 'app_drawer.dart';
import 'manager_nav.dart';
import 'manager_shell.dart';
import 'more_menu_screen.dart';
import 'nav_items.dart';
import 'staff_shell.dart';
import 'team_lead_shell.dart';

class _NavItem {
  final String label;
  final IconData icon;
  final Widget screen;
  const _NavItem(this.label, this.icon, this.screen);
}

/// Stitch'in floating alt navigasyonunun (Ana Sayfa/İşler/.../Mesajlar) rol
/// bazlı Flutter karşılığı. OWNER/MANAGER Stitch'teki "patron" sekme setini
/// alır; TEAM_LEAD/STAFF/CUSTOMER aynı tasarım dilinde kendi kapsamlarına
/// uygun sekmeler görür (bkz. docs/STITCH_FEATURE_MATRIX.md).
///
/// Faz 1-5 tamamlandıktan sonra tüm sekmeler gerçek API'lere bağlıdır;
/// henüz bağlanmamış hiçbir modül kalmadı (Mesajlar/Bildirimler/Denetim
/// dahil) — bkz. docs/STITCH_FEATURE_MATRIX.md ilerleme tablosu.
class RoleShell extends StatefulWidget {
  const RoleShell({super.key});

  @override
  State<RoleShell> createState() => _RoleShellState();
}

class _RoleShellState extends State<RoleShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  int _index = 0;

  /// Çekmece ve "Daha Fazla" sekmesi aynı listeden beslenir
  /// (navigation/nav_items.dart — tek doğruluk kaynağı).
  List<_NavItem> _itemsFor(AppRole role) {
    switch (role) {
      case AppRole.owner:
      case AppRole.manager:
        // MANAGER kendi kabuğunu (ManagerShell) kullanır; buraya yalnızca
        // OWNER düşer. Yine de switch bütünlüğü için ikisi birlikte durur.
        return const [
          _NavItem('Ana Sayfa', Icons.dashboard_rounded, DashboardScreen()),
          _NavItem('İşler', Icons.assignment_rounded, JobsListScreen()),
          _NavItem('Onaylar', Icons.fact_check_rounded, ApprovalsScreen()),
          _NavItem('Mesajlar', Icons.chat_bubble_rounded, MessagesListScreen()),
          _NavItem('Daha Fazla', Icons.menu_rounded, MoreMenuScreen()),
        ];
      case AppRole.teamLead:
      case AppRole.staff:
        // TEAM_LEAD/STAFF kendi kabuklarını (TeamLeadShell/StaffShell)
        // kullanır — bu kola asla düşülmez (bkz. build() içindeki erken
        // dönüş), yalnızca switch bütünlüğü için burada durur.
        return const [
          _NavItem('Ana Sayfa', Icons.dashboard_rounded, DashboardScreen()),
        ];
      case AppRole.customer:
        // web/src/components/Sidebar.tsx'te CUSTOMER için görünen Takvim ve
        // Bildirimler daha önce mobilde hiç yoktu (bkz.
        // docs/WEB_MOBILE_PARITY.md). Alt navigasyon 5 sekmeyle sınırlı
        // tutulduğu için Sözleşmelerim + Bildirimler "Daha Fazla" altına
        // taşındı (MoreMenuScreen) — Para burada YOK, web'de de
        // yalnızca OWNER/MANAGER'a açık (Sidebar.tsx), bu bir eksik değil.
        return const [
          _NavItem('Ana Sayfa', Icons.dashboard_rounded, DashboardScreen()),
          _NavItem('İşlerim', Icons.assignment_rounded, JobsListScreen()),
          _NavItem('Takvim', Icons.calendar_month_rounded, CalendarScreen()),
          _NavItem('Mesajlar', Icons.chat_bubble_rounded, MessagesListScreen()),
          _NavItem('Daha Fazla', Icons.menu_rounded, MoreMenuScreen()),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) return const SizedBox.shrink();

    // Müdür rolü, Stitch'in "mudur" paketindeki 4 sekmeli + çekmeceli
    // düzenini kullanır (bkz. navigation/manager_shell.dart).
    if (user.role == AppRole.manager) return const ManagerShell();

    // Şef rolü, Stitch'in "sef" paketindeki 4 sekmeli + çekmeceli düzeni
    // kullanır (bkz. navigation/team_lead_shell.dart).
    if (user.role == AppRole.teamLead) return const TeamLeadShell();

    // Personel rolü, Stitch'in "personel" paketindeki 4 sekmeli + çekmeceli
    // düzeni kullanır (bkz. navigation/staff_shell.dart).
    if (user.role == AppRole.staff) return const StaffShell();

    final items = _itemsFor(user.role);
    final index = _index < items.length ? _index : 0;

    final isCustomer = user.role == AppRole.customer;
    final drawerRoleLabel = isCustomer ? 'Müşteri' : 'Patron';
    final drawerGroups = navGroupsFor(user.role);

    return ManagerNav(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        drawer: AppDrawer(roleLabel: drawerRoleLabel, groups: drawerGroups),
        body: IndexedStack(
          index: index,
          children: items.map((e) => e.screen).toList(),
        ),
        bottomNavigationBar: NavigationBarTheme(
          data: NavigationBarThemeData(
            backgroundColor: Theme.of(context).colorScheme.surface,
            indicatorColor: Theme.of(context).brightness == Brightness.dark ? AppDarkColors.primary50 : AppColors.primary50,
            labelTextStyle: WidgetStateProperty.resolveWith((states) {
              final selected = states.contains(WidgetState.selected);
              return TextStyle(
                fontSize: 11.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? AppColors.primary700
                    : AppColors.textSecondary,
              );
            }),
          ),
          child: NavigationBar(
            selectedIndex: index,
            onDestinationSelected: (i) => setState(() => _index = i),
            destinations: items
                .map(
                  (e) => NavigationDestination(
                    icon: Icon(e.icon, color: AppColors.textSecondary),
                    selectedIcon: Icon(e.icon, color: AppColors.primary700),
                    label: e.label,
                  ),
                )
                .toList(),
          ),
        ),
      ),
    );
  }
}
