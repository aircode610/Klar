"use client";

import { useState } from "react";
import { Check, Copy, Download, FileText, Loader2, Printer, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Stamp } from "@/components/brand/Stamp";
import { toast } from "@/components/ui/Toast";
import * as api from "@/lib/api";
import { PROFILE_FIELDS } from "@/lib/data/prototype";

function applicantFromVault(): Record<string, string> {
  const get = (id: string) => PROFILE_FIELDS.find((f) => f.id === id)?.value ?? "";
  return { name: get("name"), address: get("address") };
}

/**
 * The done-for-you Behördendeutsch reply. Generates from POST /letters/{id}/reply,
 * pre-filled from the profile vault, with copy / download / print-to-PDF. The KLAR
 * stamp thunks in once it's ready.
 */
export function ReplyDraft({ letterId, actionId }: { letterId: string; actionId?: string }) {
  const [body, setBody] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.generateReply(letterId, {
        action_id: actionId,
        applicant: applicantFromVault(),
      });
      setBody(res.body_text);
    } catch {
      toast.error("Couldn't generate the reply. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!body) return;
    await navigator.clipboard.writeText(body).catch(() => {});
    setCopied(true);
    toast.success("Copied to clipboard.");
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    if (!body) return;
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klar-antwort.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    if (!body) return;
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    w.document.write(
      `<title>Klar — Antwort</title><pre style="font-family:'Courier New',monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;padding:48px;color:#16120c">${escaped}</pre>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  if (!body) {
    return (
      <div className="rounded-(--radius-lg) border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <Wand2 size={16} strokeWidth={2} className="text-ink" aria-hidden />
          <span className="text-[0.9rem] font-semibold text-ink">Your reply, done for you</span>
        </div>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-2">
          Klar writes the correct reply in Behördendeutsch, filled with your details.
          Ready to copy, download, or print.
        </p>
        <Button fullWidth size="lg" className="mt-3.5" onClick={generate} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Writing your reply…
            </>
          ) : (
            <>
              <Sparkles size={17} strokeWidth={2} /> Generate my reply
            </>
          )}
        </Button>
        <p className="mt-2 text-center text-[0.72rem] text-ink-2">
          Pre-filled from your profile · ready to send
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-(--radius-lg) border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <FileText size={16} strokeWidth={2} className="text-done" aria-hidden />
        <span className="text-[0.9rem] font-semibold text-ink">Your reply is ready</span>
        <Stamp label="KLAR" tone="done" size="sm" className="ms-auto" />
      </div>
      <div className="flex items-center gap-1.5 bg-brand/10 px-4 py-2 text-[0.75rem] text-ink-2">
        <Sparkles size={13} strokeWidth={2} className="text-ink" aria-hidden />
        Behördendeutsch · filled from your <span className="font-semibold text-ink">Profile</span>
      </div>
      <pre className="card-grain relative max-h-80 overflow-y-auto whitespace-pre-wrap px-4 py-4 font-mono text-[0.78rem] leading-relaxed text-ink">
        {body}
      </pre>
      <div className="flex flex-wrap gap-2 border-t border-line p-3">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" variant="ghost" onClick={download}>
          <Download size={15} strokeWidth={2} /> .txt
        </Button>
        <Button size="sm" variant="ghost" onClick={print}>
          <Printer size={15} strokeWidth={2} /> Print / PDF
        </Button>
        <Button size="sm" variant="ghost" className="ms-auto" onClick={generate} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : "Regenerate"}
        </Button>
      </div>
    </div>
  );
}
