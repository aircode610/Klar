"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Globe,
  LogOut,
  Moon,
  ServerCog,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { LANG_LABEL } from "@/lib/i18n";
import * as api from "@/lib/api";
import { Screen, PageHeader } from "@/components/ui/Screen";
import { LangSwitcher } from "@/components/ui/LangSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ProfileVault } from "@/components/screens/me/ProfileVault";
import { toast } from "@/components/ui/Toast";

export default function MePage() {
  const router = useRouter();
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const letterIds = useAppStore((s) => s.letterIds);
  const user = useAppStore((s) => s.auth?.user);
  const signOut = useAppStore((s) => s.signOut);
  const [backend, setBackend] = useState<string | null>(null);

  const handleSignOut = async () => {
    await api.logout().catch(() => {});
    signOut();
    router.replace("/login");
  };

  useEffect(() => {
    api
      .health()
      .then((h) => setBackend(`${h.service} · ${h.model}`))
      .catch(() => setBackend("offline"));
  }, []);

  return (
    <Screen>
      <PageHeader eyebrow="Me" title="Your account" />

      {/* Account header */}
      <div className="mb-5 flex items-center gap-3.5">
        <div className="flex size-14 items-center justify-center rounded-full border border-line bg-surface-2 text-ink">
          <UserRound size={26} strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[1.05rem] font-semibold text-ink">
            {user?.email ?? "Guest"}
          </p>
          <p className="font-mono text-[0.7rem] text-ink-2">
            {letterIds.length} letters · {LANG_LABEL[lang]}
          </p>
        </div>
      </div>

      {/* Profile vault */}
      <div className="mb-5">
        <ProfileVault />
      </div>

      {/* Settings */}
      <section className="overflow-hidden rounded-(--radius-lg) border border-line bg-surface">
        <Row icon={Globe} label="Language">
          <LangSwitcher className="border-0 bg-transparent px-0" />
        </Row>
        <Row icon={Moon} label="Theme" sub={theme === "dark" ? "Dark" : "Light"}>
          <ThemeToggle />
        </Row>
        <Row icon={FileText} label="Letter history" sub={`${letterIds.length} total`}>
          <ChevronRight size={18} className="text-ink-2 rtl:rotate-180" aria-hidden />
        </Row>
        <Row icon={ServerCog} label="Backend" sub={backend ?? "checking…"}>
          <span
            className={`size-2 rounded-full ${
              backend && backend !== "offline" ? "bg-done" : "bg-ink-2"
            }`}
            aria-hidden
          />
        </Row>
        <Row icon={ShieldCheck} label="Privacy" sub="Minimal data, stored in the EU">
          <ChevronRight size={18} className="text-ink-2 rtl:rotate-180" aria-hidden />
        </Row>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-start text-ink hover:bg-ink/5"
        >
          <LogOut size={19} strokeWidth={1.75} className="text-ink-2 rtl:rotate-180" aria-hidden />
          <span className="text-[0.9rem] font-medium">Sign out</span>
        </button>
        <button
          onClick={() => {
            useAppStore.setState({ letters: {}, letterIds: [] });
            toast.info("Local letter cache cleared.");
          }}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-start text-overdue hover:bg-overdue/5"
        >
          <Trash2 size={19} strokeWidth={1.75} aria-hidden />
          <span className="text-[0.9rem] font-medium">Delete my data</span>
        </button>
      </section>

      <p className="mt-6 text-center font-mono text-[0.65rem] text-ink-2">
        Klar · {process.env.NEXT_PUBLIC_API_MODE === "mock" ? "mock data" : "live backend"}
      </p>
    </Screen>
  );
}

function Row({
  icon: Icon,
  label,
  sub,
  children,
}: {
  icon: typeof Globe;
  label: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <Icon size={19} strokeWidth={1.75} className="text-ink-2" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9rem] font-medium text-ink">{label}</p>
        {sub && <p className="truncate text-[0.72rem] text-ink-2">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
