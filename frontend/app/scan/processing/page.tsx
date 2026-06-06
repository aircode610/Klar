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

/**
 * Target progress percent for each non-chunked SSE event. The bar snaps to
 * the maximum of (current, target) — never backwards. Chunked events
 * (`explanation`, `response_draft`) advance by small increments capped at
 * their upper bound so the bar visibly moves DURING streaming, not after.
 */
const PROGRESS_TARGETS: Partial<Record<LetterProgressEvent["type"], number>> = {
  ocr_result: 12,
  classification: 22,
  risk_score: 32,
  deadline: 42,
  consequence: 52,
  checklist: 94,
  citations: 98,
  done: 100,
};

const EXPLANATION_CAP = 75; // explanation chunks stop advancing past here
const RESPONSE_DRAFT_CAP = 92; // response_draft chunks stop advancing past here
const CHUNK_STEP = 0.8; // each chunked event advances the bar by this much

export default function ProcessingPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<string>("Reading your letter…");
  // Start at a few percent so the bar reads as "alive" before the first
  // SSE event arrives (~3s gap between upload and ocr_result).
  const [progress, setProgress] = useState<number>(3);
  const started = useRef(false);

  useEffect(() => {
    // React 18 strict mode runs this effect twice in dev (mount→unmount→remount).
    // `started` is a ref so it survives the cleanup. We DO NOT use a closure-
    // scoped `active` flag for the navigation decision — that closure dies
    // with the first unmount, which would then prevent the (still in-flight)
    // upload's resolution from ever calling `router.replace`. Refs are the
    // ONLY ownership model here.
    if (started.current) return;
    started.current = true;

    const { pendingUpload, setPendingUpload, cacheLetter } = useAppStore.getState();
    if (!pendingUpload) {
      router.replace("/scan");
      return;
    }

    (async () => {
      console.log("[klar processing] starting upload");
      try {
        const letter = await api.uploadLetter(pendingUpload, (event) => {
          const copy = STAGE_COPY[event.type];
          if (copy && event.type !== "done" && event.type !== "error") {
            setStage(copy);
          }
          // Update the determinate progress bar
          if (event.type === "explanation") {
            setProgress((p) => Math.min(Math.max(p, 52) + CHUNK_STEP, EXPLANATION_CAP));
          } else if (event.type === "response_draft") {
            setProgress((p) => Math.min(Math.max(p, EXPLANATION_CAP + 1) + CHUNK_STEP, RESPONSE_DRAFT_CAP));
          } else {
            const target = PROGRESS_TARGETS[event.type];
            if (target !== undefined) setProgress((p) => Math.max(p, target));
          }
        });
        console.log("[klar processing] ✓ upload resolved, letter.id=", letter?.id);
        cacheLetter(letter);
        setPendingUpload(null);
        console.log("[klar processing] → router.replace(/letters/" + letter.id + ")");
        router.replace(`/letters/${letter.id}`);
      } catch (err) {
        console.error("[klar processing] upload failed:", err);
        setPendingUpload(null);
        setFailed(true);
      }
    })();
    // Intentionally no cleanup — see comment above.
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
        <div className="flex w-full max-w-xs flex-col items-center gap-5 text-center">
          <ReadingLoader />
          <p
            className="text-[0.95rem] text-ink-2"
            aria-live="polite"
            aria-atomic="true"
          >
            {stage}
          </p>

          {/* Determinate progress bar — stages advance discretely, chunks
              advance smoothly, both capped so the bar never overshoots. */}
          <div
            className="w-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label="Reading progress"
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[0.75rem] tabular-nums text-ink-2">
              {Math.round(progress)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
