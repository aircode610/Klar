import { BottomNav } from "@/components/ui/BottomNav";

/** Shell for the main app screens: content area with room for the bottom nav. */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      {children}
      <BottomNav />
    </div>
  );
}
