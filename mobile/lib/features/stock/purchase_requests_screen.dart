import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/product.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'stock_api.dart';

final _dateFormat = DateFormat('d MMM, HH:mm', 'tr_TR');

/// Bekleyen satın alma (ikmal) talepleri. "Mal Kabul" işlemi stoğu artırır ve
/// bir StockMovement(IN) kaydı oluşturur; backend bunu tek transaction içinde
/// ve iyimser kilitle yapar, böylece iki kez basıldığında stok iki kez artmaz
/// (backend/src/controllers/productsController.ts:updatePurchaseRequest).
class PurchaseRequestsScreen extends StatefulWidget {
  const PurchaseRequestsScreen({super.key});

  @override
  State<PurchaseRequestsScreen> createState() => _PurchaseRequestsScreenState();
}

class _PurchaseRequestsScreenState extends State<PurchaseRequestsScreen> {
  final _api = StockApi();
  List<StockPurchaseRequest> _requests = [];
  bool _loading = true;
  String? _error;
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
      final data = await _api.pendingPurchaseRequests();
      if (!mounted) return;
      setState(() {
        _requests = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Talepler yüklenemedi';
        _loading = false;
      });
    }
  }

  /// Bölüm AM (9. tur): mal kabulde opsiyonel parti no + SKT sorulur
  /// (ikisi birlikte). Kullanıcı vazgeçerse işlem yapılmaz.
  Future<void> _receiveWithBatch(StockPurchaseRequest r) async {
    final batchController = TextEditingController();
    DateTime? expiry;
    final result = await showModalBottomSheet<({String batch, String? expiry})>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Mal Kabul — ${r.productName ?? 'Ürün'}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 6),
              Text(
                '+${r.quantity.toStringAsFixed(1)} ${r.productUnit ?? ''} stoğa eklenecek. Kimyasallar için parti no ve SKT önerilir (opsiyonel).',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: batchController,
                decoration: const InputDecoration(
                  labelText: 'Parti No (opsiyonel)',
                  hintText: 'Örn. LOT-2409A',
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: expiry ?? DateTime.now().add(const Duration(days: 365)),
                    firstDate: DateTime.now().subtract(const Duration(days: 3650)),
                    lastDate: DateTime.now().add(const Duration(days: 3650)),
                  );
                  if (picked != null) setSheetState(() => expiry = picked);
                },
                icon: const Icon(Icons.event_outlined, size: 16),
                label: Text(
                  expiry == null
                      ? 'Son Kullanma Tarihi seç'
                      : 'SKT: ${expiry!.day.toString().padLeft(2, '0')}.${expiry!.month.toString().padLeft(2, '0')}.${expiry!.year}',
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.success600,
                ),
                onPressed: () {
                  final e = expiry;
                  Navigator.of(ctx).pop((
                    batch: batchController.text.trim(),
                    expiry: e == null
                        ? null
                        : '${e.year}-${e.month.toString().padLeft(2, '0')}-${e.day.toString().padLeft(2, '0')}',
                  ));
                },
                child: const Text('Mal Kabul Et'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
    if (result == null) return;
    if (result.batch.isNotEmpty != (result.expiry ?? '').isNotEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Parti numarası ve son kullanma tarihi birlikte girilmeli'),
          ),
        );
      }
      return;
    }
    await _resolve(
      r,
      'RECEIVED',
      batchNumber: result.batch,
      expiryDate: result.expiry,
    );
  }

  Future<void> _resolve(
    StockPurchaseRequest r,
    String status, {
    String? batchNumber,
    String? expiryDate,
  }) async {
    setState(() => _busyId = r.id);
    try {
      await _api.resolvePurchaseRequest(
        r.id,
        status,
        batchNumber: batchNumber,
        expiryDate: expiryDate,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              status == 'RECEIVED'
                  ? 'Mal kabul edildi, stok güncellendi'
                  : 'Talep iptal edildi',
            ),
          ),
        );
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'İşlem başarısız'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Satın Alma Talepleri'
          '${_requests.isNotEmpty ? ' (${_requests.length})' : ''}',
        ),
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _requests.isEmpty
          ? const EmptyStateView(
              title: 'Bekleyen talep yok',
              icon: Icons.shopping_cart_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _requests.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final r = _requests[i];
                  final busy = _busyId == r.id;
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceCard,
                      borderRadius: BorderRadius.circular(AppRadius.card),
                      border: Border.all(color: AppColors.borderDefault),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                r.productName ?? 'Ürün',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            Text(
                              '+${r.quantity.toStringAsFixed(1)} '
                              '${r.productUnit ?? ''}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: AppColors.info600,
                              ),
                            ),
                          ],
                        ),
                        // Bölüm AI (8. tur): otomatik öneri rozeti
                        if (r.isAutoGenerated)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.info50,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text(
                                'Otomatik Öneri',
                                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.info600),
                              ),
                            ),
                          ),
                        const SizedBox(height: 4),
                        Text(
                          [
                            r.requestedByName ?? '—',
                            _dateFormat.format(DateTime.parse(r.createdAt)),
                            if (r.supplierName != null) r.supplierName!,
                            if (r.orderTrackingNumber != null &&
                                r.orderTrackingNumber!.isNotEmpty)
                              'Takip: ${r.orderTrackingNumber}',
                            if (r.note != null && r.note!.isNotEmpty) r.note!,
                          ].join(' · '),
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: busy
                                    ? null
                                    : () => _resolve(r, 'CANCELLED'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.danger600,
                                ),
                                child: const Text('İptal'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: busy
                                    ? null
                                    : () => _receiveWithBatch(r),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.success600,
                                ),
                                child: Text(busy ? 'İşleniyor...' : 'Mal Kabul'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
    );
  }
}
