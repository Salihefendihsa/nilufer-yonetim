import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import 'advances_api.dart';

/// Stitch Personel → Ana Sayfa: "Avans Talep Et" modalı. backend zaten
/// STAFF'ın kendi adına avans talebi açmasına izin veriyor
/// (POST /advances, requireRole(STAFF)) — bu ekran o uca gerçek bir istemci
/// arayüzü ekler (önceden mobilde hiç yoktu).
Future<void> showAdvanceRequestSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _AdvanceRequestSheet(),
  );
}

class _AdvanceRequestSheet extends StatefulWidget {
  const _AdvanceRequestSheet();

  @override
  State<_AdvanceRequestSheet> createState() => _AdvanceRequestSheetState();
}

class _AdvanceRequestSheetState extends State<_AdvanceRequestSheet> {
  final _api = AdvancesApi();
  final _amountController = TextEditingController();
  final _reasonController = TextEditingController();
  bool _saving = false;
  String? _error;
  bool _sent = false;

  @override
  void dispose() {
    _amountController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountController.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Geçerli bir tutar girin');
      return;
    }
    if (_reasonController.text.trim().isEmpty) {
      setState(() => _error = 'Açıklama / sebep zorunludur');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _api.create(amount: amount, reason: _reasonController.text.trim());
      if (!mounted) return;
      setState(() => _sent = true);
      await Future.delayed(const Duration(milliseconds: 900));
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Talep gönderilemedi',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
        decoration: BoxDecoration(
          color: cs.surfaceCard,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: cs.primary50,
                    borderRadius: BorderRadius.circular(AppRadius.chip),
                  ),
                  child: Icon(
                    Icons.payments_rounded,
                    size: 18,
                    color: cs.accentSoft,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  'Avans Talebi',
                  style: tx.title.copyWith(fontWeight: FontWeight.w800),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Talep Edilen Tutar (₺)',
              style: tx.caption.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(hintText: 'Örn: 1500'),
            ),
            const SizedBox(height: 14),
            Text(
              'Açıklama / Sebep',
              style: tx.caption.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Saha yakıtı, malzeme alımı veya acil harcama...',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: tx.bodySmall.copyWith(color: cs.danger500)),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving
                        ? null
                        : () => Navigator.of(context).pop(),
                    child: const Text('Vazgeç'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _saving ? null : _submit,
                    child: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(_sent ? 'Gönderildi!' : 'Gönder'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
