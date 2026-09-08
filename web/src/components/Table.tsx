"use client";

import type { ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
  /** Mark this column as the row's identity column to auto-render an avatar badge before its content. */
  isPrimary?: boolean;
  /** Value used to derive avatar initials for the primary column. Defaults to the rendered text. */
  avatarLabel?: (row: T) => string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  /** Tablonun üstünde, arama kutusunun sağında gösterilecek ek içerik (filtre çipleri vb.). */
  toolbar?: ReactNode;
  /** Zebra düzenini kapatır (satırların kendi renk kodu varsa). */
  zebra?: boolean;
}

function Avatar({ label }: { label: string }) {
  const initials = label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
      {initials || "?"}
    </span>
  );
}

export function Table<T>({
  columns,
  data,
  keyField,
  onRowClick,
  loading,
  emptyState,
  search,
  onSearchChange,
  searchPlaceholder = "Ara...",
  page,
  totalPages,
  onPageChange,
  toolbar,
  zebra = true,
}: TableProps<T>) {
  return (
    <div className="flex flex-col gap-4">
      {(onSearchChange || toolbar) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {onSearchChange && (
            <div className="flex w-full max-w-sm items-center gap-2.5 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm text-text-secondary transition focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20">
              <Search size={16} strokeWidth={1.75} className="shrink-0 text-text-faint" />
              <input
                type="text"
                value={search ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-text-primary outline-none placeholder:text-text-faint"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-2xs font-semibold uppercase tracking-wide text-text-faint">
                {columns.map((col) => (
                  <th key={col.header} className={`whitespace-nowrap px-6 py-3.5 font-semibold ${col.className ?? ""}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-text-faint">
                    Yükleniyor...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>{emptyState}</td>
                </tr>
              ) : (
                data.map((row, i) => (
                  <tr
                    key={keyField(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-border/70 transition-colors last:border-0 hover:bg-primary-50/60 ${
                      zebra && i % 2 === 1 ? "bg-surface-subtle/50" : ""
                    } ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    {columns.map((col) => (
                      <td key={col.header} className={`px-6 py-4 text-text-secondary ${col.className ?? ""}`}>
                        {col.isPrimary ? (
                          <div className="flex items-center gap-3 font-medium text-text-primary">
                            <Avatar label={col.avatarLabel ? col.avatarLabel(row) : String(col.accessor(row) ?? "")} />
                            {col.accessor(row)}
                          </div>
                        ) : (
                          col.accessor(row)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {onPageChange && totalPages !== undefined && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-text-secondary">
          <button
            type="button"
            disabled={(page ?? 1) <= 1}
            onClick={() => onPageChange((page ?? 1) - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface-base transition hover:border-border-strong hover:bg-surface-subtle disabled:opacity-40"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <span className="font-mono text-xs text-text-faint">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={(page ?? 1) >= totalPages}
            onClick={() => onPageChange((page ?? 1) + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface-base transition hover:border-border-strong hover:bg-surface-subtle disabled:opacity-40"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}
