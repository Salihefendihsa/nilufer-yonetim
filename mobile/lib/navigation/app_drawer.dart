import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../features/settings/settings_screen.dart';
import '../theme/app_colors.dart';
import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';

class AppDrawerEntry {
  final String label;
  final IconData icon;
  final WidgetBuilder builder;
  const AppDrawerEntry(this.label, this.icon, this.builder);
}

class AppDrawerGroup {
  final String? title;
  final List<AppDrawerEntry> entries;
  const AppDrawerGroup(this.entries, {this.title});
}

/// Tüm rol kabuklarının (OWNER/MANAGER/TEAM_LEAD/STAFF/CUSTOMER) ortak
/// çekmece (Drawer) widget'ı — kullanıcı bilgisi başlıkta, altında role özel
/// menü grupları, en altta sabit Ayarlar + Çıkış Yap. Önceden her kabuk
/// (manager_shell.dart, team_lead_shell.dart, staff_shell.dart) aynı
/// yapıyı ayrı ayrı tekrarlıyordu; artık hepsi bu widget'ı kullanıyor.
class AppDrawer extends StatelessWidget {
  final String roleLabel;
  final List<AppDrawerGroup> groups;

  const AppDrawer({super.key, required this.roleLabel, required this.groups});

  void _open(BuildContext context, WidgetBuilder builder) {
    Navigator.of(context).pop();
    Navigator.of(context).push(MaterialPageRoute(builder: builder));
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final user = context.watch<AuthProvider>().user;

    return Drawer(
      backgroundColor: Theme.of(context).colorScheme.surface,
      child: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [cs.primary700, Color(0xFF1E3521)],
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: Colors.white24,
                    child: Text(
                      (user?.fullName.trim().isNotEmpty ?? false)
                          ? user!.fullName.trim()[0].toUpperCase()
                          : '?',
                      style: tx.display.copyWith(color: Colors.white),
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
                          style: tx.subtitle.copyWith(
                            color: Colors.white,
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
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            roleLabel,
                            style: tx.label.copyWith(
                              color: Colors.white,
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
                  for (final group in groups) ...[
                    if (group.title != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 14, 20, 6),
                        child: Text(
                          group.title!.toUpperCase(),
                          style: tx.label.copyWith(letterSpacing: 0.6),
                        ),
                      ),
                    for (final entry in group.entries)
                      ListTile(
                        dense: true,
                        leading: Icon(entry.icon, size: 21, color: cs.accent),
                        title: Text(entry.label, style: tx.subtitle),
                        onTap: () => _open(context, entry.builder),
                      ),
                  ],
                  const Divider(height: 24),
                  ListTile(
                    dense: true,
                    leading: Icon(
                      Icons.settings_outlined,
                      size: 21,
                      color: cs.textSecondary,
                    ),
                    title: Text('Ayarlar', style: tx.subtitle),
                    onTap: () => _open(context, (_) => const SettingsScreen()),
                  ),
                  ListTile(
                    dense: true,
                    leading: Icon(
                      Icons.logout_rounded,
                      size: 21,
                      color: cs.danger500,
                    ),
                    title: Text(
                      'Çıkış Yap',
                      style: tx.subtitle.copyWith(color: cs.danger500),
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
    );
  }
}
