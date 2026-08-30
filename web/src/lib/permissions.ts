export const PERMISSION_LABELS: Record<string, string> = {
  view_finance: "Finansal verileri görebilir",
  delete_customers: "Müşteri silebilir",
  view_all_jobs: "Tüm işleri görebilir",
  manage_contracts: "Sözleşmeleri yönetebilir",
  manage_staff: "Personeli yönetebilir",
  approve_advances: "Avans taleplerini onaylayabilir",
  edit_prices: "İş fiyatlarını düzenleyebilir",
  export_reports: "Raporları dışa aktarabilir",
};

export interface PermissionEntry {
  key: string;
  value: boolean;
}
