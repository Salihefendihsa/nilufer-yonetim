import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../models/user.dart';
import 'app_drawer.dart';
import 'nav_items.dart';

/// Ayarlar altındaki "drill-down" alt sayfalar (Tedarikçiler, İş Şablonları,
/// Müşteri Etiketleri, Hizmet Türleri, Semtler, Değerlendirme Kriterleri,
/// Parti/SKT vb.) için paylaşılan Scaffold — geri tuşunu KORUR (`leading`
/// hep BackButton; `Scaffold.drawer` varlığının onu hamburger'a çevirmesini
/// engellemek için bilerek elle veriliyor), ayrıca AppBar'a "Menü" aksiyonu
/// ekleyip kendi drawer'ını taşır. Önceden bu ekranlardan başka bir bölüme
/// geçmek için "geri, geri, geri..." ile kök ekrana dönüp oradan hamburger
/// açmak gerekiyordu; artık derinlerdeyken de tek dokunuşla mümkün.
///
/// Rol bazlı grup listesi `navigation/nav_items.dart` (tek kaynak) ile
/// `AppDrawer`'ın kendisi zaten paylaşıldığı için burada yalnızca "aynı
/// ikisini bir de pushed route'larda kur" işi kalıyor — her ekran kendi
/// Scaffold+AppBar+drawer'ını tekrar yazmak yerine bu widget'ı kullanır.
class SubPageScaffold extends StatelessWidget {
  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final PreferredSizeWidget? bottom;

  const SubPageScaffold({
    super.key,
    required this.title,
    required this.body,
    this.actions,
    this.floatingActionButton,
    this.bottom,
  });

  /// Drawer başlığındaki rol etiketi — mevcut kabukların (role_shell,
  /// manager_shell, team_lead_shell, staff_shell) her birinde ayrı ayrı
  /// yazılmış aynı eşlemenin tek kaynağı.
  static String roleLabel(AppRole role) {
    switch (role) {
      case AppRole.owner:
        return 'Patron';
      case AppRole.manager:
        return 'Müdür';
      case AppRole.teamLead:
        return 'Ekip Lideri';
      case AppRole.staff:
        return 'Personel';
      case AppRole.customer:
        return 'Müşteri';
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthProvider>().user?.role;
    final groups = role == null
        ? const <AppDrawerGroup>[]
        : navGroupsFor(role);

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        leading: const BackButton(),
        bottom: bottom,
        actions: [
          ...?actions,
          Builder(
            builder: (ctx) => IconButton(
              icon: const Icon(Icons.menu_rounded),
              tooltip: 'Menü',
              onPressed: () => Scaffold.of(ctx).openDrawer(),
            ),
          ),
        ],
      ),
      drawer: AppDrawer(
        roleLabel: role == null ? '' : roleLabel(role),
        groups: groups,
      ),
      body: body,
      floatingActionButton: floatingActionButton,
    );
  }
}
