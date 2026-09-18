"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, MailOpen, Megaphone, MessageCircle, Plus, Send, Users2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { DayDivider, MessageBubble } from "@/components/MessageBubble";
import { api, ApiError, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { ROLE_LABELS, type Role } from "@/lib/auth";
import type { ConversationSummary, AllConversationSummary, MessageItem, Paginated, AvailableContact, ObserverAccessGrant } from "@/lib/types";
import { NewConversationModal } from "./NewConversationModal";
import { BroadcastModal } from "./BroadcastModal";
import { ObserverAccessModal } from "./ObserverAccessModal";

type ViewMode = "mine" | "all";

const POLL_INTERVAL_MS = 5000;

function formatBubbleTime(value: string): string {
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

/** Konuşma listesinde son mesaj zamanı: bugünse saat, değilse kısa tarih. */
function formatListTime(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  return sameDay
    ? date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function dayLabel(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDate = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  if (sameDate(date, today)) return "Bugün";
  if (sameDate(date, yesterday)) return "Dün";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function dayKey(value: string): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
  // Toplu duyuru, doğrudan ekibi olan roller içindir (backend: /conversations/broadcast
  // OWNER/MANAGER/TEAM_LEAD; ekibi yoksa 400 döner).
  const canBroadcast =
    user?.role === "TEAM_LEAD" || user?.role === "OWNER" || user?.role === "MANAGER";
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
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [observerGrant, setObserverGrant] = useState<ObserverAccessGrant | null>(null);
  const [observerModalOpen, setObserverModalOpen] = useState(false);
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
      if (err instanceof ApiError && err.status === 403) {
        // Grant süresi tam bu sırada dolmuş olabilir — sessizce tekrar talep formuna düş.
        setObserverGrant(null);
        setObserverModalOpen(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Konuşmalar yüklenemedi");
      }
      return [];
    }
  }, []);

  async function handleOpenObserverMode() {
    try {
      const res = await api.get<{ data: ObserverAccessGrant | null }>("/observer-access/current");
      if (res.data) {
        setObserverGrant(res.data);
        setMode("all");
      } else {
        setObserverModalOpen(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gözlemci erişimi kontrol edilemedi");
    }
  }

  function handleObserverGranted(grant: ObserverAccessGrant) {
    setObserverGrant(grant);
    setObserverModalOpen(false);
    setMode("all");
  }

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

  // Gözlemci modunda kendi konuşmalarının okunmamış sayısı da lazım olduğu için,
  // "tüm konuşmalar" görünümündeyken de kendi listemizi bir kez çekiyoruz.
  useEffect(() => {
    if (mode === "all") loadConversations();
  }, [mode, loadConversations]);

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

  // Özet kartlar her iki modda da kendi konuşma listesinden hesaplanır.
  const stats = useMemo(() => {
    const unreadMessages = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    const unreadThreads = conversations.filter((c) => c.unreadCount > 0).length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeThreads = conversations.filter((c) => new Date(c.updatedAt).getTime() >= weekAgo).length;
    return { unreadMessages, unreadThreads, activeThreads, total: conversations.length };
  }, [conversations]);

  /** Mesajları gün ayraçlarıyla birlikte tek bir listeye düzler. */
  const timeline = useMemo(() => {
    const out: ({ kind: "day"; key: string; label: string } | { kind: "msg"; key: string; message: MessageItem })[] = [];
    let lastDay = "";
    for (const message of messages) {
      const key = dayKey(message.createdAt);
      if (key !== lastDay) {
        out.push({ kind: "day", key: `day-${key}`, label: dayLabel(message.createdAt) });
        lastDay = key;
      }
      out.push({ kind: "msg", key: message.id, message });
    }
    return out;
  }, [messages]);

  /** Gözlemci modunda balonun kime ait olduğunu yazabilmek için katılımcı adları. */
  const observerNames = useMemo(() => {
    if (!selectedAllConversation) return {} as Record<string, string>;
    return {
      [selectedAllConversation.participantA.id]: selectedAllConversation.participantA.fullName,
      [selectedAllConversation.participantB.id]: selectedAllConversation.participantB.fullName,
    };
  }, [selectedAllConversation]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={MessageCircle}
        title="Mesajlar"
        description={
          mode === "mine"
            ? "Ekibiniz ve müşterilerinizle buradan iletişim kurun."
            : "Sistemdeki tüm konuşmaları gözlemci olarak izleyin."
        }
        actions={
          <>
            {canBroadcast && (
              <button
                type="button"
                onClick={() => setBroadcastOpen(true)}
                className="flex items-center gap-2 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
              >
                <Megaphone size={16} strokeWidth={1.75} />
                Ekibime Duyuru
              </button>
            )}
            {isOwner && (
              <div className="flex gap-1 rounded-2xl border border-border bg-surface-card p-1 shadow-card">
                <button
                  type="button"
                  onClick={() => setMode("mine")}
                  className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                    mode === "mine" ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-subtle"
                  }`}
                >
                  Konuşmalarım
                </button>
                <button
                  type="button"
                  onClick={handleOpenObserverMode}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                    mode === "all" ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-subtle"
                  }`}
                >
                  <Eye size={14} strokeWidth={1.75} />
                  Gözlemci
                </button>
              </div>
            )}
            {mode === "mine" && (
              <button
                type="button"
                onClick={() => setNewConversationOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
              >
                <Plus size={16} strokeWidth={2} />
                Yeni Konuşma
              </button>
            )}
          </>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {mode === "all" && observerGrant && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-600">
          <Eye size={15} strokeWidth={1.75} />
          <span className="font-medium">{observerGrant.isEmergency ? "Acil durum erişimi (sınırsız)" : "Gözlemci erişimi aktif"}</span>
          <span className="text-warning-600/80">— Gerekçe: {observerGrant.reason}</span>
          {observerGrant.expiresAt && (
            <span className="text-warning-600/80">
              · Bitiş: {new Date(observerGrant.expiresAt).toLocaleString("tr-TR")}
            </span>
          )}
        </p>
      )}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Toplam konuşma"
          value={loadingConversations ? "—" : String(mode === "all" ? allConversations.length : stats.total)}
          icon={MessageCircle}
          mono
          hint={mode === "all" ? "Sistemdeki tüm konuşmalar" : undefined}
        />
        <StatCard
          label="Okunmamış mesaj"
          value={loadingConversations ? "—" : String(stats.unreadMessages)}
          icon={MailOpen}
          accent="gold"
          mono
          badge={stats.unreadMessages > 0 ? { label: "Yeni", tone: "critical" } : undefined}
          hint={stats.unreadThreads > 0 ? `${stats.unreadThreads} konuşmada` : undefined}
        />
        <StatCard
          label="Son 7 günde aktif"
          value={loadingConversations ? "—" : String(stats.activeThreads)}
          icon={Users2}
          accent="blue"
          mono
          progress={stats.total > 0 ? (stats.activeThreads / stats.total) * 100 : 0}
        />
      </div>

      {/* [Sohbet paneli] */}
      <div className="flex h-[calc(100vh-24rem)] min-h-[460px] overflow-hidden rounded-2xl border border-border bg-surface-card shadow-card">
        <div className="flex w-full max-w-xs flex-col border-r border-border">
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
                          className={`flex w-full items-center gap-3 border-b border-l-2 border-b-border px-4 py-3.5 text-left transition ${
                            active ? "border-l-primary-600 bg-primary-50" : "border-l-transparent hover:bg-surface-subtle"
                          }`}
                        >
                          <span className="relative shrink-0">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
                              {initials(c.participant.fullName)}
                            </span>
                            {c.unreadCount > 0 && (
                              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface-card">
                                {c.unreadCount > 9 ? "9+" : c.unreadCount}
                              </span>
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span
                                className={`truncate text-sm ${c.unreadCount > 0 ? "font-semibold text-text-primary" : "font-medium text-text-primary"}`}
                              >
                                {c.participant.fullName}
                              </span>
                              {c.lastMessage && (
                                <span className="shrink-0 font-mono text-[10px] text-text-faint">
                                  {formatListTime(c.lastMessage.createdAt)}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5">
                              <span className="rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-text-faint">
                                {ROLE_LABELS[c.participant.role as Role] ?? c.participant.role}
                              </span>
                            </span>
                            <span
                              className={`mt-0.5 block truncate text-xs ${c.unreadCount > 0 ? "font-medium text-text-primary" : "text-text-secondary"}`}
                            >
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
                        className={`flex w-full flex-col gap-1.5 border-b border-l-2 border-b-border px-4 py-3.5 text-left transition ${
                          active ? "border-l-primary-600 bg-primary-50" : "border-l-transparent hover:bg-surface-subtle"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[9px] font-semibold text-primary-700">
                            {initials(c.participantA.fullName)}
                          </span>
                          <span className="text-text-faint">↔</span>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info-100 text-[9px] font-semibold text-info-600">
                            {initials(c.participantB.fullName)}
                          </span>
                          <span className="ml-auto shrink-0 rounded-full bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-text-faint">
                            {c.messageCount}
                          </span>
                        </span>
                        <span className="truncate text-sm font-medium text-text-primary">
                          {c.participantA.fullName} ↔ {c.participantB.fullName}
                        </span>
                        <span className="truncate text-xs text-text-secondary">
                          {c.lastMessage?.content ?? "Henüz mesaj yok"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col bg-surface-page/40">
          {!selectedId || (mode === "mine" && !selectedConversation) || (mode === "all" && !selectedAllConversation) ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={MessageCircle} title="Bir konuşma seçin" description="Sol taraftan bir konuşma seçin veya yeni bir tane başlatın." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border bg-surface-card px-6 py-3.5">
                {mode === "mine" && selectedConversation ? (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
                      {initials(selectedConversation.participant.fullName)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{selectedConversation.participant.fullName}</p>
                      <p className="text-xs text-text-secondary">
                        {ROLE_LABELS[selectedConversation.participant.role as Role] ?? selectedConversation.participant.role}
                      </p>
                    </div>
                  </>
                ) : selectedAllConversation ? (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-500 ring-1 ring-warning-100">
                      <Eye size={16} strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {selectedAllConversation.participantA.fullName} ↔ {selectedAllConversation.participantB.fullName}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {ROLE_LABELS[selectedAllConversation.participantA.role as Role] ?? selectedAllConversation.participantA.role} ↔{" "}
                        {ROLE_LABELS[selectedAllConversation.participantB.role as Role] ?? selectedAllConversation.participantB.role}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {loadingMessages ? (
                  <p className="py-8 text-center text-sm text-text-faint">Yükleniyor...</p>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-faint">Henüz mesaj yok. İlk mesajı gönderin.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {timeline.map((entry) =>
                      entry.kind === "day" ? (
                        <DayDivider key={entry.key} label={entry.label} />
                      ) : (
                        <MessageBubble
                          key={entry.key}
                          content={entry.message.content}
                          time={formatBubbleTime(entry.message.createdAt)}
                          // Gözlemci modunda "kendi mesajın" kavramı yok; sol/sağ ayrımı
                          // konuşmanın ilk katılımcısına göre yapılır ve ad üstte yazılır.
                          mine={
                            isObserving
                              ? entry.message.senderId === selectedAllConversation?.participantB.id
                              : entry.message.senderId === user?.id
                          }
                          read={!!entry.message.readAt}
                          senderName={isObserving ? observerNames[entry.message.senderId] : undefined}
                          attachmentUrl={entry.message.attachmentUrl ? fileUrl("message-attachment", entry.message.id) : null}
                        />
                      )
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {isObserving ? (
                <div className="border-t border-border bg-surface-card px-6 py-4">
                  <p className="flex items-center gap-2 rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-600">
                    <Eye size={15} strokeWidth={1.75} />
                    Gözlemci modundasınız — bu konuşmaya mesaj gönderemezsiniz.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex items-center gap-3 border-t border-border bg-surface-card px-6 py-4">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Bir mesaj yazın..."
                    className="input flex-1"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    aria-label="Gönder"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-card transition hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Send size={16} strokeWidth={1.75} />
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <BroadcastModal open={broadcastOpen} onClose={() => setBroadcastOpen(false)} onSent={loadConversations} />

      <NewConversationModal
        open={newConversationOpen}
        onClose={() => setNewConversationOpen(false)}
        onSelect={handleSelectContact}
      />

      <ObserverAccessModal
        open={observerModalOpen}
        onClose={() => setObserverModalOpen(false)}
        onGranted={handleObserverGranted}
      />
    </div>
  );
}
