"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { ROLE_LABELS, ROLE_SHORT_LABELS, type Role } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Ana Sayfa", icon: Home, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"] },
  { href: "/takvim", label: "Takvim", icon: Calendar, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"] },
  { href: "/bildirimler", label: "Bildirimler", icon: Bell, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"] },
  { href: "/mesajlar", label: "Mesajlar", icon: MessageCircle, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"] },
  { href: "/bekleyen-onaylar", label: "Bekleyen Onaylar", icon: ClipboardCheck, roles: ["OWNER", "MANAGER"] },
  { href: "/musteriler", label: "Müşteriler", icon: Users, roles: ["OWNER", "MANAGER"] },
  { href: "/personel", label: "Personel", icon: HardHat, roles: ["OWNER", "MANAGER"] },
  { href: "/performans", label: "Performans", icon: Trophy, roles: ["OWNER", "MANAGER", "TEAM_LEAD"] },
  { href: "/stok", label: "Stok", icon: Boxes, roles: ["OWNER", "MANAGER"] },
  { href: "/isler", label: "İşler", icon: Wrench, roles: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"] },
  { href: "/sozlesmeler", label: "Sözleşmeler", icon: FileSignature, roles: ["OWNER", "MANAGER"] },
  { href: "/teklifler", label: "Teklifler", icon: FileText, roles: ["OWNER", "MANAGER"] },
  { href: "/para", label: "Para", icon: Wallet, roles: ["OWNER", "MANAGER"] },
  { href: "/raporlar", label: "Raporlar", icon: BarChart3, roles: ["OWNER", "MANAGER"] },
  { href: "/loglar", label: "Denetim Logları", icon: ScrollText, roles: ["OWNER"] },
  { href: "/sistem-durumu", label: "Sistem Durumu", icon: Activity, roles: ["OWNER"] },
  { href: "/kullanim-istatistikleri", label: "Kullanım İstatistikleri", icon: Timer, roles: ["OWNER"] },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings, roles: ["OWNER"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = user?.role ?? "CUSTOMER";

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-surface-sidebar px-5 py-8 md:flex">
      <div className="mb-8 border-b border-primary-gold/20 pb-6">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-green/20 text-primary-greenLight">
            <Bug size={18} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nilüfer İlaçlama</p>
            {user && <p className="text-xs text-text-faint">{ROLE_SHORT_LABELS[user.role]} Paneli</p>}
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl border-l-[3px] px-3 py-2.5 text-sm transition ${
                active
                  ? "border-primary-gold bg-primary-green/15 font-medium text-primary-gold"
                  : "border-transparent text-white/40 hover:bg-white/[0.04] hover:text-white/70"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} className={active ? "text-primary-gold" : "text-white/40"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-green/20 text-sm font-semibold text-primary-greenLight">
            {user.fullName[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.fullName}</p>
            <span className="inline-flex rounded-full border border-primary-gold/20 bg-primary-gold/10 px-2 py-0.5 text-[10px] font-semibold text-primary-gold">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <button
            type="button"
            aria-label="Çıkış yap"
            onClick={logout}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-white/40 transition hover:bg-primary-redLight/10 hover:text-primary-redLight"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </aside>
  );
}
