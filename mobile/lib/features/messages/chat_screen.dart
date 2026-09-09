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

class ChatScreen extends StatefulWidget {
  final String conversationId;
  final String participantName;
  const ChatScreen({
    super.key,
    required this.conversationId,
    required this.participantName,
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
      await _api.markRead(widget.conversationId);
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
                    itemCount: _messages.length,
                    itemBuilder: (context, i) {
                      final m = _messages[i];
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
                            borderRadius: BorderRadius.circular(16),
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
                              Text(
                                _timeFormat.format(DateTime.parse(m.createdAt)),
                                style: TextStyle(
                                  fontSize: 10,
                                  color: mine
                                      ? Colors.white70
                                      : AppColors.textFaint,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
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
