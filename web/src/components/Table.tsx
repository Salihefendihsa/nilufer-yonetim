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
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-green text-xs font-semibold text-white">
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
}: TableProps<T>) {
  return (
    <div className="flex flex-col gap-4">
      {onSearchChange && (
        <div className="flex w-full max-w-sm items-center gap-2.5 rounded-2xl bg-white/[0.04] px-4 py-2.5 text-sm text-text-secondary transition focus-within:ring-2 focus-within:ring-primary-green/30">
          <Search size={16} strokeWidth={1.75} />
          <input
            type="text"
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent outline-none placeholder:text-text-faint"
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-text-faint">
                {columns.map((col) => (
                  <th key={col.header} className={`px-6 py-4 font-semibold ${col.className ?? ""}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-text-faint">
                    Yükleniyor...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>{emptyState}</td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={keyField(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.02] ${
                      onRowClick ? "cursor-pointer" : ""
                    }`}
                  >
                    {columns.map((col) => (
                      <td key={col.header} className={`px-6 py-5 ${col.className ?? ""}`}>
                        {col.isPrimary ? (
                          <div className="flex items-center gap-3">
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
            className="flex h-8 w-8 items-center justify-center rounded-2xl transition hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={(page ?? 1) >= totalPages}
            onClick={() => onPageChange((page ?? 1) + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-2xl transition hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}
