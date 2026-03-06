import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { DashboardHydration } from "@/components/layout/DashboardHydration";
import { HydrationGuard } from "@/components/HydrationGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HydrationGuard>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Rehydrates Zustand stores from localStorage on mount */}
        <DashboardHydration />

        {/* Sidebar: fixed width, full height */}
        <Sidebar />

        {/* Main content area: fills remaining width */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </HydrationGuard>
  );
}
