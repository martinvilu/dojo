/**
 * Observabilidad del servidor de Next (plan F8 / mejora 5.07).
 * Sentry se activa solo si hay SENTRY_DSN: sin DSN no se carga nada.
 */
import type { Instrumentation } from "next";

import { PRIVATE_DATA_COLLECTION } from "@/lib/observability";

const dsn = process.env.SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    // Sin datos personales: ni usuario, ni cookies, ni headers, ni cuerpos, ni query params.
    dataCollection: PRIVATE_DATA_COLLECTION,
  });
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
