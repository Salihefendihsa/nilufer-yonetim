import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/conversation.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import 'chat_screen.dart';
import 'messages_api.dart';
import 'package:provider/provider.dart';

final _timeFormat = DateFormat('d MMM, HH:mm', 'tr_TR');

/// web/src/app/(dashboard)/mesajlar/page.tsx: "Tüm Konuşmalar" (gözlemci)
/// modu — yalnızca OWNER, `GET /conversations/all`. Herkesin konuşmasını
/// salt okunur açabilir (backend zaten katılımcı olmayan biri için
/// `GET /conversations/:id/messages`'ı OWNER'a özel olarak izin veriyor,
/// `sendMessage`/`markRead` ise reddediyor — bkz. chat_screen.dart:readOnly).
class ObserverConversationsScreen extends StatefulWidget {
  const ObserverConversationsScreen({super.key});

  @override
  State<ObserverConversationsScreen> createState() =>
      _ObserverConversationsScreenState();
}

class _ObserverConversationsScreenState
    extends State<ObserverConversationsScreen> {
  final _api = MessagesApi();
  List<AllConversationSummary> _conversations = [];
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
      final res = await _api.listAllConversations();
      setState(() => _conversations = res);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Konuşmalar yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final myId = context.read<AuthProvider>().user?.id;

    return Scaffold(
      appBar: AppBar(title: const Text('Gözlemci Modu — Tüm Konuşmalar')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _conversations.isEmpty
          ? const EmptyStateView(
              title: 'Hiç konuşma yok',
              icon: Icons.forum_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView.separated(
                itemCount: _conversations.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final c = _conversations[i];
                  final isMine =
                      c.participantA.id == myId || c.participantB.id == myId;
                  final title =
                      '${c.participantA.fullName} ↔ ${c.participantB.fullName}';
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppColors.surfaceMuted,
                      child: Icon(
                        isMine
                            ? Icons.chat_bubble_rounded
                            : Icons.visibility_outlined,
                        size: 18,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    title: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    subtitle: Text(
                      c.lastMessage?.content ?? 'Henüz mesaj yok',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12),
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          _timeFormat.format(DateTime.parse(c.updatedAt)),
                          style: const TextStyle(
                            fontSize: 10.5,
                            color: AppColors.textFaint,
                          ),
                        ),
                        Text(
                          '${c.messageCount} mesaj',
                          style: const TextStyle(
                            fontSize: 10.5,
                            color: AppColors.textFaint,
                          ),
                        ),
                      ],
                    ),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ChatScreen(
                          conversationId: c.id,
                          participantName: title,
                          readOnly: !isMine,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
