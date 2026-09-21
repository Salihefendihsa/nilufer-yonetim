import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../models/customer.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/charts.dart';
import '../../widgets/state_views.dart';
import '../../widgets/stat_card.dart';
import '../../models/staff.dart';
import '../customers/customers_api.dart';
import '../staff/staff_api.dart';
import 'finance_api.dart';

final _currency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);
final _dateFormat = DateFormat('d MMM, HH:mm', 'tr_TR');

const Map<String, String> _paymentTypeLabels = {
  'CASH': 'Nakit',
  'CREDIT_CARD': 'Kredi Kartı',
  'TRANSFER': 'Havale/EFT',
};

/// backend/src/routes/payments.ts: /summary ve /export OWNER/MANAGER (+
/// view_finance izni); /  (liste) OWNER/MANAGER/CUSTOMER. Bu ekran "Daha
/// Fazla" menüsünde yalnızca yönetim rolüne açık olduğu için ekstra bir rol
/// dallanması yapılmaz — backend zaten 403 ile korur.
class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen>
    with SingleTickerProviderStateMixin {
  final _api = FinanceApi();
  late final TabController _tabController;
  PaymentsSummary? _summary;
  List<Payment> _payments = [];
  bool _loading = true;
  String? _error;
  bool _exporting = false;
  String? _receiptDownloadingId;
  List<Map<String, dynamic>> _revenueTrend = [];

  List<Expense> _expenses = [];
  bool _loadingExpenses = true;
  String? _expensesError;
  String? _expenseCategoryFilter;
  String? _deletingExpenseId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() {}));
    _load();
    _loadExpenses();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadExpenses() async {
    setState(() {
      _loadingExpenses = true;
      _expensesError = null;
    });
    try {
      final res = await _api.listExpenses(category: _expenseCategoryFilter);
      setState(() => _expenses = res.data);
    } catch (e) {
      setState(
        () => _expensesError = e is ApiException
            ? e.message
            : 'Giderler yüklenemedi',
      );
    } finally {
      setState(() => _loadingExpenses = false);
    }
  }

  Future<void> _deleteExpense(Expense expense) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Gideri Sil'),
        content: const Text('Bu gideri silmek istediğinize emin misiniz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _deletingExpenseId = expense.id);
    try {
      await _api.deleteExpense(expense.id);
      await _loadExpenses();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Gider silindi.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Silinemedi')),
        );
      }
    } finally {
      if (mounted) setState(() => _deletingExpenseId = null);
    }
  }

  Future<void> _exportExcel() async {
    setState(() => _exporting = true);
    try {
      await downloadAndShare('/payments/export/excel', 'odemeler.xlsx');
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

  Future<void> _downloadReceipt(Payment p) async {
    setState(() => _receiptDownloadingId = p.id);
    try {
      await downloadAndShare(
        '/payments/${p.id}/receipt/pdf',
        'makbuz-${p.id}.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Makbuz indirilemedi',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _receiptDownloadingId = null);
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final trendJson = await ApiClient.instance
          .get<Map<String, dynamic>>('/analytics/revenue-trend')
          .catchError((_) => <String, dynamic>{'data': []});
      final results = await Future.wait([
        _api.getSummary(),
        _api.listPayments(),
      ]);
      setState(() {
        _summary = results[0] as PaymentsSummary;
        _payments = (results[1] as dynamic).data as List<Payment>;
        _revenueTrend = (trendJson['data'] as List)
            .cast<Map<String, dynamic>>();
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException
            ? e.message
            : 'Finans verileri yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Para & Finans'),
        actions: [
          if (_tabController.index == 0)
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
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: () async {
              if (_tabController.index == 0) {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const _PaymentFormScreen()),
                );
                if (created == true) {
                  _load();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Tahsilat kaydedildi.')),
                    );
                  }
                }
              } else {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const _ExpenseFormScreen()),
                );
                if (created == true) {
                  _loadExpenses();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Gider kaydedildi.')),
                    );
                  }
                }
              }
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Tahsilatlar'),
            Tab(text: 'Giderler'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [_buildBody(), _buildExpensesBody()],
      ),
    );
  }

  Widget _buildExpensesBody() {
    final cs = context.colors;
    final tx = context.text;
    if (_loadingExpenses) return const LoadingView();
    if (_expensesError != null) {
      return ErrorRetryView(message: _expensesError!, onRetry: _loadExpenses);
    }

    final categoryTotals = <String, double>{};
    for (final e in _expenses) {
      categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
    }
    final totalAmount = _expenses.fold<double>(0, (sum, e) => sum + e.amount);

    return RefreshIndicator(
      onRefresh: _loadExpenses,
      color: cs.accentSoft,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          StatCardGrid(
            children: [
              AppStatCard(
                label: 'Toplam Gider',
                value: _currency.format(totalAmount),
                icon: Icons.receipt_long_rounded,
                iconColor: cs.danger500,
                iconBackground: cs.danger50,
              ),
              for (final entry in categoryTotals.entries)
                AppStatCard(
                  label: expenseCategoryLabelTr(entry.key),
                  value: _currency.format(entry.value),
                  icon: Icons.category_outlined,
                ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _CategoryChip(
                  label: 'Tümü',
                  selected: _expenseCategoryFilter == null,
                  onTap: () {
                    setState(() => _expenseCategoryFilter = null);
                    _loadExpenses();
                  },
                ),
                for (final c in expenseCategories)
                  Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: _CategoryChip(
                      label: expenseCategoryLabelTr(c),
                      selected: _expenseCategoryFilter == c,
                      onTap: () {
                        setState(() => _expenseCategoryFilter = c);
                        _loadExpenses();
                      },
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_expenses.isEmpty)
            const EmptyStateView(
              title: 'Henüz gider yok',
              icon: Icons.receipt_long_outlined,
            )
          else
            ..._expenses.map(
              (e) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: cs.surfaceCard,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: cs.borderDefault),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              expenseCategoryLabelTr(e.category),
                              style: tx.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              [
                                _dateFormat.format(DateTime.parse(e.date)),
                                if (e.description != null) e.description!,
                                if (e.recordedByUserName != null)
                                  e.recordedByUserName!,
                              ].join(' · '),
                              maxLines: 2,
                              style: tx.label,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            _currency.format(e.amount),
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: cs.danger500,
                            ),
                          ),
                          SizedBox(
                            width: 32,
                            height: 32,
                            child: _deletingExpenseId == e.id
                                ? const Padding(
                                    padding: EdgeInsets.all(8),
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : IconButton(
                                    padding: EdgeInsets.zero,
                                    iconSize: 18,
                                    tooltip: 'Sil',
                                    icon: Icon(
                                      Icons.delete_outline_rounded,
                                      color: cs.textFaint,
                                    ),
                                    onPressed: () => _deleteExpense(e),
                                  ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    final cs = context.colors;
    final tx = context.text;
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    final s = _summary!;

    return RefreshIndicator(
      onRefresh: _load,
      color: cs.accentSoft,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          StatCardGrid(
            children: [
              AppStatCard(
                label: 'Bu Ay Tahsilat',
                value: _currency.format(s.thisMonthTotal),
                icon: Icons.payments_rounded,
                caption: [
                  '${s.thisMonthPaymentCount} tahsilat',
                  // Gecen ay 0 ise yuzde degisim tanimsiz - hic gosterilmez.
                  if (s.monthOverMonthChangePercent != null)
                    'geçen aya göre '
                        '%${s.monthOverMonthChangePercent!.toStringAsFixed(0)}',
                  // Hedef yalnizca isletme sahibi tanimladiysa gosterilir.
                  if (s.monthlyRevenueTarget != null)
                    'hedef ${_currency.format(s.monthlyRevenueTarget)}',
                ].join(' · '),
              ),
              AppStatCard(
                label: 'Toplam Tahsilat',
                value: _currency.format(s.allTimeTotal),
                icon: Icons.account_balance_wallet_outlined,
                iconColor: cs.info600,
                iconBackground: cs.info50,
              ),
              AppStatCard(
                label: 'Bekleyen Bakiye',
                value: _currency.format(s.totalOutstandingBalance),
                icon: Icons.warning_amber_rounded,
                iconColor: cs.danger500,
                iconBackground: cs.danger50,
              ),
              AppStatCard(
                label: 'Bekleyen Avans',
                value: _currency.format(s.pendingAdvancesTotal),
                icon: Icons.hourglass_empty_rounded,
                iconColor: cs.warning600,
                iconBackground: cs.warning50,
                caption: '${s.pendingAdvancesCount} talep',
              ),
              if (s.netProfitThisMonth != null)
                AppStatCard(
                  label: 'Net Kâr (Ay)',
                  value: _currency.format(s.netProfitThisMonth),
                  icon: Icons.trending_up_rounded,
                  iconColor: cs.success600,
                  iconBackground: cs.success50,
                  caption: s.profitMargin != null
                      ? '%${s.profitMargin!.toStringAsFixed(1)} marj — yalnızca personel maaşı düşülerek hesaplanır'
                      : null,
                ),
            ],
          ),
          if (_revenueTrend.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(
              'Ciro Trendi',
              style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            RevenueTrendChart(
              points: _revenueTrend
                  .map(
                    (m) => ChartPoint(
                      m['label'] as String,
                      (m['total'] as num).toDouble(),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (s.paymentTypeBreakdown.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(
              'Ödeme Türü Dağılımı (Bu Ay)',
              style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: cs.surfaceCard,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: cs.borderDefault),
              ),
              child: Column(
                children: [
                  for (final entry in s.paymentTypeBreakdown)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              paymentTypeLabelTr(entry.paymentType),
                              style: tx.bodySmall,
                            ),
                          ),
                          Text(
                            '${entry.count} işlem',
                            style: tx.caption.copyWith(color: cs.textFaint),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            _currency.format(entry.total),
                            style: tx.bodySmall.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          Text(
            'Son Tahsilatlar',
            style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          if (_payments.isEmpty)
            const EmptyStateView(
              title: 'Henüz tahsilat yok',
              icon: Icons.receipt_long_outlined,
            )
          else
            ..._payments.map(
              (p) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: cs.surfaceCard,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: cs.borderDefault),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              p.customerName ??
                                  (_paymentTypeLabels[p.paymentType] ??
                                      p.paymentType),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: tx.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              [
                                _paymentTypeLabels[p.paymentType] ??
                                    p.paymentType,
                                _dateFormat.format(DateTime.parse(p.createdAt)),
                                if (p.referenceNo != null) p.referenceNo!,
                                if (p.collectedByStaffName != null)
                                  p.collectedByStaffName!,
                              ].join(' · '),
                              maxLines: 2,
                              style: tx.label,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            _currency.format(p.amount),
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: cs.success600,
                            ),
                          ),
                          SizedBox(
                            width: 32,
                            height: 32,
                            child: _receiptDownloadingId == p.id
                                ? const Padding(
                                    padding: EdgeInsets.all(8),
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : IconButton(
                                    padding: EdgeInsets.zero,
                                    iconSize: 18,
                                    tooltip: 'PDF makbuz indir/paylaş',
                                    icon: Icon(
                                      Icons.receipt_outlined,
                                      color: cs.textFaint,
                                    ),
                                    onPressed: () => _downloadReceipt(p),
                                  ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PaymentFormScreen extends StatefulWidget {
  const _PaymentFormScreen();

  @override
  State<_PaymentFormScreen> createState() => _PaymentFormScreenState();
}

class _PaymentFormScreenState extends State<_PaymentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _referenceController = TextEditingController();
  final _customersApi = CustomersApi();
  final _financeApi = FinanceApi();
  final _staffApi = StaffApi();
  List<Customer> _customers = [];
  List<Staff> _staff = [];
  String? _customerId;
  String? _collectedByStaffId;
  String _paymentType = 'CASH';
  bool _loadingOptions = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _customersApi.list(page: 1);
      // Tahsil eden personel listesi zorunlu degil; alinamazsa alan bos kalir.
      final staff = await _staffApi
          .list()
          .then((r) => r.data)
          .catchError((_) => <Staff>[]);
      setState(() {
        _customers = res.data;
        _staff = staff;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Müşteriler yüklenemedi',
      );
    } finally {
      setState(() => _loadingOptions = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _customerId == null) {
      setState(() => _error = _customerId == null ? 'Müşteri seçin' : null);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _financeApi.createPayment(
        customerId: _customerId!,
        amount: double.parse(_amountController.text.trim()),
        paymentType: _paymentType,
        referenceNo: _referenceController.text.trim(),
        collectedByStaffId: _collectedByStaffId,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Kaydedilemedi');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(title: const Text('Yeni Tahsilat')),
      body: _loadingOptions
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _customerId,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Müşteri *'),
                    items: _customers
                        .map(
                          (c) => DropdownMenuItem(
                            value: c.id,
                            child: Text(
                              c.fullName,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _customerId = v),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(labelText: 'Tutar (₺) *'),
                    validator: (v) =>
                        (v == null || double.tryParse(v.trim()) == null)
                        ? 'Geçerli bir tutar girin'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _paymentType,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Ödeme Türü'),
                    items: _paymentTypeLabels.entries
                        .map(
                          (e) => DropdownMenuItem(
                            value: e.key,
                            child: Text(e.value),
                          ),
                        )
                        .toList(),
                    onChanged: (v) =>
                        setState(() => _paymentType = v ?? _paymentType),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _referenceController,
                    decoration: const InputDecoration(
                      labelText: 'Dekont/İşlem No (opsiyonel)',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _collectedByStaffId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Tahsil Eden (opsiyonel)',
                    ),
                    items: [
                      const DropdownMenuItem<String>(
                        value: null,
                        child: Text('Ofis'),
                      ),
                      ..._staff.map(
                        (st) => DropdownMenuItem(
                          value: st.id,
                          child: Text(
                            st.fullName,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _collectedByStaffId = v),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: tx.bodySmall.copyWith(color: cs.danger500),
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
                        : const Text('Kaydet'),
                  ),
                ],
              ),
            ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: cs.primary600,
      labelStyle: tx.bodySmall.copyWith(
        color: selected ? Colors.white : cs.textSecondary,
        fontWeight: FontWeight.w600,
      ),
      backgroundColor: cs.surfaceCard,
      side: BorderSide(color: cs.borderDefault),
    );
  }
}

class _ExpenseFormScreen extends StatefulWidget {
  const _ExpenseFormScreen();

  @override
  State<_ExpenseFormScreen> createState() => _ExpenseFormScreenState();
}

class _ExpenseFormScreenState extends State<_ExpenseFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _financeApi = FinanceApi();
  String _category = expenseCategories.first;
  DateTime _date = DateTime.now();
  bool _saving = false;
  String? _error;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _financeApi.createExpense(
        category: _category,
        amount: double.parse(_amountController.text.trim()),
        description: _descriptionController.text.trim(),
        date: _date.toIso8601String(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Kaydedilemedi');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(title: const Text('Yeni Gider')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<String>(
              initialValue: _category,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Kategori *'),
              items: expenseCategories
                  .map(
                    (c) => DropdownMenuItem(
                      value: c,
                      child: Text(expenseCategoryLabelTr(c)),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _category = v ?? _category),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'Tutar (₺) *'),
              validator: (v) => (v == null || double.tryParse(v.trim()) == null)
                  ? 'Geçerli bir tutar girin'
                  : null,
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                );
                if (picked != null) setState(() => _date = picked);
              },
              child: InputDecorator(
                decoration: const InputDecoration(labelText: 'Tarih *'),
                child: Text(DateFormat('d MMM y', 'tr_TR').format(_date)),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Açıklama (opsiyonel)',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: tx.bodySmall.copyWith(color: cs.danger500)),
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
                  : const Text('Kaydet'),
            ),
          ],
        ),
      ),
    );
  }
}
