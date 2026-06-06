"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, ShieldCheck } from "lucide-react";
import { PROFILE_FIELDS } from "@/lib/data/prototype";
import type { ProfileField } from "@/types/extra";
import { toast } from "@/components/ui/Toast";

const GROUPS: { key: ProfileField["group"]; label: string }[] = [
  { key: "identity", label: "Identity" },
  { key: "address", label: "Address" },
  { key: "finance", label: "Finance" },
  { key: "status", label: "Status" },
];

/**
 * The profile vault — store your details once, and Klar fills every reply and
 * form for you. A core differentiator. Prototype: reveal + edit are mocked.
 */
export function ProfileVault() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <ShieldCheck size={16} strokeWidth={2} className="text-done" aria-hidden />
        <span className="text-[0.9rem] font-semibold text-ink">Your details</span>
        <span className="ms-auto font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">
          auto-fills your forms
        </span>
      </div>
      <p className="px-4 pt-3 text-[0.8rem] leading-relaxed text-ink-2">
        Saved once, used everywhere. When Klar writes a reply or fills a form,
        these go in automatically — stored on your device, in the EU.
      </p>

      <div className="p-2">
        {GROUPS.map((g) => {
          const fields = PROFILE_FIELDS.filter((f) => f.group === g.key);
          if (!fields.length) return null;
          return (
            <div key={g.key} className="px-2 pt-3">
              <p className="mb-1 font-mono text-[0.6rem] uppercase tracking-wide text-ink-2">
                {g.label}
              </p>
              <div className="divide-y divide-line">
                {fields.map((f) => (
                  <FieldRow key={f.id} field={f} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldRow({ field }: { field: ProfileField }) {
  const [revealed, setRevealed] = useState(!field.sensitive);
  const display = revealed ? field.value : "•".repeat(Math.min(field.value.length, 16));
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[0.72rem] text-ink-2">{field.label}</p>
        <p className={`truncate text-[0.9rem] text-ink ${field.mono ? "font-mono" : ""}`}>
          {display}
        </p>
      </div>
      {field.sensitive && (
        <button
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? "Hide" : "Reveal"}
          className="rounded-full p-1.5 text-ink-2 hover:text-ink"
        >
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
      <button
        onClick={() => toast.info("Editing is mocked in the prototype.")}
        aria-label={`Edit ${field.label}`}
        className="rounded-full p-1.5 text-ink-2 hover:text-ink"
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}
