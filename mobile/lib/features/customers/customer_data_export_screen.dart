import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';

/// Bölüm AJ (8. tur): CUSTOMER → Diğer → "Verilerimi İndir".
/// GET /customers/me/data-export JSON'u `downloadAndShare` deseniyle
/// (Authorization header, paylaşım sayfası) indirilir — token'sız URL yok.
class CustomerDataExportScreen extends StatefulWidget {
  const CustomerDataExportScreen({super.key});

  @override
  State<CustomerDataExportScreen> createState() =>
      _CustomerDataExportScreenState();
}

class _CustomerDataExportScreenState extends State<CustomerDataExportScreen> {
  bool _busy = false;

  Future<void> _download() async {
    setState(() => _busy = true);
    try {
      final stamp = DateTime.now().toIso8601String().substring(0, 10);
      await downloadAndShare(
        '/customers/me/data-export',
        'verilerim-$stamp.json',
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Veriler indirilemedi')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(title: const Text('Verilerimi İndir')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
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
                    Icon(Icons.download_outlined, color: cs.accent),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Verilerinizin bir kopyası',
                        style: tx.subtitle.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Sistemde size ait kayıtların (profil, işler, sözleşmeler, ödemeler, '
                  'randevu talepleri ve belge listesi) bir kopyasını JSON dosyası olarak '
                  'indirip paylaşım sayfasından kaydedebilirsiniz.',
                  style: tx.bodySmall,
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _busy ? null : _download,
                    icon: _busy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download_outlined, size: 18),
                    label: Text(
                      _busy ? 'Hazırlanıyor...' : 'Verilerimi İndir (JSON)',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
