import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../theme/app_colors.dart';

/// Bölüm AC (7. tur) — GÜVENLİK: dosyalar yalnızca kimlik doğrulamalı
/// `GET /files/:type/:id` ucundan gelir. `Image.network` Authorization
/// header'ı taşıyabildiği için token okunup header olarak eklenir — token'sız
/// URL yüzeyi hiç açılmaz. [path] API'ye göreli yol (bkz. ApiClient.fileUrl).
class AuthImage extends StatelessWidget {
  final String path;
  final double? width;
  final double? height;
  final BoxFit fit;

  const AuthImage({
    super.key,
    required this.path,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
  });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String?>(
      future: SecureStorage.readToken(),
      builder: (context, snap) {
        if (!snap.hasData) {
          return SizedBox(
            width: width,
            height: height,
            child: const Center(
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        }
        return Image.network(
          ApiClient.instance.absoluteUrl(path),
          width: width,
          height: height,
          fit: fit,
          headers: {'Authorization': 'Bearer ${snap.data}'},
          errorBuilder: (_, _, _) => Container(
            width: width,
            height: height,
            padding: const EdgeInsets.all(12),
            color: AppColors.surfaceMuted,
            child: const Icon(Icons.broken_image_outlined),
          ),
        );
      },
    );
  }
}
