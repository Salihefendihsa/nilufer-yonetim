import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/quote.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';
import 'quotes_api.dart';

final _historyDateFormat = DateFormat('d MMM yyyy, HH:mm', 'tr_TR');

/// Teklif ayrıntısı: üstte talebin tüm alanları (özet kartı), altında
/// denetim geçmişi (GET /quotes/:id/history). Teklif listesindeki kartın
/// kendisine ve "Tarihçe" butonuna basınca açılır.
///
/// Bu uç, sorguyu `targetType="QuoteRequest" AND targetId=:id` ile sabitler;
/// müdüre denetim loglarının tamamı AÇILMAZ (`/audit-logs` OWNER'a kısıtlı
/// kalır, bkz. backend/src/routes/auditLogs.ts).
class QuoteHistoryScreen extends StatefulWidget {
  final QuoteRequest quote;
  const QuoteHistoryScreen({super.key, required this.quote});

  @override
  State<QuoteHistoryScreen> createState() => _QuoteHistoryScreenState();
}

class _QuoteHistoryScreenState extends State<QuoteHistoryScreen> {
  final _api = QuotesApi();
  List<QuoteHistoryEntry> _entries = [];
  bool _loading = true;
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
      final data = await _api.history(widget.quote.id);
      if (!mounted) return;
      setState(() {
        _entries = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Tarihçe yüklenemedi';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(title: Text(widget.quote.fullName)),
      body: RefreshIndicator(
        onRefresh: _load,
        color: cs.accentSoft,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _QuoteSummaryCard(quote: widget.quote),
            const SizedBox(height: 20),
            Text(
              'Tarihçe',
              style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: LoadingView(),
              )
            else if (_error != null)
              ErrorRetryView(message: _error!, onRetry: _load)
            else if (_entries.isEmpty)
              const EmptyStateView(
                title: 'Kayıtlı değişiklik yok',
                icon: Icons.history_rounded,
              )
            else
              for (final e in _entries)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
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
                        Text(
                          quoteHistoryActionLabelTr(e.action),
                          style: tx.body.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${e.actorName} · '
                          '${_historyDateFormat.format(DateTime.parse(e.createdAt))}',
                          style: tx.caption,
                        ),
                        if (e.detail != null && e.detail!.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            e.detail!,
                            style: tx.label.copyWith(fontFamily: 'monospace'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _QuoteSummaryCard extends StatelessWidget {
  final QuoteRequest quote;
  const _QuoteSummaryCard({required this.quote});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final q = quote;
    final currency = NumberFormat.currency(
      locale: 'tr_TR',
      symbol: '₺',
      decimalDigits: 0,
    );
    final rows = <(IconData, String, String)>[
      (Icons.flag_outlined, 'Durum', quoteStatusLabelTr(q.status)),
      (Icons.pest_control_outlined, 'Hizmet', q.serviceType),
      (Icons.home_work_outlined, 'Mülk tipi', q.propertyType),
      (Icons.phone_outlined, 'Telefon', q.phone),
      if (q.email != null && q.email!.isNotEmpty)
        (Icons.mail_outline_rounded, 'E-posta', q.email!),
      if ((q.address ?? q.district) != null)
        (
          Icons.place_outlined,
          'Adres',
          [q.address, q.district].whereType<String>().join(' · '),
        ),
      if (q.amount != null)
        (Icons.payments_outlined, 'Tutar', currency.format(q.amount)),
      (
        Icons.schedule_rounded,
        'Talep tarihi',
        _historyDateFormat.format(DateTime.parse(q.createdAt)),
      ),
      if (q.surveyAt != null)
        (
          Icons.event_outlined,
          'Keşif',
          _historyDateFormat.format(q.surveyAt!.toLocal()),
        ),
      if (q.note != null && q.note!.isNotEmpty)
        (Icons.sticky_note_2_outlined, 'Not', q.note!),
    ];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final (icon, label, value) in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, size: 16, color: cs.textFaint),
                  const SizedBox(width: 8),
                  SizedBox(width: 92, child: Text(label, style: tx.caption)),
                  Expanded(
                    child: Text(
                      value,
                      style: tx.bodySmall.copyWith(fontWeight: FontWeight.w600),
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
