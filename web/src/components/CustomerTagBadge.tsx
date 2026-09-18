"use client";

import type { CustomerTag } from "@/lib/types";

/** Bölüm X (6. tur): renkli müşteri etiketi rozeti — hex rengi zeminde soluk, metinde tam. */
export function CustomerTagBadge({ tag, size = "sm" }: { tag: Pick<CustomerTag, "name" | "color">; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ${size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs"}`}
      style={{ backgroundColor: `${tag.color}1F`, color: tag.color, boxShadow: `inset 0 0 0 1px ${tag.color}55` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  );
}
