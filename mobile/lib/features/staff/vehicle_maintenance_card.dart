import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/vehicle_maintenance.dart';
import '../../theme/app_colors.dart';

final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');

/// Bölüm AQ (9. tur): "Araç Bakımı" kartı — personel detayında YALNIZCA
/// vehiclePlate doluysa gösterilir (çağıran koşullar). OWNER/MANAGER ekler/
/// siler; STAFF/TEAM_LEAD kendi kaydını salt-okunur görür. Yetki yoksa
/// (403) kart gizlenir.
class VehicleMaintenanceCard extends StatefulWidget {
  final String staffId;
  final String vehiclePlate;
  final bool editable;
  const VehicleMaintenanceCard({
    super.key,
    required this.staffId,
    required this.vehiclePlate,
    required this.editable,
  });

  @override
  State<VehicleMaintenanceCard> createState() => _VehicleMaintenanceCardState();
}

class _VehicleMaintenanceCardState extends State<VehicleMaintenanceCard> {
  final _api = ApiClient.instance;
  List<VehicleMaintenance> _rows = const [];
  bool _loading = true;
  bool _hidden = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await _api.get<Map<String, dynamic>>(
        '/staff/${widget.staffId}/vehicle-maintenance',
      );
      if (!mounted) return;
      setState(() {
        _rows = (json['data'] as List)
            .cast<Map<String, dynamic>>()
            .map(VehicleMaintenance.fromJson)
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _hidden = e is ApiException && e.status == 403;
        _loading = false;
      });
    }
  }

  Future<void> _add() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddSheet(staffId: widget.staffId),
    );
    if (created == true) _load();
  }

  Future<void> _delete(VehicleMaintenance row) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Bakım kaydını sil'),
        content: const Text('Bu bakım kaydı kalıcı olarak silinecek.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Vazgeç')),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sil', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.delete('/staff/${widget.staffId}/vehicle-maintenance/${row.id}');
      _load();
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
    if (_hidden) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Container(
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
                const Icon(Icons.local_shipping_outlined, size: 18, color: AppColors.primary700),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Araç Bakımı',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                  ),
                ),
                Text(
                  widget.vehiclePlate,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                if (widget.editable)
                  IconButton(
                    onPressed: _add,
                    icon: const Icon(Icons.add_rounded, size: 20),
                    tooltip: 'Bakım ekle',
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator(strokeWidth: 2)))
            else if (_rows.isEmpty)
              const Text(
                'Henüz bakım kaydı yok.',
                style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
              )
            else
              for (final row in _rows) _RowTile(row: row, onDelete: widget.editable ? () => _delete(row) : null),
          ],
        ),
      ),
    );
  }
}

class _RowTile extends StatelessWidget {
  final VehicleMaintenance row;
  final VoidCallback? onDelete;
  const _RowTile({required this.row, this.onDelete});

  @override
  Widget build(BuildContext context) {
    final color = row.isOverdue || row.daysLeft <= 7
        ? AppColors.danger600
        : row.daysLeft <= 14
        ? AppColors.warning600
        : AppColors.success600;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  vehicleMaintenanceTypeLabel(row.maintenanceType),
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
                Text(
                  'Son: ${_dateFormat.format(DateTime.parse(row.lastServiceDate))} · Sonraki: ${_dateFormat.format(DateTime.parse(row.nextDueDate))}'
                  '${row.note != null && row.note!.isNotEmpty ? ' · ${row.note}' : ''}',
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              row.dueLabel,
              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: color),
            ),
          ),
          if (onDelete != null)
            IconButton(
              onPressed: onDelete,
              icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.danger600),
              visualDensity: VisualDensity.compact,
            ),
        ],
      ),
    );
  }
}

class _AddSheet extends StatefulWidget {
  final String staffId;
  const _AddSheet({required this.staffId});

  @override
  State<_AddSheet> createState() => _AddSheetState();
}

class _AddSheetState extends State<_AddSheet> {
  String _type = 'INSPECTION';
  DateTime _last = DateTime.now();
  DateTime _next = DateTime.now().add(const Duration(days: 365));
  final _note = TextEditingController();
  bool _saving = false;
  String? _error;

  String _iso(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pick(bool isLast) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isLast ? _last : _next,
      firstDate: DateTime.now().subtract(const Duration(days: 3650)),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (picked != null) setState(() => isLast ? _last = picked : _next = picked);
  }

  Future<void> _save() async {
    if (_next.isBefore(_last)) {
      setState(() => _error = 'Sonraki bakım tarihi son bakım tarihinden önce olamaz');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ApiClient.instance.post('/staff/${widget.staffId}/vehicle-maintenance', body: {
        'maintenanceType': _type,
        'lastServiceDate': _iso(_last),
        'nextDueDate': _iso(_next),
        if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Kaydedilemedi');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Yeni bakım kaydı', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _type,
            decoration: const InputDecoration(labelText: 'Tür'),
            items: [
              for (final t in vehicleMaintenanceTypes)
                DropdownMenuItem(value: t, child: Text(vehicleMaintenanceTypeLabel(t))),
            ],
            onChanged: (v) => setState(() => _type = v ?? _type),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pick(true),
                  icon: const Icon(Icons.event_outlined, size: 16),
                  label: Text('Son: ${_dateFormat.format(_last)}'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pick(false),
                  icon: const Icon(Icons.event_repeat_outlined, size: 16),
                  label: Text('Sonraki: ${_dateFormat.format(_next)}'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _note,
            maxLength: 500,
            decoration: const InputDecoration(labelText: 'Not (opsiyonel)'),
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: AppColors.danger600, fontSize: 12.5)),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Kaydediliyor...' : 'Ekle'),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}
