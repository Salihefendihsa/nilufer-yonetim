import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../models/customer.dart';
import '../../theme/app_colors.dart';
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

class _FinanceScreenState extends State<FinanceScreen> {
  final _api = FinanceApi();
  PaymentsSummary? _summary;
  List<Payment> _payments = [];
  bool _loading = true;
  String? _error;
  bool _exporting = false;
  String? _receiptDownloadingId;
  List<Map<String, dynamic>> _revenueTrend = [];

  @override
  void initState() {
    super.initState();
    _load();
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
      await downloadAndShare('/payments/${p.id}/receipt/pdf', 'makbuz-${p.id}.pdf');
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
        _revenueTrend = (trendJson['data'] as List).cast<Map<String, dynamic>>();
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
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(
        title: const Text('Para & Finans'),
        actions: [
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
            },
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    final s = _summary!;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary600,
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
                iconColor: AppColors.info600,
                iconBackground: AppColors.info50,
              ),
              AppStatCard(
                label: 'Bekleyen Bakiye',
                value: _currency.format(s.totalOutstandingBalance),
                icon: Icons.warning_amber_rounded,
                iconColor: AppColors.danger500,
                iconBackground: AppColors.danger50,
              ),
              AppStatCard(
                label: 'Bekleyen Avans',
                value: _currency.format(s.pendingAdvancesTotal),
                icon: Icons.hourglass_empty_rounded,
                iconColor: AppColors.warning600,
                iconBackground: AppColors.warning50,
                caption: '${s.pendingAdvancesCount} talep',
              ),
              if (s.netProfitThisMonth != null)
                AppStatCard(
                  label: 'Net Kâr (Ay)',
                  value: _currency.format(s.netProfitThisMonth),
                  icon: Icons.trending_up_rounded,
                  iconColor: AppColors.success600,
                  iconBackground: AppColors.success50,
                  caption: s.profitMargin != null
                      ? '%${s.profitMargin!.toStringAsFixed(1)} marj — yalnızca personel maaşı düşülerek hesaplanır'
                      : null,
                ),
            ],
          ),
          if (_revenueTrend.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text(
              'Ciro Trendi',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
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
            const Text(
              'Ödeme Türü Dağılımı (Bu Ay)',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surfaceCard,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: AppColors.borderDefault),
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
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          Text(
                            '${entry.count} işlem',
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: AppColors.textFaint,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            _currency.format(entry.total),
                            style: const TextStyle(
                              fontSize: 13,
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
          const Text(
            'Son Tahsilatlar',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
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
                    color: AppColors.surfaceCard,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: AppColors.borderDefault),
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
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
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
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textFaint,
                              ),
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
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.success600,
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
                                    icon: const Icon(
                                      Icons.receipt_outlined,
                                      color: AppColors.textFaint,
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
      final staff = await _staffApi.list().then((r) => r.data).catchError(
        (_) => <Staff>[],
      );
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
                        : const Text('Kaydet'),
                  ),
                ],
              ),
            ),
    );
  }
}
