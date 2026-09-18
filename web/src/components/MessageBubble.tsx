"use client";

import { AuthImage } from "@/components/AuthImage";
import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  content: string;
  /** Saat:dakika biçimindeki gönderim zamanı. */
  time: string;
  /** true ise sağda yeşil balon, false ise solda açık gri balon. */
  mine: boolean;
  /** Karşı taraf mesajı okuduysa çift tik gösterilir (yalnızca kendi mesajlarında). */
  read?: boolean;
  /** Gözlemci modunda gönderenin adı balonun üstünde gösterilir. */
  senderName?: string;
  /** Saha fotoğrafı eki — kimlik doğrulamalı API yolu (api.fileUrl("message-attachment", id)). */
  attachmentUrl?: string | null;
}

/**
 * Tek mesaj balonu. Kendi mesajları sağda primary-500 zemin + beyaz metin,
 * karşı tarafınkiler solda surface-subtle zemin + kenarlık; her iki tarafta da
 * dış köşe yuvarlak, sohbet tarafındaki köşe sivri (klasik sohbet kuyruğu etkisi).
 */
export function MessageBubble({ content, time, mine, read, senderName, attachmentUrl }: MessageBubbleProps) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[75%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {senderName && <span className="mb-1 px-1 text-2xs font-semibold text-text-faint">{senderName}</span>}

        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-card ${
            mine
              ? "rounded-br-md bg-primary-500 text-white"
              : "rounded-bl-md border border-border bg-surface-subtle text-text-primary"
          }`}
        >
          {attachmentUrl && <AuthImage path={attachmentUrl} alt="Saha fotoğrafı" className="mb-2 max-h-64 w-full rounded-xl object-cover" />}
          <p className="whitespace-pre-wrap break-words">{content}</p>
          <span className={`mt-1 flex items-center justify-end gap-1 ${mine ? "text-white/70" : "text-text-faint"}`}>
            <span className="font-mono text-[10px]">{time}</span>
            {mine &&
              (read ? <CheckCheck size={12} strokeWidth={2} /> : <Check size={12} strokeWidth={2} />)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Sohbet akışında gün değişimini gösteren ortalanmış ayraç. */
export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-border" />
      <span className="rounded-full border border-border bg-surface-base px-3 py-0.5 text-2xs font-medium text-text-faint">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
