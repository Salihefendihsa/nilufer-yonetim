import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';

/// Bölüm AP (9. tur): STAFF/TEAM_LEAD → Ayarlar → "Takvimimi Dışa Aktar".
/// GET /staff/me/calendar-token abonelik linkini verir (token'lı
/// /calendar/<token>.ics — takvim uygulaması header gönderemediği için token
/// kimliktir); "Token'ı Yenile" eski linki geçersiz kılar. .ics indirme
/// Authorization header'lı `downloadAndShare` ile (token'sız URL yok).
class CalendarExportCard extends StatefulWidget {
  const CalendarExportCard({super.key});

  @override
  State<CalendarExportCard> createState() => _CalendarExportCardState();
}

class _CalendarExportCardState extends State<CalendarExportCard> {
  final _api = ApiClient.instance;
  String? _url;
  String? _webcalUrl;
  int _windowDays = 30;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await _api.get<Map<String, dynamic>>(
        '/staff/me/calendar-token',
      );
      setState(() {
        _url = json['url'] as String?;
        _webcalUrl = json['webcalUrl'] as String?;
        _windowDays = (json['windowDays'] as num?)?.toInt() ?? 30;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Takvim linki alınamadı',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _copy() async {
    final url = _url;
    if (url == null) return;
    await Clipboard.setData(ClipboardData(text: url));
    _snack('Link kopyalandı.');
  }

  Future<void> _share() async {
    final url = _url;
    if (url == null) return;
    await Share.share(url, subject: 'İş programım (takvim aboneliği)');
  }

  Future<void> _openWebcal() async {
    final url = _webcalUrl;
    if (url == null) return;
    final ok = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!ok) {
      _snack('Takvim uygulaması açılamadı — linki kopyalayıp elle ekleyin.');
    }
  }

  Future<void> _openGoogle() async {
    final url = _webcalUrl;
    if (url == null) return;
    final google = Uri.parse(
      'https://calendar.google.com/calendar/r?cid=${Uri.encodeComponent(url)}',
    );
    final ok = await launchUrl(google, mode: LaunchMode.externalApplication);
    if (!ok) _snack('Google Takvim açılamadı.');
  }

  Future<void> _download() async {
    setState(() => _busy = true);
    try {
      await downloadAndShare('/staff/me/calendar.ics', 'is-programim.ics');
    } catch (e) {
      _snack(e is ApiException ? e.message : 'İndirilemedi');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rotate() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Takvim linkini yenile'),
        content: const Text(
          'Eski abonelik linki anında çalışmayı durdurur; takvim uygulamanızda yeni linkle tekrar abone olmanız gerekir.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Yenile', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      final json = await _api.post<Map<String, dynamic>>(
        '/staff/me/calendar-token/rotate',
      );
      setState(() {
        _url = json['url'] as String?;
        _webcalUrl = json['webcalUrl'] as String?;
      });
      _snack('Yeni link üretildi; eski link artık çalışmaz.');
    } catch (e) {
      _snack(e is ApiException ? e.message : 'Yenilenemedi');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.event_repeat_outlined, size: 18, color: cs.accent),
              SizedBox(width: 8),
              Text(
                'Takvimimi Dışa Aktar',
                style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Önümüzdeki $_windowDays gündeki atanmış işlerinizi telefonunuzun takvimine aktarın. Abonelik linki otomatik güncellenir.',
            style: tx.bodySmall,
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(8),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else if (_error != null)
            Row(
              children: [
                Expanded(
                  child: Text(
                    _error!,
                    style: tx.bodySmall.copyWith(color: cs.danger600),
                  ),
                ),
                TextButton(onPressed: _load, child: const Text('Tekrar dene')),
              ],
            )
          else ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: cs.surfaceSubtle,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _url ?? '',
                      style: tx.label.copyWith(fontFamily: 'monospace'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    onPressed: _copy,
                    icon: const Icon(Icons.copy_rounded, size: 18),
                    tooltip: 'Kopyala',
                    visualDensity: VisualDensity.compact,
                  ),
                  IconButton(
                    onPressed: _share,
                    icon: const Icon(Icons.share_outlined, size: 18),
                    tooltip: 'Paylaş',
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ElevatedButton.icon(
                  onPressed: _busy ? null : _openGoogle,
                  icon: const Icon(Icons.event_available_outlined, size: 16),
                  label: const Text("Google Takvim'e Ekle"),
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _openWebcal,
                  icon: const Icon(Icons.calendar_month_outlined, size: 16),
                  label: const Text('Takvim uygulamasında aç'),
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _download,
                  icon: const Icon(Icons.download_outlined, size: 16),
                  label: const Text('.ics İndir'),
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _rotate,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: cs.danger600,
                  ),
                  icon: const Icon(Icons.refresh_rounded, size: 16),
                  label: const Text("Token'ı Yenile"),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Bu linki bilen herkes iş programınızı görebilir. Yanlışlıkla paylaştıysanız "Token\'ı Yenile" ile eski linki geçersiz kılın.',
              style: tx.label,
            ),
          ],
        ],
      ),
    );
  }
}
