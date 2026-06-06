"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, ImageUp, ScanLine, Sparkles, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";

/**
 * True when the user is on a touch-primary device (phone, tablet) where a
 * real camera makes sense as the primary capture path. On laptops/desktops
 * the `capture="environment"` attribute is silently ignored by the browser
 * — clicking "Take a photo" just opens a file picker, which is identical
 * to the "Upload" button and confusing. Returns `null` before hydration to
 * avoid SSR/CSR mismatch flicker.
 */
function useHasCamera(): boolean | null {
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // (pointer: coarse) is the standardized "touch is the primary input" media
    // query — true on phones/tablets, false on laptops/desktops (including
    // desktops with a touchscreen, which is the correct call: they have a
    // real keyboard + file picker the user expects).
    const mq = window.matchMedia("(pointer: coarse)");
    setHasCamera(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setHasCamera(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return hasCamera;
}

export default function ScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const setPendingUpload = useAppStore((s) => s.setPendingUpload);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const hasCamera = useHasCamera();

  const onPick = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const send = (theFile: File) => {
    setPendingUpload(theFile);
    router.push("/scan/processing");
  };

  const useSample = () => {
    const sample = new File([new Blob(["sample letter"])], "behoerdenbrief.jpg", {
      type: "image/jpeg",
    });
    send(sample);
  };

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
    >
      <div className="flex items-center justify-between py-2">
        <Wordmark size="sm" />
        <Link href="/letters" aria-label="Close" className="rounded-full p-2 text-ink-2 hover:bg-ink/6">
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
        <div className="relative mx-auto aspect-3/4 w-full max-w-75 overflow-hidden rounded-(--radius-lg) border-2 border-dashed border-line bg-surface">
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
          <Corner className="left-3 top-3 border-l-2 border-t-2" />
          <Corner className="right-3 top-3 border-r-2 border-t-2" />
          <Corner className="bottom-3 left-3 border-b-2 border-l-2" />
          <Corner className="bottom-3 right-3 border-b-2 border-r-2" />
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[0.78rem] text-ink-2">
          <Sparkles size={13} aria-hidden /> Qwen-VL reads the letter and extracts every obligation.
        </div>
      </div>

      <div className="space-y-2.5">
        {preview ? (
          <>
            <Button fullWidth size="lg" onClick={() => file && send(file)}>
              <Sparkles size={18} /> Read this letter
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setFile(null);
              }}
            >
              Retake
            </Button>
          </>
        ) : (
          <>
            {hasCamera && (
              <Button fullWidth size="lg" onClick={() => fileRef.current?.click()}>
                <Camera size={19} strokeWidth={2} /> Take a photo
              </Button>
            )}
            <Button
              fullWidth
              size={hasCamera ? "md" : "lg"}
              variant={hasCamera ? "outline" : "primary"}
              onClick={() => fileRef.current?.click()}
            >
              <ImageUp size={18} strokeWidth={2} /> Upload an image or PDF
            </Button>
            <button
              onClick={useSample}
              className="w-full py-2 text-center text-[0.8rem] text-ink-2 underline-offset-4 hover:underline"
            >
              Or try with a sample letter
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
      className={`absolute size-5 ${className}`}
      style={{ borderColor: "var(--brand)" }}
      aria-hidden
    />
  );
}
