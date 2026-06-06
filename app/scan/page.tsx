"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, ImageUp, Loader2, ScanLine, Sparkles, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import * as api from "@/lib/api";
import { toast } from "@/components/ui/Toast";

export default function ScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const onPick = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const send = async (theFile: File) => {
    setSending(true);
    try {
      const letter = await api.uploadDocument(theFile);
      router.push(`/scan/processing?id=${letter.id}`);
    } catch {
      toast.error("Upload failed. Check your connection.");
      setSending(false);
    }
  };

  const useSample = () => {
    const sample = new File([new Blob(["sample letter"])], "behoerdenbrief.jpg", {
      type: "image/jpeg",
    });
    void send(sample);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}>
      <div className="flex items-center justify-between py-2">
        <Wordmark size="sm" />
        <Link
          href="/letters"
          aria-label="Close"
          className="rounded-full p-2 text-ink-2 hover:bg-ink/[0.06]"
        >
          <X size={22} strokeWidth={1.75} />
        </Link>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-1 flex-col justify-center">
        {/* Capture frame */}
        <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-[var(--radius-lg)] border-2 border-dashed border-line bg-surface">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your letter" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 text-ink-2">
              <ScanLine size={40} strokeWidth={1.25} aria-hidden />
              <p className="px-8 text-center text-[0.85rem]">
                Flat, good light, the whole page in frame.
              </p>
            </div>
          )}
          {/* corner ticks */}
          <Corner className="left-3 top-3 border-l-2 border-t-2" />
          <Corner className="right-3 top-3 border-r-2 border-t-2" />
          <Corner className="bottom-3 left-3 border-b-2 border-l-2" />
          <Corner className="bottom-3 right-3 border-b-2 border-r-2" />
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[0.78rem] text-ink-2">
          <Sparkles size={13} aria-hidden /> German letters read best — but any official letter works.
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2.5">
        {preview ? (
          <>
            <Button fullWidth size="lg" onClick={() => file && send(file)} disabled={sending}>
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {sending ? "Sending…" : "Read this letter"}
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setFile(null);
              }}
              disabled={sending}
            >
              Retake
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth size="lg" onClick={() => fileRef.current?.click()}>
              <Camera size={19} strokeWidth={2} /> Take a photo
            </Button>
            <Button fullWidth variant="outline" onClick={() => fileRef.current?.click()}>
              <ImageUp size={18} strokeWidth={2} /> Upload an image
            </Button>
            <button
              onClick={useSample}
              disabled={sending}
              className="w-full py-2 text-center text-[0.8rem] text-ink-2 underline-offset-4 hover:underline"
            >
              {sending ? "Sending…" : "Or try with a sample letter"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return (
    <span
      className={`absolute size-5 border-brand ${className}`}
      style={{ borderColor: "var(--brand)" }}
      aria-hidden
    />
  );
}
