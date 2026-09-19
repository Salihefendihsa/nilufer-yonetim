import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/product.dart';
import '../../models/product_batch.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'stock_api.dart';

final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');

Color batchToneColor(BatchTone tone) {
  switch (tone) {
    case BatchTone.red:
      return AppColors.danger600;
    case BatchTone.yellow:
      return AppColors.warning600;
    case BatchTone.green:
      return AppColors.success600;
  }
}

Color batchToneBackground(BatchTone tone) {
  switch (tone) {
    case BatchTone.red:
      return AppColors.danger50;
    case BatchTone.yellow:
      return AppColors.warning50;
    case BatchTone.green:
      return AppColors.success50;
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
    return Scaffold(
      appBar: AppBar(title: Text('${widget.product.name} — Partiler')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _batches.isEmpty
          ? const EmptyStateView(
              title: 'Parti kaydı yok',
              subtitle:
                  'Stok girişinde parti no + SKT girerek takibe başlayabilirsiniz.',
              icon: Icons.sell_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _batches.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) => BatchTile(
                  batch: _batches[i],
                  unit: widget.product.unit,
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
    final depleted = batch.isDepleted;
    final tone = batch.tone;
    final u = unit ?? batch.productUnit ?? '';
    return Opacity(
      opacity: depleted ? 0.6 : 1,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: AppColors.borderDefault),
        ),
        child: Row(
          children: [
            Container(
              width: 6,
              height: 40,
              decoration: BoxDecoration(
                color: depleted ? AppColors.neutral300 : batchToneColor(tone),
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
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13.5,
                    ),
                  ),
                  Text(
                    'SKT ${_dateFormat.format(DateTime.parse(batch.expiryDate))}'
                    ' · ${batch.quantityRemaining.toStringAsFixed(1)} / ${batch.quantityReceived.toStringAsFixed(1)} $u'
                    '${batch.supplierName != null ? ' · ${batch.supplierName}' : ''}',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: depleted
                    ? AppColors.surfaceSubtle
                    : batchToneBackground(tone),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                depleted ? 'Tükendi' : batch.expiryLabel,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: depleted
                      ? AppColors.textSecondary
                      : batchToneColor(tone),
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
    final expired = _batches.where((b) => b.isExpired).length;
    return Scaffold(
      appBar: AppBar(title: const Text('Süresi Yaklaşan Partiler')),
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
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.danger600,
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
                    color: AppColors.primary600,
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _batches.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) => BatchTile(
                        batch: _batches[i],
                        showProductName: true,
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
