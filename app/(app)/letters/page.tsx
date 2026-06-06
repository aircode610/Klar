"use client";

import { useMemo } from "react";
import { Inbox } from "lucide-react";
import { useLetters } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { getDictionary } from "@/lib/i18n";
import { Screen, PageHeader } from "@/components/ui/Screen";
import { LetterCard } from "@/components/screens/LetterCard";
import { NextDeadlineBanner } from "@/components/screens/NextDeadlineBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import type { Letter, Urgency } from "@/types";

const RANK: Record<Urgency, number> = {
  overdue: 0,
  urgent: 1,
  soon: 2,
  normal: 3,
  info: 4,
};

function sortByUrgency(a: Letter, b: Letter) {
  const ua = a.deadline ? RANK[a.deadline.urgency] : 99;
  const ub = b.deadline ? RANK[b.deadline.urgency] : 99;
  if (ua !== ub) return ua - ub;
  const da = a.deadline?.daysRemaining ?? 9999;
  const db = b.deadline?.daysRemaining ?? 9999;
  return da - db;
}

export default function LettersPage() {
  const { data: letters, loading, error } = useLetters();
  const lang = useAppStore((s) => s.lang);
  const d = getDictionary(lang);

  const { actionable, handled, next, stats } = useMemo(() => {
    const all = letters ?? [];
    const ready = all.filter((l) => l.status === "ready");
    const actionable = ready.filter((l) => !l.handled).sort(sortByUrgency);
    const handled = ready.filter((l) => l.handled);
    const next = actionable.find((l) => l.deadline && l.deadline.date) ?? null;
    const overdue = actionable.filter((l) => l.deadline?.urgency === "overdue").length;
    return {
      actionable,
      handled,
      next,
      stats: { action: actionable.length, overdue, handled: handled.length },
    };
  }, [letters]);

  return (
    <Screen>
      <PageHeader eyebrow={d.letters.title} title="Here's what needs you" />

      {loading && <LettersSkeleton />}

      {error && (
        <Card className="p-5 text-center text-[0.9rem] text-ink-2">{d.errors.generic}</Card>
      )}

      {!loading && !error && letters && (
        <>
          {actionable.length === 0 && handled.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={d.letters.emptyTitle}
              body={d.letters.emptyBody}
            />
          ) : (
            <div className="space-y-6">
              {next && <NextDeadlineBanner letter={next} />}

              <div className="grid grid-cols-3 gap-2.5">
                <Stat value={stats.action} label="Need action" />
                <Stat value={stats.overdue} label="Overdue" tone={stats.overdue ? "overdue" : undefined} />
                <Stat value={stats.handled} label="Handled" tone="done" />
              </div>

              {actionable.length > 0 && (
                <section>
                  <SectionLabel>Needs action</SectionLabel>
                  <div className="space-y-3">
                    {actionable.map((l, i) => (
                      <LetterCard key={l.id} letter={l} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {handled.length > 0 && (
                <section>
                  <SectionLabel>Handled</SectionLabel>
                  <div className="space-y-3 opacity-90">
                    {handled.map((l, i) => (
                      <LetterCard key={l.id} letter={l} index={i} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </Screen>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "overdue" | "done";
}) {
  const color =
    tone === "overdue" ? "var(--overdue)" : tone === "done" ? "var(--done)" : "var(--ink)";
  return (
    <Card className="px-3 py-3 text-center">
      <div
        className="tabular text-2xl font-bold"
        style={{ fontFamily: "var(--font-display)", color }}
      >
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">
        {label}
      </div>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
      {children}
    </h2>
  );
}

function LettersSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      ))}
    </div>
  );
}
