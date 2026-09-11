import 'package:flutter/material.dart';

/// Bir listedeki her öğeyi, sırayla (staggered) hafif kayarak belirir hale
/// getirir — web'in framer-motion tabanlı sayfa/kart geçişlerine mobil
/// karşılığı. `index` arttıkça gecikme artar, listenin ilk render'ında
/// tek seferlik oynar (yeniden build'de tekrar oynamaz — [key] bunu sağlar).
class StaggeredFadeIn extends StatelessWidget {
  final int index;
  final Widget child;
  final Duration baseDelay;
  final Duration duration;

  const StaggeredFadeIn({
    super.key,
    required this.index,
    required this.child,
    this.baseDelay = const Duration(milliseconds: 30),
    this.duration = const Duration(milliseconds: 260),
  });

  @override
  Widget build(BuildContext context) {
    final delayMs = (baseDelay.inMilliseconds * index).clamp(0, 400);
    return TweenAnimationBuilder<double>(
      key: ValueKey('staggered-$index'),
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: duration.inMilliseconds + delayMs),
      curve: Interval(
        (delayMs / (duration.inMilliseconds + delayMs)).clamp(0.0, 0.9),
        1,
        curve: Curves.easeOutCubic,
      ),
      builder: (context, value, _) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, (1 - value) * 12),
            child: child,
          ),
        );
      },
    );
  }
}
