import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/conversation.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../navigation/manager_nav.dart';
import '../../widgets/state_views.dart';
import 'chat_screen.dart';
import 'messages_api.dart';

final _timeFormat = DateFormat('HH:mm');

/// backend/src/lib/messaging.ts:canUsersMessage kapsamındaki kısıt zaten
/// /conversations/available-contacts uçtan uygulanıyor — bu ekran ek bir
/// filtre uygulamaz, listelenen herkesle konuşma başlatılabilir.
class MessagesListScreen extends StatefulWidget {
  const MessagesListScreen({super.key});

  @override
  State<MessagesListScreen> createState() => _MessagesListScreenState();
}

class _MessagesListScreenState extends State<MessagesListScreen> {
  final _api = MessagesApi();
  List<ConversationSummary> _conversations = [];
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
      final res = await _api.listConversations();
      setState(() => _conversations = res);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Konuşmalar yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _openNewConversationSheet() async {
    List<AvailableContact> contacts = [];
    String? loadError;
    try {
      contacts = await _api.availableContacts();
    } catch (e) {
      loadError = e is ApiException ? e.message : 'Kişiler yüklenemedi';
    }
    if (!mounted) return;

    if (loadError != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(loadError)));
      return;
    }
    if (contacts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mesajlaşabileceğiniz kimse yok')),
      );
      return;
    }

    final selected = await showModalBottomSheet<AvailableContact>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        expand: false,
        builder: (ctx, scrollController) => ListView.builder(
          controller: scrollController,
          padding: const EdgeInsets.all(16),
          itemCount: contacts.length,
          itemBuilder: (ctx, i) {
            final c = contacts[i];
            return ListTile(
              title: Text(c.fullName),
              subtitle: Text(roleLabelTr(roleFromString(c.role))),
              onTap: () => Navigator.of(ctx).pop(c),
            );
          },
        ),
      ),
    );
    if (selected == null) return;
    try {
      final conversationId = await _api.startConversation(selected.id);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            conversationId: conversationId,
            participantName: selected.fullName,
          ),
        ),
      );
      _load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Konuşma başlatılamadı',
            ),
          ),
        );
    }
  }

  bool get _canBroadcast {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.teamLead ||
        role == AppRole.owner ||
        role == AppRole.manager;
  }

  /// Şefin doğrudan ekibinin tamamına aynı mesajı göndermesi
  /// (Stitch Şef → Mesajlar: "Tüm Ekibime Toplu Duyuru Gönder").
  Future<void> _openBroadcastSheet() async {
    final controller = TextEditingController();
    final text = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
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
              'Tüm Ekibime Duyuru',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 4),
            const Text(
              'Mesaj, doğrudan size bağlı her ekip üyesine ayrı ayrı iletilir.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'Duyuru metni'),
              minLines: 2,
              maxLines: 5,
              autofocus: true,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
              child: const Text('Duyuruyu Gönder'),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (text == null || text.isEmpty) return;
    try {
      final count = await _api.broadcastToTeam(text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$count ekip üyesine duyuru gönderildi')),
        );
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Duyuru gönderilemedi',
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(
        leading: ManagerNav.maybeLeading(context),
        title: const Text('Mesajlar'),
        actions: [
          // Toplu duyuru: doğrudan ekibi olan roller (backend
          // /conversations/broadcast OWNER/MANAGER/TEAM_LEAD).
          if (_canBroadcast)
            IconButton(
              icon: const Icon(Icons.campaign_outlined),
              tooltip: 'Ekibime duyuru',
              onPressed: _openBroadcastSheet,
            ),
          IconButton(
            icon: const Icon(Icons.edit_square),
            onPressed: _openNewConversationSheet,
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_conversations.isEmpty) {
      return EmptyStateView(
        title: 'Henüz mesajınız yok',
        subtitle:
            'Yeni bir konuşma başlatmak için sağ üstteki simgeye dokunun.',
        icon: Icons.chat_bubble_outline_rounded,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary600,
      child: ListView.separated(
        itemCount: _conversations.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final c = _conversations[i];
          final unread = c.unreadCount > 0;
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: AppColors.primary100,
              child: Text(
                c.participant.fullName.isNotEmpty
                    ? c.participant.fullName[0].toUpperCase()
                    : '?',
                style: const TextStyle(
                  color: AppColors.primary700,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            title: Text(
              c.participant.fullName,
              style: TextStyle(
                fontWeight: unread ? FontWeight.w800 : FontWeight.w600,
                fontSize: 13.5,
              ),
            ),
            subtitle: Text(
              c.lastMessage?.content ?? 'Henüz mesaj yok',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12.5,
                color: unread ? AppColors.textPrimary : AppColors.textSecondary,
                fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _timeFormat.format(DateTime.parse(c.updatedAt)),
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textFaint,
                  ),
                ),
                if (unread) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary600,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '${c.unreadCount}',
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            onTap: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ChatScreen(
                    conversationId: c.id,
                    participantName: c.participant.fullName,
                  ),
                ),
              );
              _load();
            },
          );
        },
      ),
    );
  }
}
