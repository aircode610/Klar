"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, FolderClosed, Search } from "lucide-react";
import { useLetters } from "@/lib/hooks";
import { Screen, PageHeader } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Chip } from "@/components/ui/Chip";
import { letterIcon } from "@/lib/letter-visuals";
import type { Letter } from "@/types";

function docStatus(l: Letter): { label: string; tone: "done" | "ready" | "muted" } {
  if (l.handled) return { label: "Sent", tone: "done" };
  if (l.output.available && !l.output.locked) return { label: "Ready", tone: "ready" };
  return { label: "Draft", tone: "muted" };
}

export default function DocumentsPage() {
  const { data: letters, loading } = useLetters();
  const [query, setQuery] = useState("");

  const docs = useMemo(() => {
    const withOutput = (letters ?? []).filter((l) => l.output.type !== "none");
    const q = query.trim().toLowerCase();
    if (!q) return withOutput;
    return withOutput.filter((l) =>
      `${l.sender} ${l.documentType} ${l.referenceNumber}`.toLowerCase().includes(q),
    );
  }, [letters, query]);

  return (
    <Screen>
      <PageHeader eyebrow="Documents" title="Your paperwork, sorted" />

      <div className="relative mb-4">
        <Search
          size={17}
          className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-2"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by sender, type or reference…"
          className="h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface ps-10 pe-3 text-[0.9rem] text-ink outline-none placeholder:text-ink-2/70 focus:border-ink/30"
        />
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={FolderClosed}
          title={query ? "Nothing matches" : "No documents yet"}
          body={
            query
              ? "Try a different search."
              : "Replies and forms you generate land here, ready to download."
          }
        />
      ) : (
        <div className="space-y-2.5">
          {docs.map((l) => {
            const Icon = letterIcon(l);
            const status = docStatus(l);
            return (
              <Link
                key={l.id}
                href={`/letters/${l.id}`}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-3.5 transition-colors hover:border-ink/25"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface-2 text-ink-2">
                  <Icon size={19} strokeWidth={1.75} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.95rem] font-semibold text-ink">
                    {l.output.type === "filled_form" ? "Form" : "Reply"} · {l.documentType}
                  </p>
                  <p className="truncate font-mono text-[0.68rem] uppercase tracking-wide text-ink-2">
                    {l.sender}
                  </p>
                </div>
                <Chip
                  className={
                    status.tone === "done"
                      ? "border-transparent text-done"
                      : status.tone === "ready"
                        ? "border-transparent text-ink"
                        : ""
                  }
                  style={
                    status.tone === "done"
                      ? { backgroundColor: "color-mix(in srgb, var(--done) 14%, transparent)" }
                      : status.tone === "ready"
                        ? { backgroundColor: "var(--brand)", color: "var(--brand-ink)" }
                        : undefined
                  }
                >
                  {status.label === "Draft" && <FileText size={12} aria-hidden />}
                  {status.label}
                </Chip>
              </Link>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
