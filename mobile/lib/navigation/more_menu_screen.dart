import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../features/search/search_action.dart';
import '../theme/app_colors.dart';
import 'app_drawer.dart';
import 'manager_nav.dart';
import 'nav_items.dart';

/// Alt navigasyondaki "Daha Fazla" sekmesi — rolün ikincil modüllerini
/// gruplu liste olarak gösterir. İçerik `navGroupsFor(role)`'dan gelir; yani
/// hamburger çekmecesiyle (AppDrawer) birebir AYNI küme (tasarım denetimi
/// §3.3: önceden OWNER için 17 öğelik düz liste + 12 öğelik farklı bir
/// drawer vardı, CUSTOMER için de ikisi senkron değildi).
///
/// Tüm roller için tek widget: eski `CustomerMoreMenuScreen` kaldırıldı.
class MoreMenuScreen extends StatelessWidget {
  const MoreMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthProvider>().user?.role;
    final groups = role == null ? const <AppDrawerGroup>[] : navGroupsFor(role);

    return Scaffold(
      appBar: AppBar(
        leading: ManagerNav.maybeLeading(context),
        title: const Text('Daha Fazla'),
        actions: const [SearchAction()],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          for (final group in groups) ...[
            if (group.title != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
                child: Text(
                  group.title!.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    letterSpacing: 0.6,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textFaint,
                  ),
                ),
              ),
            for (final entry in group.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _MoreTile(entry: entry),
              ),
          ],
        ],
      ),
    );
  }
}

class _MoreTile extends StatelessWidget {
  final AppDrawerEntry entry;
  const _MoreTile({required this.entry});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: ListTile(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: const BorderSide(color: AppColors.borderDefault),
        ),
        leading: Icon(entry.icon, color: AppColors.primary700),
        title: Text(
          entry.label,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        trailing: const Icon(
          Icons.chevron_right_rounded,
          color: AppColors.textFaint,
        ),
        onTap: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: entry.builder)),
      ),
    );
  }
}
