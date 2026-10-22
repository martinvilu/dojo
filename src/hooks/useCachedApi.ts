"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cacheKey, createSwrCache } from "@/lib/swrCache";

export const apiCache = createSwrCache();

/**
 * Lectura de la API con stale-while-revalidate: arranca con el último valor
 * conocido de esa acción y payload, y lo reemplaza cuando llega el nuevo.
 */
export function useCachedApi<T = any>(action: string, payload: Record<string, unknown>, { maxAgeMs = 30_000, enabled = true } = {}) {
  const key = cacheKey(action, payload);
  const [state, setState] = useState<{ key: string; data: T | undefined; error: Error | null }>(() => ({ key, data: apiCache.peek<T>(key), error: null }));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiCache.get<T>(key, () => api(action, payload), maxAgeMs)
      .then((data) => { if (!cancelled) setState({ key, data, error: null }); })
      .catch((error) => { if (!cancelled) setState((prev) => ({ ...prev, key, error })); });
    return () => { cancelled = true; };
    // `key` resume action + payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, maxAgeMs]);

  const data = state.key === key ? state.data : apiCache.peek<T>(key);
  return { data, error: state.key === key ? state.error : null, loading: data === undefined };
}
