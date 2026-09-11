import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/product.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'stock_api.dart';

final _dateTimeFormat = DateFormat('d MMM yyyy, HH:mm', 'tr_TR');

/// backend/src/routes/products.ts: GET /:id/movements yalnızca OWNER/MANAGER
/// — bu ekran stock_list_screen.dart'tan yalnızca o roller için açılır.
class StockMovementsScreen extends StatefulWidget {
  final Product product;
  const StockMovementsScreen({super.key, required this.product});

  @override
  State<StockMovementsScreen> createState() => _StockMovementsScreenState();
}

class _StockMovementsScreenState extends State<StockMovementsScreen> {
  final _api = StockApi();
  List<StockMovement> _movements = [];
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
      final res = await _api.movements(widget.product.id);
      setState(() => _movements = res.data);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Hareketler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${widget.product.name} — Hareketler')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _movements.isEmpty
          ? const EmptyStateView(
              title: 'Hareket kaydı yok',
              icon: Icons.receipt_long_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _movements.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final m = _movements[i];
                  final isIn = m.type == 'IN';
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceCard,
                      borderRadius: BorderRadius.circular(AppRadius.card),
                      border: Border.all(color: AppColors.borderDefault),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color:
                                (isIn
                                        ? AppColors.success500
                                        : AppColors.danger500)
                                    .withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isIn
                                ? Icons.arrow_downward_rounded
                                : Icons.arrow_upward_rounded,
                            size: 16,
                            color: isIn
                                ? AppColors.success600
                                : AppColors.danger600,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${isIn ? '+' : '-'}${m.quantity.toStringAsFixed(1)} ${widget.product.unit}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13.5,
                                  color: isIn
                                      ? AppColors.success600
                                      : AppColors.danger600,
                                ),
                              ),
                              if (m.note != null)
                                Text(
                                  m.note!,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              Text(
                                _dateTimeFormat.format(
                                  DateTime.parse(m.createdAt),
                                ),
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textFaint,
                                ),
                              ),
                            ],
                          ),
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
