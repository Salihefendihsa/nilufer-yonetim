import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/product.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';
import 'purchase_requests_screen.dart';
import 'stock_api.dart';
import 'stock_movements_screen.dart';
import 'product_batches_screen.dart';
import 'suppliers_screen.dart';

/// backend/src/routes/products.ts: GET herkese (rol dahilinde) açık, yazma
/// yalnızca OWNER/MANAGER — bu ekran STAFF/TEAM_LEAD için salt okunur.
class StockListScreen extends StatefulWidget {
  const StockListScreen({super.key});

  @override
  State<StockListScreen> createState() => _StockListScreenState();
}

class _StockListScreenState extends State<StockListScreen> {
  final _api = StockApi();
  List<Product> _products = [];
  bool _loading = true;
  String? _error;
  ProductCategory? _filter;

  bool get _canManage {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner || role == AppRole.manager;
  }

  /// Ekip lideri stoğu SALT OKUNUR görür ama takviye talebi açabilir
  /// (backend: POST /products/:id/purchase-requests TEAM_LEAD'e açık;
  /// listeleme / mal kabul / iptal OWNER-MANAGER'da kalır).
  bool get _canRequestPurchase {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner ||
        role == AppRole.manager ||
        role == AppRole.teamLead;
  }

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
      final res = await _api.list(category: _filter);
      setState(() => _products = res.data);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Ürünler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  /// Satin alma (ikmal) talebi olusturur - stok bu asamada artmaz.
  Future<void> _showPurchaseSheet(Product p) async {
    final tx = context.text;
    final quantityController = TextEditingController();
    final noteController = TextEditingController();
    final trackingController = TextEditingController();
    String? supplierId;
    final suppliers = await _api.listSuppliers().catchError(
      (_) => <Supplier>[],
    );
    final activeSuppliers = suppliers.where((s) => s.isActive).toList();

    if (!mounted) return;
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 20,
          right: 20,
          top: 20,
        ),
        child: StatefulBuilder(
          builder: (ctx, setSheetState) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${p.name} — Satın Alma Talebi',
                style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'Talep oluşturulduğunda stok hemen artmaz; mal kabulünde işlenir.',
                style: tx.caption,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: quantityController,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(labelText: 'Miktar (${p.unit})'),
                autofocus: true,
              ),
              if (activeSuppliers.isNotEmpty) ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: supplierId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Tedarikçi (opsiyonel)',
                  ),
                  items: [
                    const DropdownMenuItem<String>(
                      value: null,
                      child: Text('Seçilmedi'),
                    ),
                    ...activeSuppliers.map(
                      (s) => DropdownMenuItem(
                        value: s.id,
                        child: Text(s.name, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                  ],
                  onChanged: (v) => setSheetState(() => supplierId = v),
                ),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: trackingController,
                decoration: const InputDecoration(
                  labelText: 'Sipariş/Kargo Takip No (opsiyonel)',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                decoration: const InputDecoration(labelText: 'Not (opsiyonel)'),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  final qty = double.tryParse(quantityController.text.trim());
                  if (qty == null || qty <= 0) return;
                  Navigator.of(ctx).pop({
                    'quantity': qty,
                    'supplierId': supplierId,
                    'note': noteController.text.trim(),
                    'orderTrackingNumber': trackingController.text.trim(),
                  });
                },
                child: const Text('Talep Oluştur'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
    if (result == null) return;
    try {
      await _api.createPurchaseRequest(
        p.id,
        result['quantity'] as double,
        note: result['note'] as String?,
        supplierId: result['supplierId'] as String?,
        orderTrackingNumber: result['orderTrackingNumber'] as String?,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Satın alma talebi oluşturuldu')),
        );
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Talep oluşturulamadı',
            ),
          ),
        );
      }
    }
  }

  /// Fiili sayim mutabakati: kullanici sayilan gercek miktari girer, backend
  /// farki otomatik bir stok hareketine cevirip stogu sayilan degere esitler.
  Future<void> _showCountSheet(Product p) async {
    final cs = context.colors;
    final tx = context.text;
    final controller = TextEditingController();
    final counted = await showModalBottomSheet<double>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 20,
          right: 20,
          top: 20,
        ),
        child: StatefulBuilder(
          builder: (ctx, setSheetState) {
            final parsed = double.tryParse(controller.text.trim());
            final diff = parsed == null ? null : parsed - p.currentStock;
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${p.name} — Fiili Sayım',
                  style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  'Sistemdeki miktar: '
                  '${p.currentStock.toStringAsFixed(1)} ${p.unit}',
                  style: tx.caption,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText: 'Sayılan Miktar (${p.unit})',
                  ),
                  autofocus: true,
                  onChanged: (_) => setSheetState(() {}),
                ),
                if (diff != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    diff == 0
                        ? 'Fark yok — kayıt oluşturulmayacak.'
                        : 'Fark: ${diff > 0 ? '+' : ''}'
                              '${diff.toStringAsFixed(1)} ${p.unit} — '
                              '${diff > 0 ? 'giriş' : 'çıkış'} hareketi oluşturulacak.',
                    style: tx.caption.copyWith(
                      fontWeight: FontWeight.w600,
                      color: diff == 0
                          ? cs.textSecondary
                          : diff > 0
                          ? cs.success600
                          : cs.danger600,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(parsed),
                  child: const Text('Sayımı Kaydet'),
                ),
                const SizedBox(height: 12),
              ],
            );
          },
        ),
      ),
    );
    if (counted == null || counted < 0) return;
    try {
      final result = await _api.adjustCount(p.id, counted);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result.adjusted
                  ? 'Sayım kaydedildi (fark: '
                        '${result.difference > 0 ? '+' : ''}'
                        '${result.difference.toStringAsFixed(1)} ${p.unit})'
                  : 'Sayım sistemi doğruladı — fark yok, hareket oluşturulmadı.',
            ),
          ),
        );
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Sayım kaydedilemedi',
            ),
          ),
        );
      }
    }
  }

  Future<void> _showRestockSheet(Product p) async {
    final cs = context.colors;
    final tx = context.text;
    final controller = TextEditingController();
    // Bölüm AM (9. tur): opsiyonel parti no + SKT (ikisi birlikte).
    final batchController = TextEditingController();
    DateTime? expiry;
    final result =
        await showModalBottomSheet<
          ({double qty, String? batch, String? expiry})
        >(
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
                    '${p.name} — Stok Ekle',
                    style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: InputDecoration(
                      labelText: 'Miktar (${p.unit})',
                    ),
                    autofocus: true,
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
                        initialDate:
                            expiry ??
                            DateTime.now().add(const Duration(days: 365)),
                        firstDate: DateTime.now().subtract(
                          const Duration(days: 3650),
                        ),
                        lastDate: DateTime.now().add(
                          const Duration(days: 3650),
                        ),
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
                  const SizedBox(height: 4),
                  Text(
                    'Kimyasallarda parti + SKT yasal takip için önerilir; çıkışlar en önce süresi dolacak partiden düşülür.',
                    style: tx.label.copyWith(color: cs.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      final v = double.tryParse(controller.text.trim());
                      if (v == null) {
                        Navigator.of(ctx).pop();
                        return;
                      }
                      final e = expiry;
                      Navigator.of(ctx).pop((
                        qty: v,
                        batch: batchController.text.trim(),
                        expiry: e == null
                            ? null
                            : '${e.year}-${e.month.toString().padLeft(2, '0')}-${e.day.toString().padLeft(2, '0')}',
                      ));
                    },
                    child: const Text('Ekle'),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        );
    if (result == null || result.qty <= 0) return;
    final hasBatch = (result.batch ?? '').isNotEmpty;
    final hasExpiry = (result.expiry ?? '').isNotEmpty;
    if (hasBatch != hasExpiry) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Parti numarası ve son kullanma tarihi birlikte girilmeli',
            ),
          ),
        );
      }
      return;
    }
    try {
      await _api.restock(
        p.id,
        result.qty,
        batchNumber: result.batch,
        expiryDate: result.expiry,
      );
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Stok eklendi.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Stok eklenemedi'),
          ),
        );
      }
    }
  }

  Future<void> _deleteProduct(Product p) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ürünü sil'),
        content: Text('${p.name} silinecek. Bu işlem geri alınamaz.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Sil', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.delete(p.id);
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Ürün silindi.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Silinemedi')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Stok'),
        actions: [
          if (_canManage)
            IconButton(
              icon: const Icon(Icons.local_shipping_outlined),
              tooltip: 'Tedarikçiler',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SuppliersScreen()),
                );
              },
            ),
          if (_canManage)
            IconButton(
              icon: const Icon(Icons.event_busy_outlined),
              tooltip: 'Süresi Yaklaşan Partiler',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const ExpiringBatchesScreen(),
                  ),
                );
              },
            ),
          if (_canManage)
            IconButton(
              icon: const Icon(Icons.shopping_cart_outlined),
              tooltip: 'Satın Alma Talepleri',
              onPressed: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const PurchaseRequestsScreen(),
                  ),
                );
                _load();
              },
            ),
          if (_canManage)
            IconButton(
              icon: const Icon(Icons.add_rounded),
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const _ProductFormScreen()),
                );
                if (created == true) {
                  _load();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Ürün kaydedildi.')),
                    );
                  }
                }
              },
            ),
        ],
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
                  label: 'Tüm Kalemler',
                  selected: _filter == null,
                  onTap: () => setState(() {
                    _filter = null;
                    _load();
                  }),
                ),
                for (final c in ProductCategory.values)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: _Chip(
                      label: productCategoryLabelTr(c),
                      selected: _filter == c,
                      onTap: () => setState(() {
                        _filter = c;
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
    final cs = context.colors;
    final tx = context.text;
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_products.isEmpty)
      return const EmptyStateView(
        title: 'Ürün bulunamadı',
        icon: Icons.inventory_2_outlined,
      );

    return RefreshIndicator(
      onRefresh: _load,
      color: cs.accentSoft,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _products.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final p = _products[i];
          final ratio = p.criticalThreshold == 0
              ? 1.0
              : (p.currentStock / (p.criticalThreshold * 2)).clamp(0.0, 1.0);
          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: cs.surfaceCard,
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(
                color: p.isCritical ? cs.danger500 : cs.borderDefault,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.name,
                            style: tx.subtitle.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (p.code != null || p.description != null)
                            Text(
                              [
                                if (p.code != null) p.code!,
                                if (p.description != null) p.description!,
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: tx.label,
                            ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: cs.surfaceSubtle,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Text(
                        productCategoryLabelTr(p.category),
                        style: tx.label.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (_canManage)
                      PopupMenuButton<String>(
                        icon: Icon(
                          Icons.more_vert_rounded,
                          size: 18,
                          color: cs.textFaint,
                        ),
                        padding: EdgeInsets.zero,
                        onSelected: (v) async {
                          if (v == 'edit') {
                            final updated = await Navigator.of(context)
                                .push<bool>(
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        _ProductFormScreen(product: p),
                                  ),
                                );
                            if (updated == true) {
                              _load();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Ürün kaydedildi.'),
                                  ),
                                );
                              }
                            }
                          } else if (v == 'delete') {
                            _deleteProduct(p);
                          }
                        },
                        itemBuilder: (context) => const [
                          PopupMenuItem(value: 'edit', child: Text('Düzenle')),
                          PopupMenuItem(
                            value: 'delete',
                            child: Text(
                              'Sil',
                              style: TextStyle(color: Colors.red),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  child: LinearProgressIndicator(
                    value: ratio,
                    minHeight: 6,
                    backgroundColor: cs.surfaceMuted,
                    color: p.isCritical ? cs.danger500 : cs.success500,
                  ),
                ),
                const SizedBox(height: 6),
                if (p.lastMovement != null || p.pendingPurchaseQuantity > 0)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        if (p.lastMovement != null)
                          Text(
                            'Son hareket: '
                            '${p.lastMovement!.type == 'IN' ? '+' : '-'}'
                            '${p.lastMovement!.quantity.toStringAsFixed(1)} ${p.unit}',
                            style: tx.label.copyWith(
                              fontWeight: FontWeight.w600,
                              color: p.lastMovement!.type == 'IN'
                                  ? cs.success600
                                  : cs.danger600,
                            ),
                          ),
                        if (p.pendingPurchaseQuantity > 0) ...[
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: cs.info50,
                              borderRadius: BorderRadius.circular(
                                AppRadius.pill,
                              ),
                            ),
                            child: Text(
                              'Sipariş bekleyen: '
                              '${p.pendingPurchaseQuantity.toStringAsFixed(1)} ${p.unit}',
                              style: tx.label.copyWith(color: cs.info600),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                // Bölüm W (5. tur): kullanım bazlı tahmin — veri yoksa gösterilmez.
                if (p.forecastLabel != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Icon(
                          Icons.timer_outlined,
                          size: 13,
                          color: (p.forecastDaysRemaining ?? 99) <= 7
                              ? cs.danger500
                              : (p.forecastDaysRemaining ?? 99) <= 30
                              ? cs.warning600
                              : cs.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          p.forecastLabel!,
                          style: tx.caption.copyWith(
                            fontWeight: FontWeight.w600,
                            color: (p.forecastDaysRemaining ?? 99) <= 7
                                ? cs.danger500
                                : (p.forecastDaysRemaining ?? 99) <= 30
                                ? cs.warning600
                                : cs.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Mevcut: ${p.currentStock.toStringAsFixed(1)} ${p.unit} · Min: ${p.criticalThreshold.toStringAsFixed(1)} ${p.unit}',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: p.isCritical ? cs.danger600 : cs.textSecondary,
                        fontWeight: p.isCritical
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_canManage) ...[
                          TextButton.icon(
                            onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) =>
                                    StockMovementsScreen(product: p),
                              ),
                            ),
                            icon: const Icon(Icons.history_rounded, size: 15),
                            label: Text('Hareketler', style: tx.caption),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(0, 0),
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                          const SizedBox(width: 12),
                          TextButton.icon(
                            onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) =>
                                    ProductBatchesScreen(product: p),
                              ),
                            ),
                            icon: const Icon(Icons.sell_outlined, size: 15),
                            label: Text('Partiler', style: tx.caption),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(0, 0),
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                          const SizedBox(width: 12),
                          TextButton.icon(
                            onPressed: () => _showCountSheet(p),
                            icon: const Icon(
                              Icons.fact_check_outlined,
                              size: 15,
                            ),
                            label: Text('Sayım', style: tx.caption),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(0, 0),
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        if (_canRequestPurchase)
                          TextButton.icon(
                            onPressed: () => _showPurchaseSheet(p),
                            icon: const Icon(
                              Icons.shopping_cart_outlined,
                              size: 15,
                            ),
                            label: Text('Talep', style: tx.caption),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(0, 0),
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                        if (_canManage) ...[
                          const SizedBox(width: 12),
                          TextButton.icon(
                            onPressed: () => _showRestockSheet(p),
                            icon: const Icon(Icons.add_box_outlined, size: 15),
                            label: Text('Giriş', style: tx.caption),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(0, 0),
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
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
    final cs = context.colors;
    final tx = context.text;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? cs.primary600 : cs.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(
            color: selected ? cs.primary600 : cs.borderDefault,
          ),
        ),
        child: Text(
          label,
          style: tx.bodySmall.copyWith(
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : cs.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _ProductFormScreen extends StatefulWidget {
  final Product? product;
  const _ProductFormScreen({this.product});

  @override
  State<_ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends State<_ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _codeController = TextEditingController(
    text: widget.product?.code ?? '',
  );
  late final _nameController = TextEditingController(
    text: widget.product?.name ?? '',
  );
  late final _descriptionController = TextEditingController(
    text: widget.product?.description ?? '',
  );
  late final _unitController = TextEditingController(
    text: widget.product?.unit ?? 'litre',
  );
  final _stockController = TextEditingController(text: '0');
  late final _thresholdController = TextEditingController(
    text: widget.product != null
        ? widget.product!.criticalThreshold.toString()
        : '',
  );
  late ProductCategory _category =
      widget.product?.category ?? ProductCategory.biocidal;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.product != null;

  final _api = StockApi();

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (_isEdit) {
        await _api.update(
          widget.product!.id,
          code: _codeController.text.trim(),
          description: _descriptionController.text.trim(),
          name: _nameController.text.trim(),
          unit: _unitController.text.trim(),
          category: _category,
          criticalThreshold:
              double.tryParse(_thresholdController.text.trim()) ?? 0,
        );
      } else {
        await _api.create(
          code: _codeController.text.trim(),
          description: _descriptionController.text.trim(),
          name: _nameController.text.trim(),
          unit: _unitController.text.trim(),
          category: _category,
          currentStock: double.tryParse(_stockController.text.trim()) ?? 0,
          criticalThreshold:
              double.tryParse(_thresholdController.text.trim()) ?? 0,
        );
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Kaydedilemedi');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Ürünü Düzenle' : 'Yeni Ürün')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _codeController,
              decoration: const InputDecoration(
                labelText: 'Ürün Kodu (opsiyonel)',
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Ürün Adı'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Zorunlu alan' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Açıklama (opsiyonel)',
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _unitController,
              decoration: const InputDecoration(
                labelText: 'Birim (litre/kg/adet)',
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<ProductCategory>(
              initialValue: _category,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Kategori'),
              items: ProductCategory.values
                  .map(
                    (c) => DropdownMenuItem(
                      value: c,
                      child: Text(productCategoryLabelTr(c)),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _category = v ?? _category),
            ),
            if (!_isEdit) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _stockController,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(labelText: 'Başlangıç Stoğu'),
              ),
            ],
            const SizedBox(height: 12),
            TextFormField(
              controller: _thresholdController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'Kritik Seviye'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Zorunlu alan' : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: tx.bodySmall.copyWith(color: Colors.red)),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _saving ? null : _submit,
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        color: Colors.white,
                      ),
                    )
                  : Text(_isEdit ? 'Kaydet' : 'Oluştur'),
            ),
          ],
        ),
      ),
    );
  }
}
