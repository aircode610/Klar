"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ReadingLoader } from "@/components/brand/ReadingLoader";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";
import type { LetterProgressEvent } from "@/lib/api/client";

/** Human label for each SSE event type — shown live under the loader. */
const STAGE_COPY: Record<LetterProgressEvent["type"], string> = {
  ocr_result: "Reading your letter…",
  classification: "Identifying the agency…",
  risk_score: "Calculating urgency…",
  deadline: "Looking for deadlines…",
  consequence: "Checking what's at stake…",
  explanation: "Writing the explanation…",
  response_draft: "Drafting your reply (Behördendeutsch)…",
  checklist: "Building your checklist…",
  citations: "Finding legal references…",
  done: "Done",
  error: "Something went wrong",
};

export default function ProcessingPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<string>("Reading your letter…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const { pendingUpload, setPendingUpload, cacheLetter } = useAppStore.getState();
    if (!pendingUpload) {
      router.replace("/scan");
      return;
    }

    let active = true;
    (async () => {
      try {
        // Pass the progress callback so we can show stages live as the AI
        // pipeline emits them (OCR → classification → risk → deadline →
        // consequence → explanation → response_draft → checklist → citations).
        const letter = await api.uploadLetter(pendingUpload, (event) => {
          if (!active) return;
          const copy = STAGE_COPY[event.type];
          if (copy && event.type !== "done" && event.type !== "error") {
            setStage(copy);
          }
        });
        if (!active) return;
        cacheLetter(letter);
        setPendingUpload(null);
        router.replace(`/letters/${letter.id}`);
      } catch {
        if (active) {
          setPendingUpload(null);
          setFailed(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
      {failed ? (
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-soon/40 bg-soon/10 text-soon">
            <AlertTriangle size={26} strokeWidth={1.75} aria-hidden />
          </div>
          <h1
            className="text-[1.3rem] font-semibold text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            I couldn&apos;t read that one
          </h1>
          <p className="mt-2 max-w-xs text-[0.9rem] text-ink-2">
            Try a sharper photo in good light, with the whole page flat in frame.
          </p>
          <Link href="/scan" className="mt-6">
            <Button>Try again</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <ReadingLoader />
          <p
            className="text-[0.95rem] text-ink-2"
            aria-live="polite"
            aria-atomic="true"
          >
            {stage}
          </p>
        </div>
      )}
    </div>
  );
}
