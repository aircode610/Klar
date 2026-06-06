"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ReadingLoader } from "@/components/brand/ReadingLoader";
import { Button } from "@/components/ui/Button";
import * as api from "@/lib/api";

function ProcessingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!id || started.current) return;
    started.current = true;
    let active = true;

    const poll = async () => {
      try {
        const letter = await api.getDocument(id);
        if (!active) return;
        if (letter.status === "ready") {
          router.replace(`/letters/${id}`);
          return;
        }
        if (letter.status === "failed") {
          setFailed(true);
          return;
        }
        setTimeout(poll, 1500);
      } catch {
        if (active) setTimeout(poll, 1500);
      }
    };
    poll();
    return () => {
      active = false;
    };
  }, [id, router]);

  if (failed) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-soon/40 bg-soon/10 text-soon">
          <AlertTriangle size={26} strokeWidth={1.75} aria-hidden />
        </div>
        <h1 className="text-[1.3rem] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
          I couldn&apos;t read that one
        </h1>
        <p className="mt-2 max-w-xs text-[0.9rem] text-ink-2">
          Try a sharper photo in good light, with the whole page flat in frame.
        </p>
        <Link href="/scan" className="mt-6">
          <Button>Try again</Button>
        </Link>
      </div>
    );
  }

  return <ReadingLoader />;
}

export default function ProcessingPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
      <Suspense fallback={<ReadingLoader />}>
        <ProcessingInner />
      </Suspense>
    </div>
  );
}
