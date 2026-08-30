export const PERMISSION_KEYS = [
  "view_finance",
  "delete_customers",
  "view_all_jobs",
  "manage_contracts",
  "manage_staff",
  "approve_advances",
  "edit_prices",
  "export_reports",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_finance: "Finansal verileri görebilir",
  delete_customers: "Müşteri silebilir",
  view_all_jobs: "Tüm işleri görebilir",
  manage_contracts: "Sözleşmeleri yönetebilir",
  manage_staff: "Personeli yönetebilir",
  approve_advances: "Avans taleplerini onaylayabilir",
  edit_prices: "İş fiyatlarını düzenleyebilir",
  export_reports: "Raporları dışa aktarabilir",
};

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}
