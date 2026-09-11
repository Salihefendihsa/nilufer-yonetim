import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/observer_access_grant.dart';
import '../../theme/app_colors.dart';
import 'observer_access_api.dart';

/// web/src/app/(dashboard)/mesajlar/ObserverAccessModal.tsx ile aynı akış —
/// Gözlemci Modu'na girmeden önce gerekçe + süre (veya acil durum) sorar.
/// Kullanıcı vazgeçerse veya form başarısız kapanırsa null döner.
Future<ObserverAccessGrant?> showObserverAccessSheet(
  BuildContext context,
) {
  return showModalBottomSheet<ObserverAccessGrant>(
    context: context,
    isScrollControlled: true,
    builder: (_) => const _ObserverAccessSheet(),
  );
}

class _ObserverAccessSheet extends StatefulWidget {
  const _ObserverAccessSheet();

  @override
  State<_ObserverAccessSheet> createState() => _ObserverAccessSheetState();
}

class _ObserverAccessSheetState extends State<_ObserverAccessSheet> {
  final _api = ObserverAccessApi();
  final _reasonController = TextEditingController();
  String _duration = '1d';
  bool _isEmergency = false;
  bool _submitting = false;
  String? _error;

  static const _durationLabels = {'1h': '1 saat', '1d': '1 gün', '1w': '1 hafta'};

  Future<void> _submit() async {
    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      setState(() => _error = 'Gerekçe zorunludur');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final grant = await _api.requestAccess(
        reason: reason,
        isEmergency: _isEmergency,
        duration: _isEmergency ? null : _duration,
      );
      if (mounted) Navigator.of(context).pop(grant);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Erişim talebi oluşturulamadı',
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Gözlemci Erişimi Talep Et',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 4),
            const Text(
              'Tüm konuşmaları görüntülemek için bir gerekçe ve süre belirtmelisiniz. '
              'Her erişim ve kullanım denetim kaydına işlenir.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Text(_error!, style: const TextStyle(color: AppColors.danger500, fontSize: 12.5)),
              const SizedBox(height: 8),
            ],
            TextField(
              controller: _reasonController,
              decoration: const InputDecoration(labelText: 'Gerekçe'),
              minLines: 2,
              maxLines: 4,
              autofocus: true,
            ),
            const SizedBox(height: 16),
            if (!_isEmergency) ...[
              const Text('Süre', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _durationLabels.entries
                    .map(
                      (entry) => ChoiceChip(
                        label: Text(entry.value),
                        selected: _duration == entry.key,
                        onSelected: (_) => setState(() => _duration = entry.key),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 12),
            ],
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _isEmergency,
              onChanged: (v) => setState(() => _isEmergency = v),
              title: const Text(
                'Acil Durum Erişimi (sınırsız)',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              subtitle: const Text(
                'Süre sınırı olmadan erişim verir; ayrı ve belirgin şekilde işaretlenmiş bir denetim kaydı oluşturulur.',
                style: TextStyle(fontSize: 11.5),
              ),
              activeThumbColor: AppColors.warning500,
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? 'Gönderiliyor...' : 'Erişimi Talep Et'),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
