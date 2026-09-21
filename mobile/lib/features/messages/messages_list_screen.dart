import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/conversation.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../navigation/manager_nav.dart';
import '../search/search_action.dart';
import '../../widgets/state_views.dart';
import '../../widgets/stat_card.dart';
import 'chat_screen.dart';
import 'messages_api.dart';
import 'observer_access_api.dart';
import 'observer_access_sheet.dart';
import 'observer_conversations_screen.dart';

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
  final _observerApi = ObserverAccessApi();
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

  /// Gözlemci Modu'na girmeden önce aktif bir ObserverAccessGrant olup
  /// olmadığını kontrol eder; yoksa gerekçe+süre formunu açar
  /// (web/src/app/(dashboard)/mesajlar/page.tsx:handleOpenObserverMode ile
  /// aynı akış).
  Future<void> _openObserverMode() async {
    try {
      final current = await _observerApi.getCurrent();
      if (current == null) {
        final granted = await showObserverAccessSheet(context);
        if (granted == null || !mounted) return;
      }
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const ObserverConversationsScreen()),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException
                  ? e.message
                  : 'Gözlemci erişimi kontrol edilemedi',
            ),
          ),
        );
      }
    }
  }

  bool get _isOwner => context.read<AuthProvider>().user?.role == AppRole.owner;

  bool get _canBroadcast {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.teamLead ||
        role == AppRole.owner ||
        role == AppRole.manager;
  }

  /// Şefin doğrudan ekibinin tamamına aynı mesajı göndermesi
  /// (Stitch Şef → Mesajlar: "Tüm Ekibime Toplu Duyuru Gönder").
  Future<void> _openBroadcastSheet() async {
    final tx = context.text;
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
            Text(
              'Tüm Ekibime Duyuru',
              style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              'Mesaj, doğrudan size bağlı her ekip üyesine ayrı ayrı iletilir.',
              style: tx.caption,
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
      appBar: AppBar(
        leading: ManagerNav.maybeLeading(context),
        title: const Text('Mesajlar'),
        actions: [
          const SearchAction(),
          // Toplu duyuru: doğrudan ekibi olan roller (backend
          // /conversations/broadcast OWNER/MANAGER/TEAM_LEAD).
          if (_canBroadcast)
            IconButton(
              icon: const Icon(Icons.campaign_outlined),
              tooltip: 'Ekibime duyuru',
              onPressed: _openBroadcastSheet,
            ),
          if (_isOwner)
            IconButton(
              icon: const Icon(Icons.visibility_outlined),
              tooltip: 'Gözlemci Modu — Tüm Konuşmalar',
              onPressed: _openObserverMode,
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

  /// web/src/app/(dashboard)/mesajlar sayfasındaki özet kartlar — istemcide
  /// zaten çekilen `_conversations` kümesinden türetilir, ek uç gerekmez.
  Widget _buildSummary() {
    final cs = context.colors;
    final unreadConversations = _conversations
        .where((c) => c.unreadCount > 0)
        .length;
    final totalUnread = _conversations.fold(0, (s, c) => s + c.unreadCount);
    final todayStart = DateTime.now();
    final startOfDay = DateTime(
      todayStart.year,
      todayStart.month,
      todayStart.day,
    );
    final activeToday = _conversations
        .where((c) => DateTime.parse(c.updatedAt).isAfter(startOfDay))
        .length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: StatCardGrid(
        crossAxisCount: 3,
        children: [
          AppStatCard(
            label: 'Toplam Konuşma',
            value: '${_conversations.length}',
            icon: Icons.forum_outlined,
          ),
          AppStatCard(
            label: 'Okunmamış',
            value: '$totalUnread',
            icon: Icons.mark_chat_unread_outlined,
            iconColor: cs.danger500,
            iconBackground: cs.danger50,
            caption: unreadConversations > 0
                ? '$unreadConversations konuşmada'
                : null,
          ),
          AppStatCard(
            label: 'Bugün Aktif',
            value: '$activeToday',
            icon: Icons.today_rounded,
            iconColor: cs.info600,
            iconBackground: cs.info50,
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
      color: cs.accentSoft,
      child: ListView.separated(
        itemCount: _conversations.length + 1,
        separatorBuilder: (_, i) =>
            i == 0 ? const SizedBox.shrink() : const Divider(height: 1),
        itemBuilder: (context, index) {
          if (index == 0) return _buildSummary();
          final i = index - 1;
          final c = _conversations[i];
          final unread = c.unreadCount > 0;
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: cs.primary100,
              child: Text(
                c.participant.fullName.isNotEmpty
                    ? c.participant.fullName[0].toUpperCase()
                    : '?',
                style: TextStyle(
                  color: cs.primary700,
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
                color: unread ? cs.textPrimary : cs.textSecondary,
                fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _timeFormat.format(DateTime.parse(c.updatedAt)),
                  style: tx.label,
                ),
                if (unread) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: cs.primary600,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      '${c.unreadCount}',
                      style: tx.label.copyWith(color: Colors.white),
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
