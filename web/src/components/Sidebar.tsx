"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bug,
  Home,
  Users,
  HardHat,
  Wrench,
  FileText,
  FileSignature,
  Wallet,
  Settings,
  MessageCircle,
  ClipboardCheck,
  Activity,
  ScrollText,
  LogOut,
  Boxes,
  Trophy,
  Calendar,
  Bell,
  BarChart3,
  Timer,
  CalendarOff,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { ROLE_LABELS, ROLE_SHORT_LABELS, type Role } from "@/lib/auth";

/** Tüm menü ikonları tek boyut/kalınlıkta — ölçü sapması olmasın diye sabit. */
const ICON_SIZE = 18;
const ICON_STROKE = 1.75;

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  roles: Role[];
  /** Menüyü mantıksal bloklara ayırır; blok değişince ince bir ayraç çizilir. */
  group: "genel" | "operasyon" | "finans" | "yonetim";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Ana Sayfa", icon: Home, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"], group: "genel" },
  { href: "/takvim", label: "Takvim", icon: Calendar, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"], group: "genel" },
  { href: "/bildirimler", label: "Bildirimler", icon: Bell, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"], group: "genel" },
  { href: "/mesajlar", label: "Mesajlar", icon: MessageCircle, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"], group: "genel" },
  { href: "/bekleyen-onaylar", label: "Bekleyen Onaylar", icon: ClipboardCheck, roles: ["OWNER", "MANAGER", "TEAM_LEAD"], group: "operasyon" },
  { href: "/izinlerim", label: "İzin Taleplerim", icon: CalendarOff, roles: ["TEAM_LEAD", "STAFF"], group: "operasyon" },
  { href: "/musteriler", label: "Müşteriler", icon: Users, roles: ["OWNER", "MANAGER"], group: "operasyon" },
  { href: "/personel", label: "Personel", icon: HardHat, roles: ["OWNER", "MANAGER"], group: "operasyon" },
  { href: "/performans", label: "Performans", icon: Trophy, roles: ["OWNER", "MANAGER", "TEAM_LEAD"], group: "operasyon" },
  { href: "/stok", label: "Stok", icon: Boxes, roles: ["OWNER", "MANAGER", "TEAM_LEAD"], group: "operasyon" },
  { href: "/isler", label: "İşler", icon: Wrench, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"], group: "operasyon" },
  { href: "/sozlesmeler", label: "Sözleşmeler", icon: FileSignature, roles: ["OWNER", "MANAGER"], group: "finans" },
  { href: "/teklifler", label: "Teklifler", icon: FileText, roles: ["OWNER", "MANAGER"], group: "finans" },
  { href: "/para", label: "Para", icon: Wallet, roles: ["OWNER", "MANAGER"], group: "finans" },
  { href: "/raporlar", label: "Raporlar", icon: BarChart3, roles: ["OWNER", "MANAGER"], group: "finans" },
  { href: "/loglar", label: "Denetim Logları", icon: ScrollText, roles: ["OWNER"], group: "yonetim" },
  { href: "/sistem-durumu", label: "Sistem Durumu", icon: Activity, roles: ["OWNER"], group: "yonetim" },
  { href: "/kullanim-istatistikleri", label: "Kullanım İstatistikleri", icon: Timer, roles: ["OWNER"], group: "yonetim" },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"], group: "yonetim" },
];

interface SidebarNavProps {
  /** Bir menü öğesine tıklanınca çağrılır — mobil drawer'ı kapatmak için kullanılır. */
  onNavigate?: () => void;
}

/**
 * Menünün gerçek içeriği: marka başlığı + nav listesi + profil kartı.
 * Masaüstünde sabit `<aside>` içinde, mobilde `MobileSidebar` drawer'ının
 * içinde render edilir — ikisi de aynı listeyi, aynı rol filtresini paylaşır.
 */
function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = user?.role ?? "CUSTOMER";

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <>
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-card">
          <Bug size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">Nilüfer İlaçlama</p>
          {user && <p className="text-xs text-text-faint">{ROLE_SHORT_LABELS[user.role]} Paneli</p>}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-2">
        {items.map((item, i) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          const startsGroup = i > 0 && items[i - 1].group !== item.group;

          return (
            <div key={item.href} className={startsGroup ? "mt-2 border-t border-border pt-2" : undefined}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-primary-50 font-semibold text-primary-700 ring-1 ring-primary-100"
                    : "font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-600" />
                )}
                <Icon
                  size={ICON_SIZE}
                  strokeWidth={ICON_STROKE}
                  className={`shrink-0 ${active ? "text-primary-600" : "text-text-faint"}`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      {user && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface-subtle p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
            {user.fullName[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{user.fullName}</p>
            <span className="mt-0.5 inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-2xs font-semibold text-primary-700">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <button
            type="button"
            aria-label="Çıkış yap"
            onClick={logout}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-faint transition hover:bg-danger-50 hover:text-danger-500"
          >
            <LogOut size={16} strokeWidth={ICON_STROKE} />
          </button>
        </div>
      )}
    </>
  );
}

/** Masaüstü: her zaman görünen sabit panel (md ve üstü). */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface-sidebar px-4 py-6 md:flex">
      <SidebarNav />
    </aside>
  );
}

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Mobil (< md): soldan kayan drawer. NotificationDrawer.tsx ile aynı desen —
 * createPortal + framer-motion + aynı backdrop tonu. Rota değişince (nav
 * içindeki bir linke tıklanınca) otomatik kapanır.
 */
export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
    // Yalnızca rota değiştiğinde kapat — onClose referansı her render'da
    // yenilenebileceği için bağımlılığa alınmıyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[2px] md:hidden"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed left-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-surface-sidebar px-4 py-6 shadow-pop md:hidden"
          >
            <SidebarNav onNavigate={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
