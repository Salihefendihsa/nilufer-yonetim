import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/quote.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'quotes_api.dart';

final _historyDateFormat = DateFormat('d MMM yyyy, HH:mm', 'tr_TR');

/// Tek bir teklifin denetim geçmişi (GET /quotes/:id/history).
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
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: Text('${widget.quote.fullName} — Tarihçe')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _entries.isEmpty
          ? const EmptyStateView(
              title: 'Kayıtlı değişiklik yok',
              icon: Icons.history_rounded,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _entries.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final e = _entries[i];
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
                        Text(
                          quoteHistoryActionLabelTr(e.action),
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${e.actorName} · '
                          '${_historyDateFormat.format(DateTime.parse(e.createdAt))}',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        if (e.detail != null && e.detail!.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            e.detail!,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textFaint,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
    );
  }
}
