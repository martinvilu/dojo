/**
 * Date helpers tolerant to every shape the app receives: Firestore
 * Timestamps ({seconds, nanoseconds}), ISO strings, epoch numbers and
 * invalid values. `Intl.DateTimeFormat.format()` throws RangeError on
 * non-finite dates, so callers must never feed it raw values.
 */

const defaultFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function toDateSafe(value: any): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  // Firestore Timestamp serialized over the wire
  if (typeof value === "object" && Number.isFinite(Number(value.seconds))) {
    return new Date(Number(value.seconds) * 1000);
  }
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function formatDateSafe(value: any, formatter = defaultFormatter): string {
  const d = toDateSafe(value);
  return d ? formatter.format(d) : "—";
}
