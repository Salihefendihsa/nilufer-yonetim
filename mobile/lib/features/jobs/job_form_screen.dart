import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/customer.dart';
import '../../models/staff.dart';
import '../customers/customers_api.dart';
import '../staff/staff_api.dart';
import 'jobs_api.dart';

/// POST /jobs — backend OWNER/MANAGER'a kısıtlıyor (routes/jobs.ts:24).
class JobFormScreen extends StatefulWidget {
  const JobFormScreen({super.key});

  @override
  State<JobFormScreen> createState() => _JobFormScreenState();
}

class _JobFormScreenState extends State<JobFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _serviceTypeController = TextEditingController();
  final _priceController = TextEditingController();
  final _notesController = TextEditingController();

  final _customersApi = CustomersApi();
  final _staffApi = StaffApi();
  final _jobsApi = JobsApi();

  List<Customer> _customers = [];
  List<Staff> _staff = [];
  String? _selectedCustomerId;
  String? _selectedStaffId;
  DateTime? _scheduledAt;
  DateTime? _scheduledEndAt;
  bool _loadingOptions = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  @override
  void dispose() {
    _serviceTypeController.dispose();
    _priceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final results = await Future.wait([
        _customersApi.list(page: 1),
        _staffApi.list(page: 1),
      ]);
      setState(() {
        _customers = (results[0] as dynamic).data as List<Customer>;
        _staff = (results[1] as dynamic).data as List<Staff>;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Seçenekler yüklenemedi',
      );
    } finally {
      setState(() => _loadingOptions = false);
    }
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (time == null) return;
    setState(
      () => _scheduledAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ),
    );
  }

  /// Randevu penceresinin bitisi - Stitch kartlarindaki "09:00 - 11:00".
  Future<void> _pickEndDateTime() async {
    final base = _scheduledAt ?? DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _scheduledEndAt ?? base,
      firstDate: base.subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_scheduledEndAt ?? base),
    );
    if (time == null) return;
    setState(
      () => _scheduledEndAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _selectedCustomerId == null) {
      setState(
        () => _error = _selectedCustomerId == null ? 'Müşteri seçin' : null,
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _jobsApi.create(
        customerId: _selectedCustomerId!,
        assignedStaffId: _selectedStaffId,
        serviceType: _serviceTypeController.text.trim(),
        scheduledAt: _scheduledAt,
        scheduledEndAt: _scheduledEndAt,
        notes: _notesController.text.trim(),
        price: _priceController.text.trim().isEmpty
            ? null
            : double.tryParse(_priceController.text.trim()),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'İş oluşturulamadı',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yeni İş')),
      body: _loadingOptions
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _selectedCustomerId,
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
                    onChanged: (v) => setState(() => _selectedCustomerId = v),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedStaffId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Personel (opsiyonel)',
                    ),
                    items: _staff
                        .map(
                          (s) => DropdownMenuItem(
                            value: s.id,
                            child: Text(
                              s.fullName,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _selectedStaffId = v),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _serviceTypeController,
                    decoration: const InputDecoration(
                      labelText: 'Hizmet Türü *',
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Zorunlu alan' : null,
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: _pickDateTime,
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Planlanan Tarih/Saat (opsiyonel)',
                      ),
                      child: Text(
                        _scheduledAt == null
                            ? 'Seçilmedi'
                            : _scheduledAt.toString(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: _pickEndDateTime,
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Tahmini Bitiş (opsiyonel)',
                      ),
                      child: Text(
                        _scheduledEndAt == null
                            ? 'Seçilmedi'
                            : _scheduledEndAt.toString(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _priceController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Fiyat (opsiyonel)',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _notesController,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Notlar (opsiyonel)',
                    ),
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
                        : const Text('Oluştur'),
                  ),
                ],
              ),
            ),
    );
  }
}
