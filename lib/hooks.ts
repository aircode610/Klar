"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import type { AppConfig, DeadlinesResponse, Letter, Me } from "@/types";

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

export function useLetters() {
  const state = useAsync(
    () => api.listDocuments({ limit: 50 }).then((p) => p.items),
    [],
  );
  return state as AsyncState<Letter[]>;
}

export function useLetter(id: string) {
  return useAsync<Letter>(() => api.getDocument(id), [id]);
}

export function useDeadlines() {
  return useAsync<DeadlinesResponse>(() => api.getDeadlines(), []);
}

export function useConfig() {
  return useAsync<AppConfig>(() => api.getConfig(), []);
}

export function useMe() {
  return useAsync<Me>(() => api.getMe(), []);
}
