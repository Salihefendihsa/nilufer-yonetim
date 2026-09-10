import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/conversation.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'messages_api.dart';

final _timeFormat = DateFormat('HH:mm');
final _dayFormat = DateFormat('d MMMM yyyy', 'tr_TR');

class ChatScreen extends StatefulWidget {
  final String conversationId;
  final String participantName;
  /// Gözlemci modu (bkz. messages_list_screen.dart → Gözlemci Modu, yalnızca
  /// OWNER): mesajlar gösterilir ama gönderme kutusu yok; okundu işaretleme
  /// isteği de atılmaz — backend `markConversationRead`'i katılımcı olmayan
  /// biri için 403 ile reddediyor (`conversationsController.ts`).
  final bool readOnly;
  const ChatScreen({
    super.key,
    required this.conversationId,
    required this.participantName,
    this.readOnly = false,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _api = MessagesApi();
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  List<MessageItem> _messages = [];
  bool _loading = true;
  bool _sending = false;

  /// Gonderilmeyi bekleyen saha fotografi (Stitch Sef -> Mesaj Detayi).
  File? _pendingPhoto;
  String? _error;

  String? get _myId => context.read<AuthProvider>().user?.id;

  /// Mesaj listesini gün ayırıcılarıyla (web'in "X Ocak 2026" bölücüleri)
  /// tek bir akışa dönüştürür — `DateTime` = gün başlığı, `MessageItem` =
  /// mesaj kabarcığı.
  List<Object> get _timelineItems {
    final items = <Object>[];
    DateTime? lastDay;
    for (final m in _messages) {
      final created = DateTime.parse(m.createdAt);
      final day = DateTime(created.year, created.month, created.day);
      if (lastDay == null || day != lastDay) {
        items.add(day);
        lastDay = day;
      }
      items.add(m);
    }
    return items;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.getMessages(widget.conversationId, page: 1);
      setState(() => _messages = res.data);
      if (!widget.readOnly) await _api.markRead(widget.conversationId);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Mesajlar yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  /// Galeriden saha fotografi secer; gonderime kadar onizlemede bekler.
  Future<void> _pickPhoto() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      imageQuality: 80,
    );
    if (picked == null) return;
    setState(() => _pendingPhoto = File(picked.path));
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    final photo = _pendingPhoto;
    // Yalniz fotograf gonderilmek istenirse icerik bos kalmasin diye
    // varsayilan bir metin kullanilir (backend content'i zorunlu tutuyor).
    if (text.isEmpty && photo == null) return;
    setState(() => _sending = true);
    _controller.clear();
    try {
      String? base64Photo;
      if (photo != null) {
        final bytes = await photo.readAsBytes();
        base64Photo = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      }
      final msg = await _api.sendMessage(
        widget.conversationId,
        text.isEmpty ? '📷 Saha fotoğrafı' : text,
        attachmentBase64: base64Photo,
      );
      setState(() {
        _messages = [..._messages, msg];
        _pendingPhoto = null;
      });
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Mesaj gönderilemedi',
            ),
          ),
        );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: Text(widget.participantName)),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorRetryView(message: _error!, onRetry: _load)
                : _messages.isEmpty
                ? const EmptyStateView(
                    title: 'Henüz mesaj yok',
                    icon: Icons.chat_bubble_outline_rounded,
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _timelineItems.length,
                    itemBuilder: (context, i) {
                      final item = _timelineItems[i];
                      if (item is DateTime) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Center(
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceMuted,
                                borderRadius: BorderRadius.circular(AppRadius.pill),
                              ),
                              child: Text(
                                _dayFormat.format(item),
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        );
                      }
                      final m = item as MessageItem;
                      final mine = m.senderId == _myId;
                      return Align(
                        alignment: mine
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          constraints: BoxConstraints(
                            maxWidth: MediaQuery.of(context).size.width * 0.72,
                          ),
                          decoration: BoxDecoration(
                            color: mine
                                ? AppColors.primary600
                                : AppColors.surfaceCard,
                            borderRadius: BorderRadius.circular(AppRadius.card),
                            border: mine
                                ? null
                                : Border.all(color: AppColors.borderDefault),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (m.attachmentUrl != null) ...[
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.network(
                                    ApiClient.instance.resolveUploadUrl(
                                      m.attachmentUrl!,
                                    ),
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, _, _) => Container(
                                      padding: const EdgeInsets.all(12),
                                      color: AppColors.surfaceMuted,
                                      child: const Text(
                                        'Görsel yüklenemedi',
                                        style: TextStyle(fontSize: 11),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),
                              ],
                              Text(
                                m.content,
                                style: TextStyle(
                                  color: mine
                                      ? Colors.white
                                      : AppColors.textPrimary,
                                  fontSize: 13.5,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    _timeFormat.format(
                                      DateTime.parse(m.createdAt),
                                    ),
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: mine
                                          ? Colors.white70
                                          : AppColors.textFaint,
                                    ),
                                  ),
                                  // Okundu bilgisi yalnızca KENDİ gönderdiğimiz
                                  // mesajlarda gösterilir (web'in çift tik
                                  // deseniyle aynı: tek tik = gönderildi, çift
                                  // tik = karşı taraf okudu).
                                  if (mine) ...[
                                    const SizedBox(width: 4),
                                    Icon(
                                      m.readAt != null
                                          ? Icons.done_all_rounded
                                          : Icons.done_rounded,
                                      size: 13,
                                      color: m.readAt != null
                                          ? const Color(0xFF9BE7FF)
                                          : Colors.white70,
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          if (widget.readOnly)
            SafeArea(
              top: false,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                color: AppColors.surfaceMuted,
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.visibility_outlined,
                      size: 15,
                      color: AppColors.textSecondary,
                    ),
                    SizedBox(width: 6),
                    Text(
                      'Gözlemci modu — salt okunur, mesaj gönderemezsiniz',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_pendingPhoto != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(
                              _pendingPhoto!,
                              width: 48,
                              height: 48,
                              fit: BoxFit.cover,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Fotoğraf eklendi',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, size: 18),
                            onPressed: () =>
                                setState(() => _pendingPhoto = null),
                          ),
                        ],
                      ),
                    ),
                  Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.attach_file_rounded),
                    tooltip: 'Fotoğraf ekle',
                    onPressed: _sending ? null : _pickPhoto,
                    color: AppColors.textSecondary,
                  ),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: const InputDecoration(
                        hintText: 'Mesaj yaz...',
                      ),
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _sending ? null : _send,
                    icon: const Icon(Icons.send_rounded),
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.primary600,
                      foregroundColor: Colors.white,
                    ),
                  ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
