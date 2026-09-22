import 'package:flutter/material.dart';

import 'search_screen.dart';

/// Bölüm I (3. tur) global arama için AppBar aksiyonu. Tasarım denetimi
/// §3.4: arama önceden yalnızca Ana Sayfa AppBar'ındaydı; artık tüm sekme
/// ekranlarının AppBar'ında (kabuk seviyesi) ve çekmecede aynı giriş var.
/// Sunucu rol kapsamını uygular; tüm roller kullanabilir.
class SearchAction extends StatelessWidget {
  const SearchAction({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.search_rounded),
      tooltip: 'Ara',
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const SearchScreen()),
      ),
    );
  }
}
