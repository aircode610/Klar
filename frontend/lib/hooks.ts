"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { ActionListItem, DeadlineItem, Letter, LetterListItem } from "@/types";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    run()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) =>
        !cancelled
          ? setError(e instanceof Error ? e.message : "Something went wrong")
          : null,
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [run, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

/** Full letter (GET /api/letters/{id}); cached for offline + the original view. */
export function useLetter(id: string) {
  const lang = useAppStore((s) => s.lang);
  return useAsync<Letter>(async () => {
    const letter = await api.getLetter(id);
    useAppStore.getState().cacheLetter(letter);
    return letter;
  }, [id, lang]);
}

/** Home/Documents feed — the real GET /api/letters list (compact rows). */
export function useLetters() {
  const lang = useAppStore((s) => s.lang);
  return useAsync<LetterListItem[]>(() => api.listLetters(), [lang]);
}

export function useDeadlines() {
  const lang = useAppStore((s) => s.lang);
  return useAsync<DeadlineItem[]>(() => api.getDeadlines(), [lang]);
}

export function useActions(status?: "open" | "done" | "ignored") {
  const lang = useAppStore((s) => s.lang);
  return useAsync<ActionListItem[]>(() => api.listActions(status), [status, lang]);
}
