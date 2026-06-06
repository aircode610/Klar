"use client";

import { useState } from "react";
import { Check, Copy, Download, FileText, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Stamp } from "@/components/brand/Stamp";
import { toast } from "@/components/ui/Toast";

/**
 * The done-for-you Behördendeutsch reply. The backend generates it during the SSE
 * pipeline (response_draft) and stores it on the letter; here we present it with
 * copy / download / print-to-PDF.
 */
export function ReplyDraft({ body }: { body: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(body).catch(() => {});
    setCopied(true);
    toast.success("Copied to clipboard.");
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klar-antwort.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
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

  return (
    <div className="overflow-hidden rounded-(--radius-lg) border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <FileText size={16} strokeWidth={2} className="text-done" aria-hidden />
        <span className="text-[0.9rem] font-semibold text-ink">Your reply, done for you</span>
        <Stamp label="KLAR" tone="done" size="sm" className="ms-auto" />
      </div>
      <div className="flex items-center gap-1.5 bg-brand/10 px-4 py-2 text-[0.75rem] text-ink-2">
        <Sparkles size={13} strokeWidth={2} className="text-ink" aria-hidden />
        Behördendeutsch · ready to send
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
      </div>
    </div>
  );
}
