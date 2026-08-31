"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Send, MessageCircle, Eye } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { ROLE_LABELS, type Role } from "@/lib/auth";
import type { ConversationSummary, AllConversationSummary, MessageItem, Paginated, AvailableContact } from "@/lib/types";
import { NewConversationModal } from "./NewConversationModal";

type ViewMode = "mine" | "all";

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
  const isOwner = user?.role === "OWNER";
  const [mode, setMode] = useState<ViewMode>("mine");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [allConversations, setAllConversations] = useState<AllConversationSummary[]>([]);
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

  const loadAllConversations = useCallback(async () => {
    try {
      const res = await api.get<{ data: AllConversationSummary[] }>("/conversations/all");
      setAllConversations(res.data);
      return res.data;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konuşmalar yüklenemedi");
      return [];
    }
  }, []);

  useEffect(() => {
    setLoadingConversations(true);
    setSelectedId(null);
    setError(null);

    const load = mode === "mine" ? loadConversations : loadAllConversations;
    load().then((data) => {
      setLoadingConversations(false);
      if (data.length > 0) setSelectedId(data[0].id);
    });
  }, [mode, loadConversations, loadAllConversations]);

  // The selected conversation is "mine" if either it came from the "mine" list, or (in the
  // "all" list) the owner happens to actually be one of its two participants.
  const selectedAllConversation = allConversations.find((c) => c.id === selectedId) ?? null;
  const isObserving =
    mode === "all" && !!selectedAllConversation && selectedAllConversation.participantA.id !== user?.id && selectedAllConversation.participantB.id !== user?.id;

  const loadMessages = useCallback(
    async (conversationId: string, { showSpinner = false, markRead = true } = {}) => {
      if (showSpinner) setLoadingMessages(true);
      try {
        const res = await api.get<Paginated<MessageItem>>(`/conversations/${conversationId}/messages?limit=100`);
        setMessages(res.data);
        if (markRead) {
          await api.patch(`/conversations/${conversationId}/read`);
          loadConversations();
        }
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
    loadMessages(selectedId, { showSpinner: true, markRead: !isObserving });

    const interval = setInterval(() => loadMessages(selectedId, { markRead: !isObserving }), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedId, isObserving, loadMessages]);

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

  const selectedConversation = mode === "mine" ? conversations.find((c) => c.id === selectedId) ?? null : null;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Mesajlar</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {mode === "mine" ? "Ekibiniz ve müşterilerinizle buradan iletişim kurun." : "Sistemdeki tüm konuşmaları gözlemci olarak izleyin."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isOwner && (
            <div className="flex gap-1.5 rounded-2xl bg-surface-card p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
              <button
                type="button"
                onClick={() => setMode("mine")}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  mode === "mine" ? "bg-primary-green text-white" : "text-text-secondary hover:bg-white/5"
                }`}
              >
                Konuşmalarım
              </button>
              <button
                type="button"
                onClick={() => setMode("all")}
                className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  mode === "all" ? "bg-primary-green text-white" : "text-text-secondary hover:bg-white/5"
                }`}
              >
                <Eye size={14} strokeWidth={1.75} />
                Tüm Konuşmalar (Gözlemci)
              </button>
            </div>
          )}
          {mode === "mine" && (
            <button
              type="button"
              onClick={() => setNewConversationOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)]"
            >
              <Plus size={16} strokeWidth={2} />
              Yeni Konuşma
            </button>
          )}
        </div>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <div className="flex flex-1 overflow-hidden rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
        <div className="flex w-full max-w-xs flex-col border-r border-white/5">
          <div className="overflow-y-auto">
            {loadingConversations ? (
              <p className="p-6 text-center text-sm text-text-faint">Yükleniyor...</p>
            ) : mode === "mine" ? (
              conversations.length === 0 ? (
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
              )
            ) : allConversations.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={Eye} title="Henüz konuşma yok" description="Sistemde henüz hiç konuşma başlatılmamış." />
              </div>
            ) : (
              <ul className="flex flex-col">
                {allConversations.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={`flex w-full flex-col gap-1 border-b border-l-2 border-b-white/5 px-4 py-3.5 text-left transition ${
                          active ? "border-l-primary-gold bg-primary-green/5" : "border-l-transparent hover:bg-white/[0.02]"
                        }`}
                      >
                        <span className="truncate text-sm font-medium text-text-primary">
                          {c.participantA.fullName} ({ROLE_LABELS[c.participantA.role as Role] ?? c.participantA.role}) ↔{" "}
                          {c.participantB.fullName} ({ROLE_LABELS[c.participantB.role as Role] ?? c.participantB.role})
                        </span>
                        <span className="flex items-center justify-between gap-2 text-xs text-text-secondary">
                          <span className="truncate">{c.lastMessage?.content ?? "Henüz mesaj yok"}</span>
                          <span className="shrink-0 font-mono text-text-faint">{c.messageCount}</span>
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
          {!selectedId || (mode === "mine" && !selectedConversation) || (mode === "all" && !selectedAllConversation) ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={MessageCircle} title="Bir konuşma seçin" description="Sol taraftan bir konuşma seçin veya yeni bir tane başlatın." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
                {mode === "mine" && selectedConversation ? (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-green text-xs font-semibold text-white">
                      {initials(selectedConversation.participant.fullName)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{selectedConversation.participant.fullName}</p>
                      <p className="text-xs text-text-secondary">{ROLE_LABELS[selectedConversation.participant.role as Role] ?? selectedConversation.participant.role}</p>
                    </div>
                  </>
                ) : selectedAllConversation ? (
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {selectedAllConversation.participantA.fullName} ↔ {selectedAllConversation.participantB.fullName}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {ROLE_LABELS[selectedAllConversation.participantA.role as Role] ?? selectedAllConversation.participantA.role} ↔{" "}
                      {ROLE_LABELS[selectedAllConversation.participantB.role as Role] ?? selectedAllConversation.participantB.role}
                    </p>
                  </div>
                ) : null}
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

              {isObserving ? (
                <div className="border-t border-white/5 px-6 py-4">
                  <p className="rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
                    👁️ Gözlemci modundasınız — bu konuşmaya mesaj gönderemezsiniz.
                  </p>
                </div>
              ) : (
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
              )}
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
