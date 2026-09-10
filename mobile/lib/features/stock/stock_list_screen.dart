import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/product.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'purchase_requests_screen.dart';
import 'stock_api.dart';
import 'stock_movements_screen.dart';

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
    final quantityController = TextEditingController();
    final noteController = TextEditingController();
    final result = await showModalBottomSheet<double>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
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
              '${p.name} — Satın Alma Talebi',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 4),
            const Text(
              'Talep oluşturulduğunda stok hemen artmaz; mal kabulünde işlenir.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
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
            const SizedBox(height: 12),
            TextField(
              controller: noteController,
              decoration: const InputDecoration(labelText: 'Not (opsiyonel)'),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.of(
                ctx,
              ).pop(double.tryParse(quantityController.text.trim())),
              child: const Text('Talep Oluştur'),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (result == null || result <= 0) return;
    try {
      await _api.createPurchaseRequest(
        p.id,
        result,
        note: noteController.text.trim(),
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
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Sistemdeki miktar: '
                  '${p.currentStock.toStringAsFixed(1)} ${p.unit}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
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
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: diff == 0
                          ? AppColors.textSecondary
                          : diff > 0
                          ? AppColors.success600
                          : AppColors.danger600,
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
            content: Text(e is ApiException ? e.message : 'Sayım kaydedilemedi'),
          ),
        );
      }
    }
  }

  Future<void> _showRestockSheet(Product p) async {
    final controller = TextEditingController();
    final result = await showModalBottomSheet<double>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
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
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(labelText: 'Miktar (${p.unit})'),
              autofocus: true,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                final v = double.tryParse(controller.text.trim());
                Navigator.of(ctx).pop(v);
              },
              child: const Text('Ekle'),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (result == null || result <= 0) return;
    try {
      await _api.restock(p.id, result);
      _load();
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
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Silinemedi'),
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
        title: const Text('Stok'),
        actions: [
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
                if (created == true) _load();
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
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_products.isEmpty)
      return const EmptyStateView(
        title: 'Ürün bulunamadı',
        icon: Icons.inventory_2_outlined,
      );

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary600,
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
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: p.isCritical
                    ? AppColors.danger500
                    : AppColors.borderDefault,
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
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
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
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textFaint,
                              ),
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
                        color: AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        productCategoryLabelTr(p.category),
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (_canManage)
                      PopupMenuButton<String>(
                        icon: const Icon(
                          Icons.more_vert_rounded,
                          size: 18,
                          color: AppColors.textFaint,
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
                            if (updated == true) _load();
                          } else if (v == 'delete') {
                            _deleteProduct(p);
                          }
                        },
                        itemBuilder: (context) => const [
                          PopupMenuItem(
                            value: 'edit',
                            child: Text('Düzenle'),
                          ),
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
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: ratio,
                    minHeight: 6,
                    backgroundColor: AppColors.surfaceMuted,
                    color: p.isCritical
                        ? AppColors.danger500
                        : AppColors.success500,
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
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: p.lastMovement!.type == 'IN'
                                  ? AppColors.success600
                                  : AppColors.danger600,
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
                              color: AppColors.info50,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              'Sipariş bekleyen: '
                              '${p.pendingPurchaseQuantity.toStringAsFixed(1)} ${p.unit}',
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.info600,
                              ),
                            ),
                          ),
                        ],
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
                        color: p.isCritical
                            ? AppColors.danger600
                            : AppColors.textSecondary,
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
                            label: const Text(
                              'Hareketler',
                              style: TextStyle(fontSize: 12),
                            ),
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
                            label: const Text(
                              'Sayım',
                              style: TextStyle(fontSize: 12),
                            ),
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
                            label: const Text(
                              'Talep',
                              style: TextStyle(fontSize: 12),
                            ),
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
                            label: const Text(
                              'Giriş',
                              style: TextStyle(fontSize: 12),
                            ),
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
                  (v == null || v.trim().isEmpty) ? 'Zorunlu' : null,
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
                  (v == null || v.trim().isEmpty) ? 'Zorunlu' : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
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
