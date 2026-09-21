import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';

/// Bölüm AB (6. tur): GET /customers/:id/documents satırı.
class CustomerDocument {
  final String id;
  final String fileName;
  final String fileUrl;
  final String fileType;
  final int fileSize;
  final String uploadedAt;
  final String? uploadedByName;

  const CustomerDocument({
    required this.id,
    required this.fileName,
    required this.fileUrl,
    required this.fileType,
    required this.fileSize,
    required this.uploadedAt,
    this.uploadedByName,
  });

  factory CustomerDocument.fromJson(Map<String, dynamic> json) =>
      CustomerDocument(
        id: json['id'] as String,
        fileName: json['fileName'] as String? ?? 'belge',
        fileUrl: json['fileUrl'] as String? ?? '',
        fileType: json['fileType'] as String? ?? '',
        fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
        uploadedAt: json['uploadedAt'] as String? ?? '',
        uploadedByName:
            (json['uploadedBy'] as Map<String, dynamic>?)?['fullName']
                as String?,
      );

  bool get isImage => fileType.startsWith('image/');

  String get sizeLabel {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024)
      return '${(fileSize / 1024).toStringAsFixed(0)} KB';
    return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class CustomerDocumentsApi {
  final _api = ApiClient.instance;

  Future<List<CustomerDocument>> list(String customerId) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/customers/$customerId/documents',
    );
    return ((json['data'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(CustomerDocument.fromJson)
        .toList();
  }

  Future<CustomerDocument> upload(String customerId, File file) async {
    final json = await _api.uploadMultipart<Map<String, dynamic>>(
      '/customers/$customerId/documents',
      fieldName: 'file',
      file: file,
    );
    return CustomerDocument.fromJson(json);
  }

  Future<void> delete(String customerId, String docId) =>
      _api.delete<void>('/customers/$customerId/documents/$docId');
}

/// Müşteri detayı → "Belgeler" sekmesi (OWNER/MANAGER): yükle / paylaş / sil.
class CustomerDocumentsTab extends StatefulWidget {
  final String customerId;
  const CustomerDocumentsTab({super.key, required this.customerId});

  @override
  State<CustomerDocumentsTab> createState() => _CustomerDocumentsTabState();
}

class _CustomerDocumentsTabState extends State<CustomerDocumentsTab> {
  final _api = CustomerDocumentsApi();
  List<CustomerDocument> _docs = [];
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
      final docs = await _api.list(widget.customerId);
      if (mounted) setState(() => _docs = docs);
    } catch (e) {
      if (mounted)
        setState(
          () => _error = e is ApiException ? e.message : 'Belgeler yüklenemedi',
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickAndUpload() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: [
        'pdf',
        'jpg',
        'jpeg',
        'png',
        'webp',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'txt',
      ],
      withData: false,
    );
    final path = result?.files.single.path;
    if (path == null) return;
    setState(() => _busy = true);
    try {
      await _api.upload(widget.customerId, File(path));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Belge yüklendi')));
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Yüklenemedi'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete(CustomerDocument d) async {
    final cs = context.colors;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Belgeyi sil'),
        content: Text(
          '"${d.fileName}" kalıcı olarak silinecek (dosya diskten de kaldırılır).',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: cs.danger500),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await _api.delete(widget.customerId, d.id);
      await _load();
    } on ApiException catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _busy ? null : _pickAndUpload,
              icon: const Icon(Icons.upload_file_outlined, size: 18),
              label: Text(
                _busy ? 'Yükleniyor...' : 'Belge Yükle (PDF, resim, ofis)',
              ),
            ),
          ),
        ),
        Expanded(
          child: _loading
              ? const LoadingView()
              : _error != null
              ? ErrorRetryView(message: _error!, onRetry: _load)
              : _docs.isEmpty
              ? const EmptyStateView(
                  title: 'Henüz belge yok',
                  subtitle: 'Sözleşme taraması, kimlik fotokopisi gibi dosyaları buraya yükleyin.',
                  icon: Icons.folder_open_outlined,
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  color: cs.accentSoft,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _docs.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final d = _docs[i];
                      return Container(
                        padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
                        decoration: BoxDecoration(
                          color: cs.surfaceCard,
                          borderRadius: BorderRadius.circular(AppRadius.card),
                          border: Border.all(color: cs.borderDefault),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              d.isImage
                                  ? Icons.image_outlined
                                  : Icons.description_outlined,
                              color: cs.textSecondary,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    d.fileName,
                                    overflow: TextOverflow.ellipsis,
                                    style: tx.body.copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    '${d.sizeLabel}'
                                    '${d.uploadedAt.isNotEmpty ? ' · ${DateFormat('d MMM yyyy', 'tr_TR').format(DateTime.parse(d.uploadedAt).toLocal())}' : ''}'
                                    '${d.uploadedByName != null ? ' · ${d.uploadedByName}' : ''}',
                                    style: tx.caption.copyWith(
                                      color: cs.textFaint,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: const Icon(
                                Icons.ios_share_rounded,
                                size: 20,
                              ),
                              tooltip: 'İndir / Paylaş',
                              // Bölüm AC: kimlik doğrulamalı indirme (getBytes token gönderir).
                              onPressed: _busy
                                  ? null
                                  : () => downloadAndShare(
                                      ApiClient.instance.fileUrl(
                                        'customer-document',
                                        d.id,
                                      ),
                                      d.fileName,
                                    ),
                            ),
                            IconButton(
                              icon: Icon(
                                Icons.delete_outline_rounded,
                                size: 20,
                                color: cs.danger500,
                              ),
                              tooltip: 'Sil',
                              onPressed: _busy ? null : () => _delete(d),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}
