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
import { daysUntil } from "@/lib/adapt";
import type { LetterListItem } from "@/types";

function sortLetters(a: LetterListItem, b: LetterListItem) {
  if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
  const da = a.deadline_date ? daysUntil(a.deadline_date)! : 9999;
  const db = b.deadline_date ? daysUntil(b.deadline_date)! : 9999;
  return da - db;
}

export default function LettersPage() {
  const { data: letters, loading, error } = useLetters();
  const lang = useAppStore((s) => s.lang);
  const d = getDictionary(lang);

  const { sorted, next, stats } = useMemo(() => {
    const all = (letters ?? []).slice().sort(sortLetters);
    const dated = all
      .filter((l) => l.deadline_date)
      .sort((a, b) => daysUntil(a.deadline_date)! - daysUntil(b.deadline_date)!);
    const next = dated[0] ?? null;
    const overdue = all.filter((l) => {
      const dr = daysUntil(l.deadline_date);
      return dr !== null && dr < 0;
    }).length;
    const reading = all.filter((l) => l.status === "uploaded" || l.status === "processing").length;
    return { sorted: all, next, stats: { total: all.length, overdue, reading } };
  }, [letters]);

  return (
    <Screen>
      <PageHeader eyebrow={d.letters.title} title="Here's what needs you" />

      {loading && <LettersSkeleton />}
      {error && <Card className="p-5 text-center text-[0.9rem] text-ink-2">{d.errors.generic}</Card>}

      {!loading && !error && letters && (
        <>
          {sorted.length === 0 ? (
            <EmptyState icon={Inbox} title={d.letters.emptyTitle} body={d.letters.emptyBody} />
          ) : (
            <div className="space-y-6">
              {next && <NextDeadlineBanner item={next} />}

              <div className="grid grid-cols-3 gap-2.5">
                <Stat value={stats.total} label="Letters" />
                <Stat value={stats.overdue} label="Overdue" tone={stats.overdue ? "overdue" : undefined} />
                <Stat value={stats.reading} label="Reading" />
              </div>

              <div className="space-y-3">
                {sorted.map((l, i) => (
                  <LetterCard key={l.id} item={l} index={i} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Screen>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "overdue" }) {
  const color = tone === "overdue" ? "var(--overdue)" : "var(--ink)";
  return (
    <Card className="px-3 py-3 text-center">
      <div className="tabular text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color }}>
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">{label}</div>
    </Card>
  );
}

function LettersSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-28 animate-pulse rounded-(--radius-lg) bg-surface-2" />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-(--radius-lg) bg-surface-2" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-(--radius-lg) bg-surface-2" />
      ))}
    </div>
  );
}
