import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';

/// Yükleniyor göstergesi — tüm ekranlarda ortak, Stitch'in "skeleton" yerine
/// basit ama tutarlı bir spinner kullanır (kapsam gerçek veri odaklı tutuldu).
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    return Center(
      child: CircularProgressIndicator(color: cs.accentSoft, strokeWidth: 2.5),
    );
  }
}

/// Kart içi küçük yükleniyor göstergesi — tam sayfa `LoadingView` yerine
/// dashboard/detay kartlarında (Puantaj, Araç Bakımı, Takvim dışa aktarma
/// gibi) tek bir bölümün yüklendiğini göstermek için (tasarım turu cila:
/// önceden her kart kendi `CircularProgressIndicator` kopyasını yazıyordu).
class InlineLoading extends StatelessWidget {
  const InlineLoading({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: cs.accentSoft,
          ),
        ),
      ),
    );
  }
}

/// Hata durumu + "Tekrar Dene" butonu — her API çağrısı bu widget'ı kullanmalı.
class ErrorRetryView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const ErrorRetryView({
    super.key,
    required this.message,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, color: cs.danger500, size: 40),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: tx.body.copyWith(color: cs.textSecondary),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Tekrar Dene'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Boş liste durumu.
class EmptyStateView extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData icon;

  const EmptyStateView({
    super.key,
    required this.title,
    this.subtitle,
    this.icon = Icons.inbox_rounded,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: cs.textFaint, size: 40),
            const SizedBox(height: 12),
            Text(title, textAlign: TextAlign.center, style: tx.subtitle),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(subtitle!, textAlign: TextAlign.center, style: tx.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}
