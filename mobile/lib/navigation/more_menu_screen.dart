import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../features/search/search_action.dart';
import '../theme/app_colors.dart';
import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';
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
    final tx = context.text;
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
                  style: tx.label.copyWith(letterSpacing: 0.6),
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
    final cs = context.colors;
    final tx = context.text;
    return Material(
      color: cs.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: ListTile(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: BorderSide(color: cs.borderDefault),
        ),
        leading: Icon(entry.icon, color: cs.accent),
        title: Text(entry.label, style: tx.subtitle),
        trailing: Icon(Icons.chevron_right_rounded, color: cs.textFaint),
        onTap: () =>
            Navigator.of(context)
                .push(MaterialPageRoute(builder: entry.builder)),
      ),
    );
  }
}
