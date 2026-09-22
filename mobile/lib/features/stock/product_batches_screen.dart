import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/product.dart';
import '../../models/product_batch.dart';
import '../../navigation/sub_page_scaffold.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/staggered_fade_in.dart';
import '../../widgets/state_views.dart';
import 'stock_api.dart';

final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');

Color batchToneColor(AppPalette cs, BatchTone tone) {
  switch (tone) {
    case BatchTone.red:
      return cs.danger600;
    case BatchTone.yellow:
      return cs.warning600;
    case BatchTone.green:
      return cs.success600;
  }
}

Color batchToneBackground(AppPalette cs, BatchTone tone) {
  switch (tone) {
    case BatchTone.red:
      return cs.danger50;
    case BatchTone.yellow:
      return cs.warning50;
    case BatchTone.green:
      return cs.success50;
  }
}

/// Bölüm AM (9. tur): bir ürünün partileri — GET /products/:id/batches
/// (yalnızca OWNER/MANAGER; stock_list_screen o roller için açar).
class ProductBatchesScreen extends StatefulWidget {
  final Product product;
  const ProductBatchesScreen({super.key, required this.product});

  @override
  State<ProductBatchesScreen> createState() => _ProductBatchesScreenState();
}

class _ProductBatchesScreenState extends State<ProductBatchesScreen> {
  final _api = StockApi();
  List<ProductBatch> _batches = [];
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
      final res = await _api.batches(widget.product.id);
      setState(() => _batches = res);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Partiler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    return SubPageScaffold(
      title: '${widget.product.name} — Partiler',
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _batches.isEmpty
          ? const EmptyStateView(
              title: 'Parti kaydı yok',
              subtitle: 'Stok girişinde parti no + SKT girerek takibe başlayabilirsiniz.',
              icon: Icons.sell_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: cs.accentSoft,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _batches.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) => StaggeredFadeIn(
                  index: i,
                  child: BatchTile(
                    batch: _batches[i],
                    unit: widget.product.unit,
                  ),
                ),
              ),
            ),
    );
  }
}

/// Parti satırı — SKT'ye göre renk kodlu rozet; tükenen parti soluk.
class BatchTile extends StatelessWidget {
  final ProductBatch batch;
  final String? unit;
  final bool showProductName;
  const BatchTile({
    super.key,
    required this.batch,
    this.unit,
    this.showProductName = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final depleted = batch.isDepleted;
    final tone = batch.tone;
    final u = unit ?? batch.productUnit ?? '';
    return Opacity(
      opacity: depleted ? 0.6 : 1,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: cs.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: cs.borderDefault),
        ),
        child: Row(
          children: [
            Container(
              width: 6,
              height: 40,
              decoration: BoxDecoration(
                color: depleted ? cs.neutral300 : batchToneColor(cs, tone),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    showProductName && batch.productName != null
                        ? '${batch.productName} · ${batch.batchNumber}'
                        : batch.batchNumber,
                    style: tx.body.copyWith(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    'SKT ${_dateFormat.format(DateTime.parse(batch.expiryDate))}'
                    ' · ${batch.quantityRemaining.toStringAsFixed(1)} / ${batch.quantityReceived.toStringAsFixed(1)} $u'
                    '${batch.supplierName != null ? ' · ${batch.supplierName}' : ''}',
                    style: tx.caption,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: depleted
                    ? cs.surfaceSubtle
                    : batchToneBackground(cs, tone),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                depleted ? 'Tükendi' : batch.expiryLabel,
                style: tx.label.copyWith(
                  color: depleted ? cs.textSecondary : batchToneColor(cs, tone),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bölüm AM: "Süresi Yaklaşan Partiler" — GET /products/expiring-batches?days=.
/// Süresi dolmuş partiler ayrı işaretlenir ama listede kalır (imha/iade).
class ExpiringBatchesScreen extends StatefulWidget {
  const ExpiringBatchesScreen({super.key});

  @override
  State<ExpiringBatchesScreen> createState() => _ExpiringBatchesScreenState();
}

class _ExpiringBatchesScreenState extends State<ExpiringBatchesScreen> {
  final _api = StockApi();
  int _days = 30;
  List<ProductBatch> _batches = [];
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
      final res = await _api.expiringBatches(days: _days);
      setState(() => _batches = res);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Partiler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final expired = _batches.where((b) => b.isExpired).length;
    return SubPageScaffold(
      title: 'Süresi Yaklaşan Partiler',
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                for (final w in const [7, 30, 90]) ...[
                  ChoiceChip(
                    label: Text('$w gün'),
                    selected: _days == w,
                    onSelected: (_) {
                      setState(() => _days = w);
                      _load();
                    },
                  ),
                  const SizedBox(width: 8),
                ],
                const Spacer(),
                if (!_loading && expired > 0)
                  Text(
                    '$expired süresi dolmuş',
                    style: tx.caption.copyWith(
                      fontWeight: FontWeight.w700,
                      color: cs.danger600,
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorRetryView(message: _error!, onRetry: _load)
                : _batches.isEmpty
                ? EmptyStateView(
                    title: 'Yaklaşan parti yok',
                    subtitle:
                        'Önümüzdeki $_days gün içinde süresi dolacak parti bulunmuyor.',
                    icon: Icons.event_available_outlined,
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    color: cs.accentSoft,
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _batches.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) => StaggeredFadeIn(
                        index: i,
                        child: BatchTile(
                          batch: _batches[i],
                          showProductName: true,
                        ),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
