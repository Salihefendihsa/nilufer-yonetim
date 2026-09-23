import 'package:flutter/material.dart';

/// Yatay kaydırılabilir filtre çipi satırı (İşler, Onaylar, Teklifler, Stok…).
///
/// Önceden her ekran `SizedBox(height: 46, child: ListView(horizontal))`
/// kullanıyordu: dikey boşluk sonrası çipe tam ~34 px kalıyordu, cihaz yazı
/// boyutu 1.0'ın üstündeyken çip metni dikeyde kırpılıyor ("oranı bozuk"),
/// sağ kenarda da hiçbir ipucu olmadan kesiliyordu. Burada yükseklik içeriğe
/// göre belirlenir ve sağ kenar hafifçe solarak kaydırılabilirliği gösterir.
class ChipBar extends StatelessWidget {
  final List<Widget> children;
  final EdgeInsetsGeometry padding;
  final double spacing;

  const ChipBar({
    super.key,
    required this.children,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
    this.spacing = 8,
  });

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) => LinearGradient(
        colors: const [Colors.black, Colors.black, Colors.transparent],
        stops: [0, rect.width <= 32 ? 0 : 1 - 20 / rect.width, 1],
      ).createShader(rect),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: padding,
        child: Row(
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) SizedBox(width: spacing),
              children[i],
            ],
          ],
        ),
      ),
    );
  }
}
