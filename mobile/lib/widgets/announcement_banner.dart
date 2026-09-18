import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api_client.dart';
import '../theme/app_colors.dart';

/// Bölüm AK (8. tur): GET /announcements/active yanıtı.
class Announcement {
  final String id;
  final String message;
  final String createdAt;
  final String? expiresAt;

  const Announcement({
    required this.id,
    required this.message,
    required this.createdAt,
    this.expiresAt,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) => Announcement(
        id: json['id'] as String,
        message: json['message'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
        expiresAt: json['expiresAt'] as String?,
      );

  /// Ana Sayfa şeridi bu duyuruyu gösterir mi? Kapatılan ID eşleşirse gizli;
  /// yeni duyuru (farklı ID) yeniden görünür.
  bool isVisible(String? dismissedId) => dismissedId != id;
}

const _dismissKey = 'dismissedAnnouncementId';

/// Sistem geneli duyuru şeridi — Ana Sayfa'nın en üstünde, tüm roller.
/// Kapatma yalnızca duyurunun ID'sini SharedPreferences'a yazar.
class AnnouncementBanner extends StatefulWidget {
  const AnnouncementBanner({super.key});

  @override
  State<AnnouncementBanner> createState() => _AnnouncementBannerState();
}

class _AnnouncementBannerState extends State<AnnouncementBanner> {
  Announcement? _announcement;
  String? _dismissedId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final dismissed = prefs.getString(_dismissKey);
      final json = await ApiClient.instance.get<Map<String, dynamic>>('/announcements/active');
      final data = json['data'] as Map<String, dynamic>?;
      if (!mounted) return;
      setState(() {
        _dismissedId = dismissed;
        _announcement = data == null ? null : Announcement.fromJson(data);
      });
    } catch (_) {
      if (mounted) setState(() => _announcement = null);
    }
  }

  Future<void> _dismiss() async {
    final id = _announcement?.id;
    if (id == null) return;
    setState(() => _dismissedId = id);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_dismissKey, id);
    } catch (_) {
      // Kalıcı yazılamazsa yalnızca bu oturum için kapanır.
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = _announcement;
    if (a == null || !a.isVisible(_dismissedId)) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primary600,
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Row(
        children: [
          const Icon(Icons.campaign_rounded, size: 18, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              a.message,
              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600, height: 1.3),
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            tooltip: 'Duyuruyu kapat',
            icon: const Icon(Icons.close_rounded, size: 16, color: Colors.white),
            onPressed: _dismiss,
          ),
        ],
      ),
    );
  }
}
