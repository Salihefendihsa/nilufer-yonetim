import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../models/attendance.dart';
import '../theme/app_colors.dart';
import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';
import 'state_views.dart';

final _timeFormat = DateFormat('HH:mm', 'tr_TR');

/// Bölüm AR (9. tur): STAFF/TEAM_LEAD Ana Sayfa — "Giriş Yap"/"Çıkış Yap" +
/// bugünkü durum (web ClockCard ile aynı). Gün başına tek kayıt; 409'da
/// bugünkü kayıt yeniden çekilir.
class ClockCard extends StatefulWidget {
  const ClockCard({super.key});

  @override
  State<ClockCard> createState() => _ClockCardState();
}

class _ClockCardState extends State<ClockCard> {
  final _api = ApiClient.instance;
  AttendanceRecord? _record;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await _api.get<Map<String, dynamic>>(
        '/staff/me/attendance/today',
      );
      if (!mounted) return;
      final r = json['record'] as Map<String, dynamic>?;
      setState(() {
        _record = r == null ? null : AttendanceRecord.fromJson(r);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Puantaj yüklenemedi';
        _loading = false;
      });
    }
  }

  Future<void> _act(String kind) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final json = await _api.post<Map<String, dynamic>>(
        '/staff/me/$kind',
        body: const {},
      );
      if (!mounted) return;
      setState(() => _record = AttendanceRecord.fromJson(json));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            kind == 'clock-in'
                ? 'Giriş kaydedildi. İyi çalışmalar!'
                : 'Çıkış kaydedildi.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      if (e is ApiException && e.status == 409) await _load();
      setState(
        () => _error = e is ApiException ? e.message : 'İşlem tamamlanamadı',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _t(String? iso) =>
      iso == null ? '—' : _timeFormat.format(DateTime.parse(iso).toLocal());

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final r = _record;
    final clockedIn = r?.clockInAt != null;
    final clockedOut = r?.clockOutAt != null;
    final working = clockedIn && !clockedOut;

    final String status;
    if (!clockedIn) {
      status = 'Bugün henüz giriş yapmadınız.';
    } else if (clockedOut) {
      status =
          'Giriş ${_t(r!.clockInAt)} · Çıkış ${_t(r.clockOutAt)} · ${r.workedHours ?? 0} saat';
    } else {
      status = 'Giriş ${_t(r!.clockInAt)} — mesai devam ediyor';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: working ? cs.success500 : cs.borderDefault),
      ),
      child: _loading
          ? const InlineLoading()
          : Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: (working ? cs.success500 : cs.primary600).withValues(
                      alpha: 0.12,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.timer_outlined,
                    size: 20,
                    color: working ? cs.success600 : cs.primary700,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Puantaj',
                        style: tx.subtitle.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(status, style: tx.caption),
                      if (_error != null)
                        Text(
                          _error!,
                          style: tx.caption.copyWith(color: cs.danger600),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (!clockedIn)
                  ElevatedButton.icon(
                    onPressed: _busy ? null : () => _act('clock-in'),
                    icon: const Icon(Icons.login_rounded, size: 16),
                    label: const Text('Giriş Yap'),
                  )
                else if (working)
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _act('clock-out'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: cs.danger600,
                    ),
                    icon: const Icon(Icons.logout_rounded, size: 16),
                    label: const Text('Çıkış Yap'),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: cs.success50,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Tamamlandı',
                      style: tx.label.copyWith(color: cs.success600),
                    ),
                  ),
              ],
            ),
    );
  }
}
