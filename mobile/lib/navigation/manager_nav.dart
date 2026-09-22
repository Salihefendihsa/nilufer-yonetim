import 'package:flutter/material.dart';

import '../theme/app_palette.dart';

/// Müdür kabuğunun çekmecesini alt ekranlara açar.
///
/// Sekme ekranları kendi `Scaffold`'unu kurduğu için `Scaffold.of(context)`
/// en yakın (iç) Scaffold'u döndürür ve dış kabuğun çekmecesini açamaz.
/// Bu InheritedWidget, dış kabuğun `openDrawer` geri çağrısını ağaçtan
/// aşağıya taşır; müdür kabuğu dışında (patron/personel/müşteri rolleri)
/// bulunmadığı için `maybeLeading` orada `null` döner ve AppBar'lar
/// eskisi gibi davranır.
class ManagerNav extends InheritedWidget {
  final VoidCallback openDrawer;

  const ManagerNav({super.key, required this.openDrawer, required super.child});

  static ManagerNav? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ManagerNav>();

  /// Müdür kabuğu içindeysek hamburger butonu, değilse `null` döner.
  static Widget? maybeLeading(BuildContext context) {
    final cs = context.colors;
    final nav = maybeOf(context);
    if (nav == null) return null;
    return IconButton(
      icon: Icon(Icons.menu_rounded, color: cs.textPrimary),
      tooltip: 'Menü',
      onPressed: nav.openDrawer,
    );
  }

  @override
  bool updateShouldNotify(ManagerNav oldWidget) =>
      openDrawer != oldWidget.openDrawer;
}
