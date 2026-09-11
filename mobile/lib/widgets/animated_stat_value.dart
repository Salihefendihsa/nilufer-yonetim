import 'package:flutter/material.dart';

/// Basit bir sayaç değeri ("128", "%80", "12 iş" gibi — ondalık/binlik ayraç
/// İÇERMEYEN saf tam sayılı metinler) 0'dan gerçek değerine doğru sayarak
/// artar. Ondalıklı/para birimi gibi ayraçlı değerler (belirsizlik riski
/// taşıdığı için — "12.500" binlik mi ondalık mı) animasyonsuz, olduğu gibi
/// gösterilir; bu widget o durumda sade bir [Text] gibi davranır.
class AnimatedStatValue extends StatelessWidget {
  final String value;
  final TextStyle? style;
  final Duration duration;

  const AnimatedStatValue({
    super.key,
    required this.value,
    this.style,
    this.duration = const Duration(milliseconds: 700),
  });

  static final _pattern = RegExp(r'^(\D*)(\d+)(\D*)$');

  @override
  Widget build(BuildContext context) {
    final match = _pattern.firstMatch(value);
    if (match == null) {
      return Text(value, style: style);
    }
    final prefix = match.group(1) ?? '';
    final target = int.tryParse(match.group(2)!);
    final suffix = match.group(3) ?? '';
    if (target == null) {
      return Text(value, style: style);
    }

    return TweenAnimationBuilder<double>(
      key: ValueKey(value),
      tween: Tween(begin: 0, end: target.toDouble()),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (context, animatedValue, _) {
        return Text('$prefix${animatedValue.round()}$suffix', style: style);
      },
    );
  }
}
