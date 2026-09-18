class ConversationParticipant {
  final String id;
  final String fullName;
  final String role;

  ConversationParticipant({
    required this.id,
    required this.fullName,
    required this.role,
  });

  factory ConversationParticipant.fromJson(Map<String, dynamic> json) =>
      ConversationParticipant(
        id: json['id'] as String,
        fullName: json['fullName'] as String,
        role: json['role'] as String,
      );
}

class MessageItem {
  final String id;
  final String conversationId;
  final String senderId;
  final String content;

  /// Saha fotografi eki var mi (goreli disk yolu; istemci fileUrl('message-attachment', id) kullanir).
  final String? attachmentUrl;
  final String? readAt;
  final String createdAt;

  MessageItem({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.content,
    this.attachmentUrl,
    required this.readAt,
    required this.createdAt,
  });

  factory MessageItem.fromJson(Map<String, dynamic> json) => MessageItem(
    id: json['id'] as String,
    conversationId: json['conversationId'] as String,
    senderId: json['senderId'] as String,
    content: json['content'] as String,
    attachmentUrl: json['attachmentUrl'] as String?,
    readAt: json['readAt'] as String?,
    createdAt: json['createdAt'] as String,
  );
}

class ConversationSummary {
  final String id;
  final ConversationParticipant participant;
  final MessageItem? lastMessage;
  final int unreadCount;
  final String updatedAt;

  ConversationSummary({
    required this.id,
    required this.participant,
    required this.lastMessage,
    required this.unreadCount,
    required this.updatedAt,
  });

  factory ConversationSummary.fromJson(Map<String, dynamic> json) =>
      ConversationSummary(
        id: json['id'] as String,
        participant: ConversationParticipant.fromJson(
          json['participant'] as Map<String, dynamic>,
        ),
        lastMessage: json['lastMessage'] != null
            ? MessageItem.fromJson(json['lastMessage'] as Map<String, dynamic>)
            : null,
        unreadCount: json['unreadCount'] as int,
        updatedAt: json['updatedAt'] as String,
      );
}

/// backend/src/controllers/conversationsController.ts:listAllConversations —
/// GET /conversations/all, yalnızca OWNER. `ConversationSummary`'den farklı:
/// tek bir "karşı taraf" yok, iki katılımcı da (`participantA`/`participantB`)
/// dönüyor çünkü OWNER bunların hiçbirine ait olmayabilir (gözlemci).
class AllConversationSummary {
  final String id;
  final ConversationParticipant participantA;
  final ConversationParticipant participantB;
  final MessageItem? lastMessage;
  final int messageCount;
  final String updatedAt;

  AllConversationSummary({
    required this.id,
    required this.participantA,
    required this.participantB,
    required this.lastMessage,
    required this.messageCount,
    required this.updatedAt,
  });

  factory AllConversationSummary.fromJson(Map<String, dynamic> json) =>
      AllConversationSummary(
        id: json['id'] as String,
        participantA: ConversationParticipant.fromJson(
          json['participantA'] as Map<String, dynamic>,
        ),
        participantB: ConversationParticipant.fromJson(
          json['participantB'] as Map<String, dynamic>,
        ),
        lastMessage: json['lastMessage'] != null
            ? MessageItem.fromJson(json['lastMessage'] as Map<String, dynamic>)
            : null,
        messageCount: (json['messageCount'] as num?)?.toInt() ?? 0,
        updatedAt: json['updatedAt'] as String,
      );
}

class AvailableContact {
  final String id;
  final String fullName;
  final String email;
  final String role;

  AvailableContact({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
  });

  factory AvailableContact.fromJson(Map<String, dynamic> json) =>
      AvailableContact(
        id: json['id'] as String,
        fullName: json['fullName'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
      );
}
