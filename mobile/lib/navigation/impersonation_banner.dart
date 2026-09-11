import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../core/api_client.dart';
import '../theme/app_colors.dart';

/// web/src/components/ImpersonationBanner.tsx ile aynı işlev — OWNER birini
/// impersonate ederken TÜM ekranlarda belirgin şekilde görünür.
class ImpersonationBanner extends StatefulWidget {
  const ImpersonationBanner({super.key});

  @override
  State<ImpersonationBanner> createState() => _ImpersonationBannerState();
}

class _ImpersonationBannerState extends State<ImpersonationBanner> {
  bool _ending = false;

  Future<void> _exit(AuthProvider auth) async {
    setState(() => _ending = true);
    try {
      await ApiClient.instance.post('/admin/impersonate/end');
    } catch (_) {
      // Oturum zaten sona ermiş olabilir — yine de OWNER'ın kendi oturumuna dönülür.
    } finally {
      await auth.endImpersonation();
      if (mounted) setState(() => _ending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final meta = auth.impersonationMeta;
    if (meta == null) return const SizedBox.shrink();

    final targetName = meta['targetFullName'] as String? ?? '';
    final reason = meta['reason'] as String? ?? '';

    return Container(
      width: double.infinity,
      color: AppColors.warning500,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            const Icon(Icons.shield_outlined, color: Colors.white, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '$targetName olarak görüntüleniyorsunuz — $reason',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            TextButton(
              onPressed: _ending ? null : () => _exit(auth),
              style: TextButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: 0.2),
                foregroundColor: Colors.white,
                minimumSize: const Size(0, 28),
                padding: const EdgeInsets.symmetric(horizontal: 10),
              ),
              child: Text(_ending ? 'Çıkılıyor...' : 'Çık', style: const TextStyle(fontSize: 11.5)),
            ),
          ],
        ),
      ),
    );
  }
}
