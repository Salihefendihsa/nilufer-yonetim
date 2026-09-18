import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../models/appointment_request.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'appointment_requests_api.dart';

final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');
final _dateTimeFormat = DateFormat('d MMM yyyy HH:mm', 'tr_TR');

const _statusColors = {
  'PENDING': AppColors.warning600,
  'SCHEDULED': AppColors.primary700,
  'DECLINED': AppColors.danger500,
};

/// Bölüm J (3. tur): CUSTOMER'ın "Randevu Taleplerim" ekranı — web'deki
/// müşteri Ana Sayfa'sındaki "Yeni Randevu İste" + "Randevu Taleplerim"
/// bölümünün mobil karşılığı. Talep formu alt sayfada açılır (izin talebi
/// akışıyla aynı desen), liste durum rozetleriyle gösterilir.
class MyAppointmentRequestsScreen extends StatefulWidget {
  const MyAppointmentRequestsScreen({super.key});

  @override
  State<MyAppointmentRequestsScreen> createState() =>
      _MyAppointmentRequestsScreenState();
}

class _MyAppointmentRequestsScreenState
    extends State<MyAppointmentRequestsScreen> {
  final _api = AppointmentRequestsApi();
  List<AppointmentRequest> _items = [];
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
      final items = await _api.list();
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is ApiException
              ? e.message
              : 'Randevu talepleri yüklenemedi',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openCreateForm() async {
    List<({String id, String name})> serviceTypes;
    try {
      serviceTypes = await _api.serviceTypes();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is ApiException ? e.message : 'Hizmet türleri yüklenemedi',
          ),
        ),
      );
      return;
    }
    if (!mounted) return;
    if (serviceTypes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tanımlı bir hizmet türü yok')),
      );
      return;
    }

    String serviceTypeId = serviceTypes.first.id;
    DateTime? startDate;
    DateTime? endDate;
    final noteController = TextEditingController();
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    var submitting = false;

    final created = await showModalBottomSheet<bool>(
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
              const Text(
                'Yeni Randevu İste',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: serviceTypeId,
                decoration: const InputDecoration(labelText: 'Hizmet türü'),
                items: [
                  for (final s in serviceTypes)
                    DropdownMenuItem(value: s.id, child: Text(s.name)),
                ],
                onChanged: (v) {
                  if (v != null) setSheetState(() => serviceTypeId = v);
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: startDate ?? tomorrow,
                          firstDate: tomorrow,
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          setSheetState(() {
                            startDate = picked;
                            if (endDate == null || endDate!.isBefore(picked)) {
                              endDate = picked;
                            }
                          });
                        }
                      },
                      child: Text(
                        startDate == null
                            ? 'En erken'
                            : _dateFormat.format(startDate!),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: endDate ?? startDate ?? tomorrow,
                          firstDate: startDate ?? tomorrow,
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          setSheetState(() => endDate = picked);
                        }
                      },
                      child: Text(
                        endDate == null
                            ? 'En geç'
                            : _dateFormat.format(endDate!),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                decoration: const InputDecoration(
                  labelText: 'Not (opsiyonel)',
                  hintText: 'Örn. Öğleden sonra evdeyim',
                ),
                minLines: 2,
                maxLines: 4,
                maxLength: 1000,
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: submitting
                    ? null
                    : () async {
                        if (startDate == null || endDate == null) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            const SnackBar(
                              content: Text('Tercih ettiğiniz tarih aralığını seçin'),
                            ),
                          );
                          return;
                        }
                        setSheetState(() => submitting = true);
                        try {
                          // Aralığın başı gün başlangıcı, sonu gün sonu (web ile aynı).
                          final s = startDate!;
                          final e = endDate!;
                          await _api.create(
                            serviceTypeId: serviceTypeId,
                            preferredDateStart:
                                DateTime(s.year, s.month, s.day),
                            preferredDateEnd:
                                DateTime(e.year, e.month, e.day, 23, 59, 59),
                            note: noteController.text.trim(),
                          );
                          if (ctx.mounted) Navigator.of(ctx).pop(true);
                        } catch (e) {
                          if (ctx.mounted) {
                            setSheetState(() => submitting = false);
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(
                                content: Text(
                                  e is ApiException
                                      ? e.message
                                      : 'Talep gönderilemedi',
                                ),
                              ),
                            );
                          }
                        }
                      },
                child: Text(submitting ? 'Gönderiliyor...' : 'Talebi Gönder'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
    if (created == true) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Talebiniz alındı, en kısa sürede sizinle iletişime geçeceğiz.',
            ),
          ),
        );
      }
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Randevu Taleplerim'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            tooltip: 'Yeni Randevu İste',
            onPressed: _openCreateForm,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'customer-new-appointment',
        backgroundColor: AppColors.primary600,
        foregroundColor: Colors.white,
        onPressed: _openCreateForm,
        icon: const Icon(Icons.event_available_rounded),
        label: const Text('Yeni Randevu İste'),
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: _items.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 80),
                        EmptyStateView(
                          title: 'Henüz randevu talebiniz yok',
                          subtitle:
                              'Tercih ettiğiniz hizmet ve tarih aralığıyla talep açın.',
                          icon: Icons.event_available_outlined,
                        ),
                      ],
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                      children: [
                        for (final r in _items) _RequestCard(request: r),
                      ],
                    ),
            ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  final AppointmentRequest request;
  const _RequestCard({required this.request});

  @override
  Widget build(BuildContext context) {
    final color = _statusColors[request.status] ?? AppColors.textFaint;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  request.serviceTypeName ?? 'Hizmet',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  appointmentRequestStatusLabelTr(request.status),
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${_dateFormat.format(DateTime.parse(request.preferredDateStart).toLocal())} – '
            '${_dateFormat.format(DateTime.parse(request.preferredDateEnd).toLocal())}',
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.textSecondary,
            ),
          ),
          if (request.note != null && request.note!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              request.note!,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
          if (request.status == 'SCHEDULED' &&
              request.resultingJobScheduledAt != null) ...[
            const SizedBox(height: 4),
            Text(
              'Randevu: ${_dateTimeFormat.format(DateTime.parse(request.resultingJobScheduledAt!).toLocal())}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.primary700,
              ),
            ),
          ],
          if (request.status == 'DECLINED' && request.declineReason != null) ...[
            const SizedBox(height: 4),
            Text(
              'Gerekçe: ${request.declineReason}',
              style: const TextStyle(fontSize: 12, color: AppColors.danger500),
            ),
          ],
        ],
      ),
    );
  }
}
