"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Send, MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { ROLE_LABELS, type Role } from "@/lib/auth";
import type { ConversationSummary, MessageItem, Paginated, AvailableContact } from "@/lib/types";
import { NewConversationModal } from "./NewConversationModal";

const POLL_INTERVAL_MS = 5000;

function formatBubbleTime(value: string): string {
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get<{ data: ConversationSummary[] }>("/conversations");
      setConversations(res.data);
      return res.data;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konuşmalar yüklenemedi");
      return [];
    }
  }, []);

  useEffect(() => {
    setLoadingConversations(true);
    loadConversations().then((data) => {
      setLoadingConversations(false);
      if (data.length > 0) setSelectedId((current) => current ?? data[0].id);
    });
  }, [loadConversations]);

  const loadMessages = useCallback(
    async (conversationId: string, { showSpinner = false } = {}) => {
      if (showSpinner) setLoadingMessages(true);
      try {
        const res = await api.get<Paginated<MessageItem>>(`/conversations/${conversationId}/messages?limit=100`);
        setMessages(res.data);
        await api.patch(`/conversations/${conversationId}/read`);
        loadConversations();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Mesajlar yüklenemedi");
      } finally {
        if (showSpinner) setLoadingMessages(false);
      }
    },
    [loadConversations]
  );

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedId, { showSpinner: true });

    const interval = setInterval(() => loadMessages(selectedId), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    try {
      await api.post(`/conversations/${selectedId}/messages`, { content: draft.trim() });
      setDraft("");
      await loadMessages(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Mesaj gönderilemedi");
    } finally {
      setSending(false);
    }
  }

  async function handleSelectContact(contact: AvailableContact) {
    try {
      const conversation = await api.post<{ id: string }>("/conversations", { participantId: contact.id });
      setNewConversationOpen(false);
      await loadConversations();
      setSelectedId(conversation.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konuşma başlatılamadı");
    }
  }

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Mesajlar</h1>
          <p className="mt-1 text-sm text-text-secondary">Ekibiniz ve müşterilerinizle buradan iletişim kurun.</p>
        </div>
        <button
          type="button"
          onClick={() => setNewConversationOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)]"
        >
          <Plus size={16} strokeWidth={2} />
          Yeni Konuşma
        </button>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <div className="flex flex-1 overflow-hidden rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
        <div className="flex w-full max-w-xs flex-col border-r border-white/5">
          <div className="overflow-y-auto">
            {loadingConversations ? (
              <p className="p-6 text-center text-sm text-text-faint">Yükleniyor...</p>
            ) : conversations.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={MessageCircle} title="Henüz konuşma yok" description="Yeni bir konuşma başlatın." />
              </div>
            ) : (
              <ul className="flex flex-col">
                {conversations.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={`flex w-full items-center gap-3 border-b border-l-2 border-b-white/5 px-4 py-3.5 text-left transition ${
                          active ? "border-l-primary-gold bg-primary-green/5" : "border-l-transparent hover:bg-white/[0.02]"
                        }`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-green text-xs font-semibold text-white">
                          {initials(c.participant.fullName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-text-primary">{c.participant.fullName}</span>
                            {c.unreadCount > 0 && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary-green" />
                            )}
                          </span>
                          <span className="block truncate text-xs text-text-secondary">
                            {c.lastMessage?.content ?? "Henüz mesaj yok"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          {!selectedConversation ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={MessageCircle} title="Bir konuşma seçin" description="Sol taraftan bir konuşma seçin veya yeni bir tane başlatın." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-green text-xs font-semibold text-white">
                  {initials(selectedConversation.participant.fullName)}
                </span>
                <div>
                  <p className="text-sm font-medium text-text-primary">{selectedConversation.participant.fullName}</p>
                  <p className="text-xs text-text-secondary">{ROLE_LABELS[selectedConversation.participant.role as Role] ?? selectedConversation.participant.role}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {loadingMessages ? (
                  <p className="py-8 text-center text-sm text-text-faint">Yükleniyor...</p>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-faint">Henüz mesaj yok. İlk mesajı gönderin.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {messages.map((m) => {
                      const isMine = m.senderId === user?.id;
                      return (
                        <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm sm:max-w-sm ${
                              isMine
                                ? "bg-gradient-to-br from-primary-green to-primary-green/90 text-white"
                                : "border border-white/10 bg-surface-card text-text-primary"
                            }`}
                          >
                            <p>{m.content}</p>
                            <p className={`mt-1 text-[10px] ${isMine ? "text-white/70" : "text-text-faint"}`}>
                              {formatBubbleTime(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="flex items-center gap-3 border-t border-white/5 px-6 py-4">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Bir mesaj yazın..."
                  className="flex-1 rounded-2xl bg-white/[0.04] px-4 py-2.5 text-sm text-text-primary outline-none transition focus:ring-2 focus:ring-primary-green/30"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  aria-label="Gönder"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-green text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  <Send size={16} strokeWidth={1.75} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <NewConversationModal
        open={newConversationOpen}
        onClose={() => setNewConversationOpen(false)}
        onSelect={handleSelectContact}
      />
    </div>
  );
}
