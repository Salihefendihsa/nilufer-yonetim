import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api_client.dart';
import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';

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

  /// Şerit bu duyuruyu gösterir mi? Kapatılan ID eşleşirse gizli;
  /// yeni duyuru (farklı ID) yeniden görünür.
  bool isVisible(String? dismissedId) => dismissedId != id;
}

const _dismissKey = 'dismissedAnnouncementId';

/// Aktif duyuruyu ve daha önce kapatılmış duyuru ID'sini birlikte döndürür.
/// Ağ/yetki hatasında `announcement` null'dır (şerit gizli kalır).
Future<({Announcement? announcement, String? dismissedId})>
loadActiveAnnouncement() async {
  String? dismissed;
  try {
    dismissed = (await SharedPreferences.getInstance()).getString(_dismissKey);
  } catch (_) {
    dismissed = null;
  }
  try {
    final json = await ApiClient.instance.get<Map<String, dynamic>>(
      '/announcements/active',
    );
    final data = json['data'] as Map<String, dynamic>?;
    return (
      announcement: data == null ? null : Announcement.fromJson(data),
      dismissedId: dismissed,
    );
  } catch (_) {
    return (announcement: null, dismissedId: dismissed);
  }
}

/// Kapatmayı kalıcı yazar; yazılamazsa yalnızca bu oturum için kapanır.
Future<void> persistAnnouncementDismiss(String id) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_dismissKey, id);
  } catch (_) {}
}

/// Sistem geneli duyuru şeridi — salt görsel bileşen. Tasarım denetimi §3.4:
/// önceden yalnızca Ana Sayfa gövdesinin içindeydi (başka sekmedeyken
/// görünmezdi); artık kabuk seviyesinde, tüm ekranların üstünde çizilir
/// (bkz. navigation/shell_top_bars.dart). Web'deki AnnouncementBanner ile
/// aynı davranış (layout seviyesi).
class AnnouncementStrip extends StatelessWidget {
  final Announcement announcement;
  final VoidCallback onDismiss;

  const AnnouncementStrip({
    super.key,
    required this.announcement,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Material(
      color: cs.primary600,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
          child: Row(
            children: [
              const Icon(Icons.campaign_rounded, size: 18, color: Colors.white),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  announcement.message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: tx.bodySmall.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                tooltip: 'Duyuruyu kapat',
                icon: const Icon(
                  Icons.close_rounded,
                  size: 16,
                  color: Colors.white,
                ),
                onPressed: onDismiss,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
