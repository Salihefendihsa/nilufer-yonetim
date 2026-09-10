import '../../core/api_client.dart';
import '../../models/conversation.dart';
import '../../models/paginated.dart';

class MessagesApi {
  final _api = ApiClient.instance;

  Future<List<ConversationSummary>> listConversations() async {
    final json = await _api.get<Map<String, dynamic>>('/conversations');
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(ConversationSummary.fromJson)
        .toList();
  }

  /// backend/src/routes/conversations.ts: GET /all — yalnızca OWNER
  /// (gözlemci modu). Katılımcı olmasa bile OWNER her konuşmayı görebilir.
  Future<List<AllConversationSummary>> listAllConversations() async {
    final json = await _api.get<Map<String, dynamic>>('/conversations/all');
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(AllConversationSummary.fromJson)
        .toList();
  }

  Future<List<AvailableContact>> availableContacts() async {
    final json = await _api.get<Map<String, dynamic>>(
      '/conversations/available-contacts',
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(AvailableContact.fromJson)
        .toList();
  }

  Future<String> startConversation(String participantId) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/conversations',
      body: {'participantId': participantId},
    );
    return json['id'] as String;
  }

  Future<Paginated<MessageItem>> getMessages(
    String conversationId, {
    int page = 1,
  }) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/conversations/$conversationId/messages',
      query: {'page': page, 'limit': 50},
    );
    return Paginated.fromJson(json, MessageItem.fromJson);
  }

  /// [attachmentBase64] verilirse mesaja saha fotografi eklenir; backend
  /// gorseli kaydedip goreli URL'i mesajla birlikte doner.
  Future<MessageItem> sendMessage(
    String conversationId,
    String content, {
    String? attachmentBase64,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/conversations/$conversationId/messages',
      body: {
        'content': content,
        if (attachmentBase64 != null && attachmentBase64.isNotEmpty)
          'attachmentBase64': attachmentBase64,
      },
    );
    return MessageItem.fromJson(json);
  }

  Future<void> markRead(String conversationId) =>
      _api.patch('/conversations/$conversationId/read');

  /// Sefin dogrudan ekibinin tamamina ayni mesaji gonderir
  /// (POST /conversations/broadcast). Alici sayisini doner.
  Future<int> broadcastToTeam(String content) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/conversations/broadcast',
      body: {'content': content},
    );
    return (json['recipientCount'] as num?)?.toInt() ?? 0;
  }
}
