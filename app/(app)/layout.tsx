import { BottomNav } from "@/components/ui/BottomNav";
import { Sidebar } from "@/components/app/Sidebar";
import { MobileTopBar } from "@/components/app/MobileTopBar";
import { Toaster } from "@/components/ui/Toast";

/**
 * App shell. Desktop: a left sidebar rail with a wide content area. Mobile: a
 * single column with the fixed bottom nav. Same screens, two layouts.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lg:flex">
      <Sidebar />
      <main className="min-h-dvh w-full min-w-0 flex-1 pb-24 lg:pb-10">
        <MobileTopBar />
        {children}
      </main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
