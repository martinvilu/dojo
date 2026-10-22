/**
 * Errores del navegador a Sentry (mejora 5.07), solo con NEXT_PUBLIC_SENTRY_DSN.
 * Sin DSN el SDK ni siquiera se descarga: el import dinámico queda fuera.
 */
import { PRIVATE_DATA_COLLECTION } from "@/lib/observability";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) => Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0),
      // Sin datos personales; los query params viejos (?courseId=…) tampoco viajan.
      dataCollection: PRIVATE_DATA_COLLECTION,
    }))
    .catch(() => { /* la app funciona igual sin monitoreo */ });
}
