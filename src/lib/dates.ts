/**
 * Date helpers tolerant to every shape the app receives: Firestore
 * Timestamps ({seconds, nanoseconds}), ISO strings, epoch numbers and
 * invalid values. `Intl.DateTimeFormat.format()` throws RangeError on
 * non-finite dates, so callers must never feed it raw values.
 */

export const formatDateTime = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatShortDate = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const formatDateFull = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatTimeOnly = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

const defaultFormatter = formatDateTime;

export function toDateSafe(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  
  // Firestore Timestamp serialized over the wire or client SDK
  if (typeof value === "object" && value !== null) {
    if ("toDate" in value && typeof (value as { toDate: () => unknown }).toDate === "function") {
      const d = (value as { toDate: () => unknown }).toDate();
      if (d instanceof Date && Number.isFinite(d.getTime())) return d;
    }
    if ("seconds" in value && Number.isFinite(Number((value as { seconds: unknown }).seconds))) {
      return new Date(Number((value as { seconds: number }).seconds) * 1000);
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  return null;
}

export function formatDateSafe(value: unknown, formatter = defaultFormatter): string {
  const d = toDateSafe(value);
  return d ? formatter.format(d) : "—";
}
