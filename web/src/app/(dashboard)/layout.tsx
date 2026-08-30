import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { PageTransition } from "@/components/PageTransition";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface-page">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 px-10 py-10">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
