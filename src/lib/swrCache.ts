/**
 * Caché stale-while-revalidate en memoria para lecturas de la API (mejora
 * 4.13). Al volver a una pestaña se muestra al instante el último resultado
 * y se pide uno nuevo en segundo plano; llamadas simultáneas con la misma
 * clave comparten la misma petición. Vive solo en la pestaña del navegador.
 */
type Entry = { value?: unknown; at: number; inflight?: Promise<unknown> };

export function createSwrCache(now: () => number = Date.now) {
  const entries = new Map<string, Entry>();

  /** Último valor guardado (aunque esté vencido), o undefined. */
  const peek = <T>(key: string): T | undefined => entries.get(key)?.value as T | undefined;

  /**
   * Devuelve el valor fresco si tiene menos de `maxAgeMs`; si no, ejecuta
   * `fetcher` (una sola vez aunque lo pidan varios) y lo guarda.
   */
  async function get<T>(key: string, fetcher: () => Promise<T>, maxAgeMs = 30_000): Promise<T> {
    const entry = entries.get(key);
    if (entry && entry.value !== undefined && now() - entry.at < maxAgeMs) return entry.value as T;
    if (entry?.inflight) return entry.inflight as Promise<T>;
    const inflight = fetcher().then(
      (value) => { entries.set(key, { value, at: now() }); return value; },
      (error) => { const prev = entries.get(key); if (prev) delete prev.inflight; throw error; },
    );
    entries.set(key, { ...entry, at: entry?.at ?? 0, inflight });
    return inflight;
  }

  /** Borra las claves que empiezan con `prefix` (por ejemplo después de una escritura). */
  function invalidate(prefix = "") {
    for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
  }

  return { get, peek, invalidate, size: () => entries.size };
}

export const cacheKey = (action: string, payload: unknown) => `${action}:${JSON.stringify(payload ?? {})}`;
