"use client";

import { useEffect, useState } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Crown, Users, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/auth";
import type { OrgChartNode, OrgChartResponse } from "@/lib/types";

const ROLE_TONES: Record<Role, string> = {
  OWNER: "border-warning-200 bg-warning-50 text-warning-700",
  MANAGER: "border-primary-200 bg-primary-50 text-primary-700",
  TEAM_LEAD: "border-info-200 bg-info-50 text-info-700",
  STAFF: "border-border bg-surface-base text-text-secondary",
  CUSTOMER: "border-border bg-surface-base text-text-secondary",
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

interface OrgChartViewProps {
  /** Bir Staff kaydına (STAFF/TEAM_LEAD) tıklanınca çağrılır — MANAGER/OWNER
   * kutuları için çağrılmaz (onların gerçek bir Staff kaydı yok). */
  onSelectStaff: (staffId: string) => void;
}

export function OrgChartView({ onSelectStaff }: OrgChartViewProps) {
  const [data, setData] = useState<OrgChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<OrgChartResponse>("/staff/org-chart")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Organizasyon şeması yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingBlock rows={4} className="py-6" />;
  if (error) return <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>;
  if (!data || data.tree.length === 0) {
    return <EmptyState icon={Crown} title="Organizasyon şeması boş" description="Henüz bir işletme sahibi hesabı tanımlı değil." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface-card p-8 shadow-card">
        <div className="org-tree flex justify-center">
          <ul>
            {data.tree.map((node) => (
              <TreeNode key={node.id} node={node} onSelectStaff={onSelectStaff} />
            ))}
          </ul>
        </div>
      </div>

      {data.unassigned.length > 0 && (
        <div className="rounded-2xl border border-warning-100 bg-warning-50 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-warning-700">
            <AlertTriangle size={16} strokeWidth={1.75} />
            Şefi Tanımlı Olmayan / Bağlantısız Personel ({data.unassigned.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {data.unassigned.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => (n.role === "STAFF" || n.role === "TEAM_LEAD") && onSelectStaff(n.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 ${ROLE_TONES[n.role]}`}
              >
                {n.fullName} · {ROLE_LABELS[n.role]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, onSelectStaff }: { node: OrgChartNode; onSelectStaff: (staffId: string) => void }) {
  const isStaffRecord = node.role === "STAFF" || node.role === "TEAM_LEAD";
  return (
    <li>
      <div className="inline-flex flex-col items-center">
        <button
          type="button"
          disabled={!isStaffRecord}
          onClick={() => isStaffRecord && onSelectStaff(node.id)}
          className={`flex w-44 flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-center shadow-card transition ${ROLE_TONES[node.role]} ${
            isStaffRecord ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-pop" : "cursor-default"
          }`}
        >
          {node.role === "OWNER" ? (
            <Crown size={22} strokeWidth={1.75} className="text-warning-600" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-card/70 text-xs font-semibold">
              {initials(node.fullName)}
            </span>
          )}
          <span className="truncate text-sm font-semibold text-text-primary">{node.fullName}</span>
          <span className="text-2xs font-medium uppercase tracking-wide opacity-80">
            {ROLE_LABELS[node.role]}
            {node.position ? ` · ${node.position}` : ""}
          </span>
          {node.assignedCustomers.length > 0 && (
            <span className="mt-0.5 flex items-center gap-1 rounded-full bg-surface-card/60 px-2 py-0.5 text-2xs font-semibold text-text-secondary">
              <Users size={10} strokeWidth={2} />
              {node.assignedCustomers.length} müşteri
            </span>
          )}
        </button>
      </div>

      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} onSelectStaff={onSelectStaff} />
          ))}
        </ul>
      )}
    </li>
  );
}
