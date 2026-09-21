import 'package:flutter/material.dart';

import '../features/dashboard/dashboard_screen.dart';
import '../features/jobs/job_form_screen.dart';
import '../features/jobs/jobs_list_screen.dart';
import '../features/messages/messages_list_screen.dart';
import '../models/user.dart';
import '../theme/app_colors.dart';
import 'app_drawer.dart';
import 'manager_nav.dart';
import 'more_menu_screen.dart';
import 'nav_items.dart';

/// MANAGER (Müdür) rolüne özel kabuk — Stitch "mudur" paketindeki 4 sekmeli
/// yüzen alt navigasyon + ortadaki 56px "yeni iş" butonu + kayan menü
/// çekmecesi düzeninin Flutter karşılığı.
///
/// Çekmece ve "Daha Fazla" sekmesi `navGroupsFor(AppRole.manager)`'dan
/// beslenir (tek kaynak). Denetim Logları / Sistem Durumu / Kullanım
/// İstatistikleri MANAGER'a kapalı olduğu için orada YOKTUR
/// (bkz. docs/STITCH_FEATURE_MATRIX.md — Faz 6).
///
/// Tasarım denetimi #1: önceden 4. sekme "Bildirimler"di ve "Daha Fazla"
/// yoktu → çekmecede olmayan Şikayetler ve Yönetici Özeti MANAGER için
/// mobilde erişilemezdi. Ortadaki FAB simetriyi (2 | FAB | 2) gerektirdiği
/// için 5. sekme eklenemez; Bildirimler çekmece/"Daha Fazla"nın "Genel"
/// grubuna taşındı, 4. sekme "Daha Fazla" oldu.
class ManagerShell extends StatefulWidget {
  const ManagerShell({super.key});

  @override
  State<ManagerShell> createState() => _ManagerShellState();
}

class _ManagerShellState extends State<ManagerShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  int _index = 0;

  static const _tabs = <({String label, IconData icon, Widget screen})>[
    (
      label: 'Ana Sayfa',
      icon: Icons.dashboard_rounded,
      screen: DashboardScreen(),
    ),
    (label: 'İşler', icon: Icons.assignment_rounded, screen: JobsListScreen()),
    (
      label: 'Mesajlar',
      icon: Icons.chat_bubble_rounded,
      screen: MessagesListScreen(),
    ),
    (label: 'Daha Fazla', icon: Icons.menu_rounded, screen: MoreMenuScreen()),
  ];

  static final _groups = navGroupsFor(AppRole.manager);

  @override
  Widget build(BuildContext context) {
    return ManagerNav(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        drawer: AppDrawer(roleLabel: 'Müdür', groups: _groups),
        body: IndexedStack(
          index: _index,
          children: _tabs.map((t) => t.screen).toList(),
        ),
        floatingActionButton: SizedBox(
          height: 56,
          width: 56,
          child: FloatingActionButton(
            heroTag: 'manager-new-job',
            backgroundColor: AppColors.primary500,
            foregroundColor: Colors.white,
            elevation: 4,
            shape: const CircleBorder(),
            tooltip: 'Yeni İş',
            onPressed: () async {
              await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (_) => const JobFormScreen()),
              );
            },
            child: const Icon(Icons.add_rounded, size: 28),
          ),
        ),
        floatingActionButtonLocation:
            FloatingActionButtonLocation.centerDocked,
        bottomNavigationBar: BottomAppBar(
          color: AppColors.surfaceBase,
          elevation: 8,
          shape: const CircularNotchedRectangle(),
          notchMargin: 8,
          height: 68,
          padding: EdgeInsets.zero,
          child: Row(
            children: [
              _tabButton(0),
              _tabButton(1),
              const SizedBox(width: 56), // FAB oyuğu
              _tabButton(2),
              _tabButton(3),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tabButton(int i) {
    final tab = _tabs[i];
    final selected = _index == i;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _index = i),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              tab.icon,
              size: 22,
              color: selected ? AppColors.primary700 : AppColors.textSecondary,
            ),
            const SizedBox(height: 2),
            Text(
              tab.label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? AppColors.primary700
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
