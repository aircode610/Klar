"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { ActionListItem, Letter } from "@/types";

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

export function useLetter(id: string) {
  const lang = useAppStore((s) => s.lang);
  return useAsync<Letter>(async () => {
    const letter = await api.getLetter(id);
    useAppStore.getState().cacheLetter(letter);
    return letter;
  }, [id, lang]);
}

export function useActions(status?: "open" | "done" | "ignored") {
  const lang = useAppStore((s) => s.lang);
  return useAsync<ActionListItem[]>(() => api.listActions(status), [status, lang]);
}

/**
 * The home/documents feed. The backend is obligation-centric with no
 * list-letters endpoint, so we read /actions, collect the distinct letters, and
 * fetch each (cached). Falls back to the local cache if the network is down.
 */
export function useLetters() {
  const lang = useAppStore((s) => s.lang);
  return useAsync<Letter[]>(async () => {
    try {
      const actions = await api.listActions();
      const ids = Array.from(new Set(actions.map((a) => a.letter_id)));
      const letters = await Promise.all(
        ids.map((id) => api.getLetter(id).catch(() => null)),
      );
      const result = letters.filter((l): l is Letter => l !== null);
      const cache = useAppStore.getState().cacheLetter;
      result.forEach(cache);
      if (result.length > 0) return result;
    } catch {
      /* fall through to cache */
    }
    const { letters, letterIds } = useAppStore.getState();
    return letterIds.map((id) => letters[id]).filter(Boolean);
  }, [lang]);
}
