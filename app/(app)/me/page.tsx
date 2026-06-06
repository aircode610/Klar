"use client";

import { useState } from "react";
import {
  ChevronRight,
  Crown,
  FileText,
  Globe,
  Loader2,
  Moon,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useConfig, useMe } from "@/lib/hooks";
import * as api from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { LANG_LABEL } from "@/lib/i18n";
import { Screen, PageHeader } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { LangSwitcher } from "@/components/ui/LangSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ProfileVault } from "@/components/screens/me/ProfileVault";
import { toast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/utils";

export default function MePage() {
  const { data: me, reload } = useMe();
  const { data: config } = useConfig();
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const [upgrading, setUpgrading] = useState(false);

  const plan = config?.plans[0];
  const active = me?.subscription.active;

  const upgrade = async () => {
    if (!plan) return;
    setUpgrading(true);
    try {
      const { paymentId } = await api.checkout({ target: "subscription", planId: plan.id });
      let status = "open";
      for (let i = 0; i < 6 && status !== "paid"; i++) {
        status = (await api.getPayment(paymentId)).status;
      }
      if (status !== "paid") throw new Error();
      toast.success("Welcome to the Bürokratie-Flat.");
      reload();
    } catch {
      toast.error("Could not complete the upgrade.");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Screen>
      <PageHeader eyebrow="Me" title="Your account" />

      {/* Account header */}
      <div className="mb-5 flex items-center gap-3.5">
        <div className="flex size-14 items-center justify-center rounded-full border border-line bg-surface-2 text-ink">
          <UserRound size={26} strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[1.05rem] font-semibold text-ink">Danial Eyvazi</p>
          <p className="font-mono text-[0.7rem] text-ink-2">
            {me?.lettersCount ?? 0} letters · {LANG_LABEL[lang]}
          </p>
        </div>
      </div>

      {/* Subscription */}
      <section className="mb-5 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
        <div className="card-grain relative p-5">
          <div className="flex items-center gap-2">
            <Crown size={17} strokeWidth={2} className={active ? "text-done" : "text-ink-2"} aria-hidden />
            <span className="font-semibold text-ink">
              {active ? plan?.name ?? "Bürokratie-Flat" : "Free"}
            </span>
            {active && (
              <span className="ms-auto rounded-full bg-done/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-done">
                Active
              </span>
            )}
          </div>

          {active ? (
            <p className="mt-2 text-[0.85rem] text-ink-2">
              Unlimited letters and forms. Renews{" "}
              {me?.subscription.renewsAt
                ? new Date(me.subscription.renewsAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                  })
                : "monthly"}
              .
            </p>
          ) : (
            <>
              <p className="mt-2 text-[0.85rem] text-ink-2">
                You pay {config ? formatMoney(config.perLetterPrice) : "per letter"}. Go
                flat for unlimited letters, forms and reminders.
              </p>
              {plan && (
                <Button className="mt-3.5" onClick={upgrade} disabled={upgrading}>
                  {upgrading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Upgrading…
                    </>
                  ) : (
                    <>
                      Go flat — {formatMoney(plan.price)}/{plan.interval}
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Profile vault */}
      <div className="mb-5">
        <ProfileVault />
      </div>

      {/* Settings */}
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
        <Row icon={Globe} label="Language">
          <LangSwitcher className="border-0 bg-transparent px-0" />
        </Row>
        <Row icon={Moon} label="Theme" sub={theme === "dark" ? "Dark" : "Light"}>
          <ThemeToggle />
        </Row>
        <Row icon={FileText} label="Letter history" sub={`${me?.lettersCount ?? 0} total`}>
          <ChevronRight size={18} className="text-ink-2 rtl:rotate-180" aria-hidden />
        </Row>
        <Row icon={ShieldCheck} label="Privacy" sub="Stored in the EU">
          <ChevronRight size={18} className="text-ink-2 rtl:rotate-180" aria-hidden />
        </Row>
        <button
          onClick={() => toast.info("This would delete all your data.")}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-start text-overdue hover:bg-overdue/[0.05]"
        >
          <Trash2 size={19} strokeWidth={1.75} aria-hidden />
          <span className="text-[0.9rem] font-medium">Delete my data</span>
        </button>
      </section>

      <p className="mt-6 text-center font-mono text-[0.65rem] text-ink-2">
        Klar · prototype · mock data
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
        {sub && <p className="text-[0.72rem] text-ink-2">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
