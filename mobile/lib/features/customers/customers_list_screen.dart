import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../models/customer.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/chip_bar.dart';
import '../../widgets/staggered_fade_in.dart';
import '../../widgets/state_views.dart';
import 'customer_tags.dart';
import 'customers_api.dart';
import 'customer_detail_screen.dart';
import 'customer_form_screen.dart';

/// backend/src/controllers/customersController.ts:listCustomers ile aynı
/// kapsam kuralları backend'de zaten uygulanıyor — STAFF yalnızca kendisine
/// atanmış işi olan müşterileri görür, bu ekran ek bir filtre uygulamaz.
final _customerCurrency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);

class CustomersListScreen extends StatefulWidget {
  /// Başlangıç sıralaması ('balance' → borçlu müşteriler üstte; panel
  /// "Bekleyen Bakiye" kartından gelindiğinde).
  final String? initialSort;

  const CustomersListScreen({super.key, this.initialSort});

  @override
  State<CustomersListScreen> createState() => _CustomersListScreenState();
}

class _CustomersListScreenState extends State<CustomersListScreen> {
  final _api = CustomersApi();
  final _searchController = TextEditingController();
  Timer? _debounce;

  List<Customer> _customers = [];
  bool _loading = true;
  bool _loadingMore = false;

  /// 'newest' | 'name' | 'balance' - backend'deki sort parametresi.
  String _sort = 'newest';
  String? _error;
  int _page = 1;
  int _totalPages = 1;
  String _search = '';
  // Bölüm X (6. tur): etiket filtresi ve çipler.
  final _tagsApi = CustomerTagsApi();
  List<CustomerTag> _tagOptions = [];
  String? _tagFilter;
  bool _exporting = false;

  bool get _canManage {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner || role == AppRole.manager;
  }

  Future<void> _exportExcel() async {
    setState(() => _exporting = true);
    try {
      await downloadAndShare('/customers/export/excel', 'musteriler.xlsx');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Excel dışa aktarılamadı',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _sort = widget.initialSort ?? _sort;
    _load();
    _tagsApi
        .list()
        .then((v) {
          if (mounted) setState(() => _tagOptions = v);
        })
        .catchError((_) {});
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool append = false}) async {
    setState(() {
      if (append) {
        _loadingMore = true;
      } else {
        _loading = true;
        _error = null;
      }
    });
    try {
      final page = append ? _page + 1 : 1;
      final res = await _api.list(
        page: page,
        search: _search,
        sort: _sort,
        tagId: _tagFilter,
      );
      setState(() {
        _customers = append ? [..._customers, ...res.data] : res.data;
        _page = res.pagination.page;
        _totalPages = res.pagination.totalPages;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Müşteriler yüklenemedi',
      );
    } finally {
      setState(() {
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      _search = value;
      _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Müşteriler'),
        actions: [
          if (_canManage)
            IconButton(
              icon: _exporting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.file_download_outlined),
              tooltip: 'Excel olarak dışa aktar',
              onPressed: _exporting ? null : _exportExcel,
            ),
          if (_canManage)
            IconButton(
              icon: const Icon(Icons.person_add_alt_1_rounded),
              tooltip: 'Yeni müşteri',
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const CustomerFormScreen()),
                );
                if (created == true) {
                  _load();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Müşteri kaydedildi.')),
                    );
                  }
                }
              },
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: const InputDecoration(
                hintText: 'İsim, telefon veya bölge ara...',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
          ),
          if (_tagOptions.isNotEmpty)
            ChipBar(
              spacing: 0,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              children: [
                for (final t in _tagOptions)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: CustomerTagChip(
                      tag: t,
                      dimmed: _tagFilter != null && _tagFilter != t.id,
                      onTap: () {
                        setState(
                          () => _tagFilter = _tagFilter == t.id ? null : t.id,
                        );
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ChipBar(
            spacing: 0,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            children: [
              for (final option in const [
                ('newest', 'En Yeni'),
                ('name', 'İsme Göre'),
                ('balance', 'Bakiyeye Göre'),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(option.$2, style: tx.caption),
                    selected: _sort == option.$1,
                    onSelected: (_) {
                      setState(() => _sort = option.$1);
                      _load();
                    },
                  ),
                ),
            ],
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    final cs = context.colors;
    if (_loading) return const LoadingView();
    if (_error != null)
      return ErrorRetryView(message: _error!, onRetry: () => _load());
    if (_customers.isEmpty) {
      return const EmptyStateView(
        title: 'Müşteri bulunamadı',
        icon: Icons.people_outline_rounded,
      );
    }

    return RefreshIndicator(
      onRefresh: () => _load(),
      color: cs.accentSoft,
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.pixels >= n.metrics.maxScrollExtent - 200 &&
              !_loadingMore &&
              _page < _totalPages) {
            _load(append: true);
          }
          return false;
        },
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          itemCount: _customers.length + (_loadingMore ? 1 : 0),
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            if (i >= _customers.length) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              );
            }
            final c = _customers[i];
            return StaggeredFadeIn(
              index: i,
              child: _CustomerCard(
                customer: c,
                onTap: () async {
                  final changed = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(
                      builder: (_) => CustomerDetailScreen(customerId: c.id),
                    ),
                  );
                  if (changed == true) _load();
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  final Customer customer;
  final VoidCallback onTap;

  const _CustomerCard({required this.customer, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final initials = customer.fullName.isNotEmpty
        ? customer.fullName
              .trim()
              .split(RegExp(r'\s+'))
              .map((w) => w[0])
              .take(2)
              .join()
              .toUpperCase()
        : '?';

    return Material(
      color: cs.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: cs.borderDefault),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: cs.primary100,
                child: Text(
                  initials,
                  style: tx.body.copyWith(
                    color: cs.primary700,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      customer.fullName,
                      style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                    ),
                    if (customer.tags.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: [
                            for (final t in customer.tags)
                              CustomerTagChip(tag: CustomerTag.fromJson(t)),
                          ],
                        ),
                      ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        customer.phone,
                        if (customer.district != null) customer.district!,
                      ].join(' · '),
                      style: tx.bodySmall,
                    ),
                  ],
                ),
              ),
              // Bakiye sunucu tarafinda hesaplanip liste yanitinda gelir;
              // STAFF rolune gonderilmedigi icin null olabilir.
              if (customer.outstandingBalance != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _customerCurrency.format(
                        customer.outstandingBalance! > 0
                            ? customer.outstandingBalance
                            : 0,
                      ),
                      style: tx.bodySmall.copyWith(
                        fontWeight: FontWeight.w700,
                        color: customer.outstandingBalance! > 0
                            ? cs.danger600
                            : cs.success600,
                      ),
                    ),
                    Text(
                      customer.activeContractCount > 0
                          ? '${customer.activeContractCount} sözleşme'
                          : '${customer.jobCount} iş',
                      style: tx.label,
                    ),
                  ],
                ),
              Icon(Icons.chevron_right_rounded, color: cs.textFaint),
            ],
          ),
        ),
      ),
    );
  }
}
