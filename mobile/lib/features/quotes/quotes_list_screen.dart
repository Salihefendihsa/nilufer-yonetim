import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../models/quote.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'quote_history_screen.dart';
import 'quotes_api.dart';

final _currency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);
final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');

const Map<String, Color> _statusColors = {
  'NEW': AppColors.warning500,
  'CONTACTED': AppColors.info500,
  'REVISION': AppColors.danger500,
  'CONVERTED': AppColors.success500,
  'REJECTED': AppColors.danger600,
};

/// backend/src/routes/quotes.ts: GET/PATCH/convert yalnızca OWNER/MANAGER —
/// bu ekran zaten yalnızca o rollerin nav'ında (Daha Fazla menüsü).
class QuotesListScreen extends StatefulWidget {
  const QuotesListScreen({super.key});

  @override
  State<QuotesListScreen> createState() => _QuotesListScreenState();
}

class _QuotesListScreenState extends State<QuotesListScreen> {
  final _api = QuotesApi();
  List<QuoteRequest> _quotes = [];
  QuotesSummary? _summary;
  bool _loading = true;
  String? _error;
  String? _filter;
  String? _busyId;

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
      final res = await _api.list(status: _filter);
      // Özet tüm taleplerden hesaplanır; filtre uygulansa bile değişmez.
      // Özet alınamazsa liste yine gösterilir (başlıktaki dönüşüm oranı düşer).
      QuotesSummary? summary;
      try {
        summary = await _api.summary();
      } on ApiException {
        summary = _summary;
      }
      if (!mounted) return;
      setState(() {
        _quotes = res.data;
        _summary = summary;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Teklifler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _convert(QuoteRequest q) async {
    setState(() => _busyId = q.id);
    try {
      await _api.convert(q.id);
      _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Müşteriye dönüştürüldü')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Dönüştürülemedi'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _editAmount(QuoteRequest q) async {
    final controller = TextEditingController(
      text: q.amount?.toStringAsFixed(0) ?? '',
    );
    final result = await showDialog<double?>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Fiyat Belirle'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Tutar (₺)'),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () =>
                Navigator.of(ctx).pop(double.tryParse(controller.text.trim())),
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
    if (result == null) return;
    try {
      await _api.updateAmount(q.id, result);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Fiyat kaydedilemedi',
            ),
          ),
        );
      }
    }
  }

  /// Yonetim notunu duzenler (PATCH /quotes/:id { note }).
  Future<void> _editNote(QuoteRequest q) async {
    final controller = TextEditingController(text: q.note ?? '');
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Yönetim Notu'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Not'),
          maxLines: 3,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
    if (saved != true) return;
    try {
      await _api.updateDetails(q.id, note: controller.text.trim());
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Not kaydedilemedi'),
          ),
        );
      }
    }
  }

  /// Kesif randevusunu belirler (PATCH /quotes/:id { surveyAt }).
  Future<void> _editSurvey(QuoteRequest q) async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: q.surveyAt ?? now,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(q.surveyAt ?? now),
    );
    if (time == null) return;
    final surveyAt = DateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );
    try {
      await _api.updateDetails(q.id, surveyAt: surveyAt);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Kaydedilemedi'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(
        title: Text(
          _summary?.conversionRate == null
              ? 'Teklifler'
              : 'Teklifler · Dönüşüm '
                    '%${_summary!.conversionRate!.toStringAsFixed(0)}',
        ),
      ),
      body: Column(
        children: [
          SizedBox(
            height: 46,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              children: [
                _Chip(
                  label: 'Tümü',
                  selected: _filter == null,
                  onTap: () => setState(() {
                    _filter = null;
                    _load();
                  }),
                ),
                for (final s in quoteStatusOptions)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: _Chip(
                      label: quoteStatusLabelTr(s),
                      selected: _filter == s,
                      onTap: () => setState(() {
                        _filter = s;
                        _load();
                      }),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_quotes.isEmpty)
      return const EmptyStateView(
        title: 'Teklif talebi yok',
        icon: Icons.request_quote_outlined,
      );

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary600,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _quotes.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final q = _quotes[i];
          final color = _statusColors[q.status] ?? AppColors.textFaint;
          final busy = _busyId == q.id;
          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.borderDefault),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        q.fullName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        quoteStatusLabelTr(q.status),
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${q.serviceType} · ${q.propertyType}',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(
                      Icons.phone_outlined,
                      size: 13,
                      color: AppColors.textFaint,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      q.phone,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.textFaint,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(
                        Icons.call_rounded,
                        size: 18,
                        color: AppColors.primary600,
                      ),
                      onPressed: () => launchUrl(Uri.parse('tel:${q.phone}')),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
                Text(
                  _dateFormat.format(DateTime.parse(q.createdAt)),
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textFaint,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: busy ? null : () => _editSurvey(q),
                        icon: const Icon(Icons.event_outlined, size: 15),
                        label: Text(
                          q.surveyAt != null
                              ? 'Keşif: ${_dateFormat.format(q.surveyAt!)}'
                              : 'Keşif Randevusu',
                          style: const TextStyle(fontSize: 11.5),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => QuoteHistoryScreen(quote: q),
                          ),
                        ),
                        icon: const Icon(Icons.history_rounded, size: 15),
                        label: const Text(
                          'Tarihçe',
                          style: TextStyle(fontSize: 11.5),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: busy ? null : () => _editNote(q),
                        icon: const Icon(Icons.sticky_note_2_outlined, size: 15),
                        label: Text(
                          q.note != null && q.note!.isNotEmpty ? 'Notu Aç' : 'Not Ekle',
                          style: const TextStyle(fontSize: 11.5),
                        ),
                      ),
                    ),
                  ],
                ),
                if (q.note != null && q.note!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      q.note!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.textSecondary,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: () => _editAmount(q),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.sell_outlined,
                          size: 15,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          q.amount != null
                              ? _currency.format(q.amount)
                              : 'Fiyat belirlenmedi',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: q.amount != null
                                ? AppColors.textPrimary
                                : AppColors.textFaint,
                          ),
                        ),
                        const Spacer(),
                        const Icon(
                          Icons.edit_outlined,
                          size: 14,
                          color: AppColors.textFaint,
                        ),
                      ],
                    ),
                  ),
                ),
                if (q.status != 'CONVERTED') ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: busy ? null : () => _convert(q),
                      icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                      label: Text(busy ? 'İşleniyor...' : 'Müşteriye Dönüştür'),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary600 : AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.primary600 : AppColors.borderDefault,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
