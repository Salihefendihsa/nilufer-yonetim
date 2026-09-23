import { describe, expect, it } from "vitest";
import { auditActionLabel, humanizeAuditDetail } from "../src/lib/auditLabels";

const A = "1cf49e89-efbb-46a7-bf6e-5d5b44ee6adf";
const B = "29a7bbfa-ba15-47aa-b8bf-e9dc6466bc3a";
const names = new Map([
  [A, "Bursa Cafe & Restoran"],
  [B, "Ali Kaya"],
]);

describe("Denetim logu Türkçeleştirme", () => {
  it("bilinen action kodları Türkçe cümleye, bilinmeyenler okunur yedeğe çevrilir", () => {
    expect(auditActionLabel("contract.create")).toBe("Sözleşme oluşturuldu");
    expect(auditActionLabel("staff.update")).toBe("Personel bilgileri güncellendi");
    expect(auditActionLabel("some_new.thing")).toBe("Some new thing");
  });

  it("anahtar=değer detayındaki UUID gerçek ada çevrilir", () => {
    expect(humanizeAuditDetail(`customerId=${A}, amount=1200`, names)).toBe(
      "Müşteri: Bursa Cafe & Restoran · Tutar: ₺1.200"
    );
  });

  it("JSON detayı Türkçe alan/değer etiketleriyle yazılır", () => {
    expect(humanizeAuditDetail('{"status":"CONTACTED"}', names)).toBe("Durum: İletişime Geçildi");
    expect(humanizeAuditDetail(`{"supervisorId":"${B}"}`, names)).toBe("Şef: Ali Kaya");
    expect(humanizeAuditDetail('{"view_finance":true}', names)).toBe("Finansal verileri görebilir: Evet");
  });

  it("durum geçişleri ve yeniden atama okçukla gösterilir", () => {
    expect(humanizeAuditDetail("SCHEDULED -> IN_PROGRESS", names)).toBe("Planlandı → Devam Ediyor");
    expect(humanizeAuditDetail(`null -> ${B}`, names)).toBe("Atanmamış → Ali Kaya");
  });

  it("serbest metindeki enum kodları ve çözülemeyen UUID'ler", () => {
    expect(humanizeAuditDetail("FUEL — 300.00 ₺", names)).toBe("Yakıt — 300.00 ₺");
    expect(humanizeAuditDetail("Dönem: e60d32ed-6d29-4558-8af7-3e6ed3bbdc50", names)).toBe("Dönem: (silinmiş kayıt)");
    expect(humanizeAuditDetail(`${A} -> ${B} (12 ay)`, names)).toBe("Yeni dönem: 12 ay");
  });
});
