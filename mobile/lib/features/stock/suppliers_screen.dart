import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/product.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';
import 'stock_api.dart';

/// Tedarikçi kataloğu (Bölüm E) — yalnızca OWNER/MANAGER erişimi
/// (stock_list_screen.dart'taki AppBar butonu zaten _canManage ile korunuyor).
class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  final _api = StockApi();
  List<Supplier> _suppliers = [];
  bool _loading = true;
  String? _error;
  bool _busy = false;

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
      final data = await _api.listSuppliers();
      if (!mounted) return;
      setState(() {
        _suppliers = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Tedarikçiler yüklenemedi';
        _loading = false;
      });
    }
  }

  Future<void> _toggleActive(Supplier s) async {
    setState(() => _busy = true);
    try {
      if (s.isActive) {
        await _api.deleteSupplier(s.id);
      } else {
        await _api.updateSupplier(s.id, isActive: true);
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Güncellenemedi'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openForm({Supplier? existing}) async {
    final tx = context.text;
    final nameController = TextEditingController(text: existing?.name ?? '');
    final contactController = TextEditingController(
      text: existing?.contactPerson ?? '',
    );
    final phoneController = TextEditingController(text: existing?.phone ?? '');
    final emailController = TextEditingController(text: existing?.email ?? '');
    final addressController = TextEditingController(
      text: existing?.address ?? '',
    );

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                existing != null ? 'Tedarikçiyi Düzenle' : 'Yeni Tedarikçi',
                style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameController,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Firma adı *'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contactController,
                decoration: const InputDecoration(labelText: 'Yetkili kişi'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Telefon'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'E-posta'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: addressController,
                decoration: const InputDecoration(labelText: 'Adres'),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  if (nameController.text.trim().isEmpty) return;
                  try {
                    if (existing != null) {
                      await _api.updateSupplier(
                        existing.id,
                        name: nameController.text.trim(),
                        contactPerson: contactController.text.trim(),
                        phone: phoneController.text.trim(),
                        email: emailController.text.trim(),
                        address: addressController.text.trim(),
                      );
                    } else {
                      await _api.createSupplier(
                        name: nameController.text.trim(),
                        contactPerson: contactController.text.trim(),
                        phone: phoneController.text.trim(),
                        email: emailController.text.trim(),
                        address: addressController.text.trim(),
                      );
                    }
                    if (ctx.mounted) Navigator.of(ctx).pop(true);
                  } catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        SnackBar(
                          content: Text(
                            e is ApiException ? e.message : 'Kaydedilemedi',
                          ),
                        ),
                      );
                    }
                  }
                },
                child: const Text('Kaydet'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tedarikçiler'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: () => _openForm(),
          ),
        ],
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _suppliers.isEmpty
          ? const EmptyStateView(
              title: 'Henüz tedarikçi yok',
              icon: Icons.local_shipping_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: cs.accentSoft,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _suppliers.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final s = _suppliers[i];
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: cs.surfaceCard,
                      borderRadius: BorderRadius.circular(AppRadius.card),
                      border: Border.all(color: cs.borderDefault),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                s.name,
                                style: tx.subtitle.copyWith(
                                  fontWeight: FontWeight.w700,
                                  decoration: s.isActive
                                      ? null
                                      : TextDecoration.lineThrough,
                                  color: s.isActive
                                      ? cs.textPrimary
                                      : cs.textFaint,
                                ),
                              ),
                              Text(
                                [s.contactPerson, s.phone, s.email]
                                    .where((v) => v != null && v.isNotEmpty)
                                    .join(' · '),
                                style: tx.caption,
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          onPressed: () => _openForm(existing: s),
                        ),
                        IconButton(
                          icon: Icon(
                            s.isActive
                                ? Icons.close_rounded
                                : Icons.check_rounded,
                            size: 18,
                            color: s.isActive ? cs.danger500 : cs.primary600,
                          ),
                          onPressed: _busy ? null : () => _toggleActive(s),
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
