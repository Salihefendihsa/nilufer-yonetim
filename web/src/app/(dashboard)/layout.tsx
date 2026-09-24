"use client";

import { useState } from "react";
import { Sidebar, MobileSidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { PageTransition } from "@/components/PageTransition";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <ImpersonationBanner />
      {/* Bölüm AK (8. tur): sistem geneli duyuru şeridi */}
      <AnnouncementBanner />
      <div className="flex flex-1">
        <Sidebar />
        <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        {/* min-w-0: flex çocuğunun varsayılan min-width:auto'su, geniş bir
            torunun (tablo/grafik) tüm sütunu kendi genişliğine çekmesine ve
            360px'te sayfanın yatay taşmasına yol açıyordu; tablo
            sarmalayıcılarındaki overflow-x-auto bu sayede devreye girer. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </div>
  );
}
