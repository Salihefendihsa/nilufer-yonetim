import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../widgets/announcement_banner.dart';
import 'impersonation_banner.dart';

/// Kabuk seviyesi üst şeritler: impersonation uyarısı + sistem duyurusu.
///
/// `MaterialApp.builder` içinde Navigator'ı sarar; böylece hem alt sekme
/// ekranları hem de üzerine push edilen tüm rotalar (arama, detay, form…)
/// şeridi görür — web'deki `(dashboard)/layout.tsx` ile aynı davranış
/// (tasarım denetimi §3.4 / öncelik #3).
///
/// Bir şerit görünürken alt ağaca `MediaQuery.removePadding(removeTop)`
/// uygulanır: şerit status-bar boşluğunu kendi SafeArea'sıyla zaten
/// tükettiği için ekranların AppBar'ı ikinci kez üst boşluk eklemez
/// (önceki _AuthGate düzeninde impersonation şeridi bu boşluğu çift
/// ekliyordu).
class ShellTopBars extends StatefulWidget {
  final Widget child;
  const ShellTopBars({super.key, required this.child});

  @override
  State<ShellTopBars> createState() => _ShellTopBarsState();
}

class _ShellTopBarsState extends State<ShellTopBars> {
  Announcement? _announcement;
  String? _dismissedId;
  AuthStatus? _lastStatus;

  Future<void> _load() async {
    final r = await loadActiveAnnouncement();
    if (!mounted) return;
    setState(() {
      _announcement = r.announcement;
      _dismissedId = r.dismissedId;
    });
  }

  void _dismiss() {
    final id = _announcement?.id;
    if (id == null) return;
    setState(() => _dismissedId = id);
    persistAnnouncementDismiss(id);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final authed = auth.status == AuthStatus.authenticated &&
        !auth.mustChangePassword;

    // Oturum her açıldığında (giriş / impersonation değişimi) duyuru
    // yeniden çekilir; çıkışta şerit temizlenir.
    if (auth.status != _lastStatus) {
      _lastStatus = auth.status;
      if (authed) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _load());
      } else if (_announcement != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) setState(() => _announcement = null);
        });
      }
    }

    final a = _announcement;
    final showAnnouncement = authed && a != null && a.isVisible(_dismissedId);
    final showImpersonation = authed && auth.impersonationMeta != null;

    if (!showAnnouncement && !showImpersonation) return widget.child;

    return Column(
      children: [
        // İkisi birden görünüyorsa yalnızca ilk şerit status-bar boşluğunu
        // alır; ikincisi düz devam eder.
        if (showImpersonation) const ImpersonationBanner(),
        if (showAnnouncement)
          MediaQuery.removePadding(
            context: context,
            removeTop: showImpersonation,
            child: AnnouncementStrip(announcement: a, onDismiss: _dismiss),
          ),
        Expanded(
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: widget.child,
          ),
        ),
      ],
    );
  }
}
