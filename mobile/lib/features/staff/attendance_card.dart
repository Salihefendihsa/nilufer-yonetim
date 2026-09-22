import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/attendance.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';

final _dayFormat = DateFormat('d MMM', 'tr_TR');
final _timeFormat = DateFormat('HH:mm', 'tr_TR');
final _monthFormat = DateFormat('MMMM yyyy', 'tr_TR');

/// Bölüm AR (9. tur): personel detayında aylık puantaj özeti
/// (GET /staff/:id/attendance?month=). OWNER/MANAGER herkes; STAFF/TEAM_LEAD
/// kendi kaydı — yetki yoksa (403) kart gizlenir.
class AttendanceCard extends StatefulWidget {
  final String staffId;
  const AttendanceCard({super.key, required this.staffId});

  @override
  State<AttendanceCard> createState() => _AttendanceCardState();
}

class _AttendanceCardState extends State<AttendanceCard> {
  final _api = ApiClient.instance;
  DateTime _cursor = DateTime(DateTime.now().year, DateTime.now().month);
  AttendanceMonth? _month;
  bool _loading = true;
  bool _hidden = false;
  bool _expanded = false;

  bool get _isCurrent {
    final now = DateTime.now();
    return _cursor.year == now.year && _cursor.month == now.month;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final key = '${_cursor.year}-${_cursor.month.toString().padLeft(2, '0')}';
      final json = await _api.get<Map<String, dynamic>>(
        '/staff/${widget.staffId}/attendance',
        query: {'month': key},
      );
      if (!mounted) return;
      setState(() {
        _month = AttendanceMonth.fromJson(json);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _hidden = e is ApiException && e.status == 403;
        _loading = false;
      });
    }
  }

  void _shift(int delta) {
    setState(() => _cursor = DateTime(_cursor.year, _cursor.month + delta));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    if (_hidden) return const SizedBox.shrink();
    final m = _month;
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Container(
        padding: const EdgeInsets.all(14),
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
                Icon(Icons.timer_outlined, size: 18, color: cs.accent),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Puantaj',
                    style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  onPressed: () => _shift(-1),
                  icon: const Icon(Icons.chevron_left_rounded, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
                Text(
                  _monthFormat.format(_cursor),
                  style: tx.caption.copyWith(fontWeight: FontWeight.w600),
                ),
                IconButton(
                  onPressed: _isCurrent ? null : () => _shift(1),
                  icon: const Icon(Icons.chevron_right_rounded, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loading || m == null)
              const InlineLoading()
            else ...[
              Row(
                children: [
                  _Stat('Toplam saat', m.totalHours.toStringAsFixed(1)),
                  _Stat('Tam gün', '${m.completedDays}'),
                  _Stat('Çıkışsız', '${m.openCount}', warn: m.openCount > 0),
                ],
              ),
              if (m.records.isNotEmpty) ...[
                const SizedBox(height: 6),
                TextButton(
                  onPressed: () => setState(() => _expanded = !_expanded),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 32),
                  ),
                  child: Text(
                    _expanded
                        ? 'Günleri gizle'
                        : '${m.records.length} günü göster',
                  ),
                ),
                if (_expanded)
                  for (final r in m.records)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 56,
                            child: Text(
                              _dayFormat.format(DateTime.parse(r.date)),
                              style: tx.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              '${r.clockInAt == null ? '—' : _timeFormat.format(DateTime.parse(r.clockInAt!).toLocal())}'
                              ' → '
                              '${r.clockOutAt == null ? 'çıkış yok' : _timeFormat.format(DateTime.parse(r.clockOutAt!).toLocal())}',
                              style: tx.caption.copyWith(
                                color: r.isOpen
                                    ? cs.warning600
                                    : cs.textSecondary,
                              ),
                            ),
                          ),
                          Text(
                            r.workedHours == null
                                ? '—'
                                : '${r.workedHours!.toStringAsFixed(1)} s',
                            style: tx.bodySmall.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
              ] else
                Text('Bu ay puantaj kaydı yok.', style: tx.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final bool warn;
  const _Stat(this.label, this.value, {this.warn = false});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: cs.surfaceSubtle,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: tx.label.copyWith(color: cs.textSecondary)),
            Text(
              value,
              style: tx.subtitle.copyWith(
                fontWeight: FontWeight.w800,
                color: warn ? cs.warning600 : cs.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
