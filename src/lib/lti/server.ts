import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/app/api/middleware/api";
import { getBaseUrl } from "@/lib/url";
// Librería LTI compartida con Cloud Functions (CommonJS, sin dependencias).
import { createPlatformKeyResolver } from "../../../functions/src/lib/lti/platformKeys";
import { isSafeExternalUrl } from "../../../functions/src/lib/urls";

export const STATE_COOKIE = "lti_state";

/** Firestore admin + FieldValue con la forma que espera functions/src/lib/lti. */
export function ltiDeps() {
  return { db: adminDb(), admin: { firestore: { FieldValue } } };
}

export const resolvePlatformKey = createPlatformKeyResolver({ isSafeUrl: isSafeExternalUrl });

export function baseUrlFor(request: Request): string {
  return getBaseUrl(request).replace(/\/$/, "");
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c] as string);

function page(title: string, body: string, status = 200, headers: Record<string, string> = {}) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px">
<main style="max-width:520px;text-align:center">${body}</main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}

/**
 * Redirección por HTML: en Firebase App Hosting `NextResponse.redirect`
 * reescribe el Location contra la dirección interna del contenedor.
 */
export function htmlRedirect(url: string, headers: Record<string, string> = {}) {
  const safe = escapeHtml(url);
  return page("Redireccionando…",
    `<meta http-equiv="refresh" content="0;url=${safe}"><p>Redireccionando…</p><script>window.location.replace(${JSON.stringify(url)});</script>`,
    200, headers);
}

export function htmlError(message: string, status = 400) {
  return page("No se pudo ingresar al Dojo",
    `<h1 style="font-size:20px">No se pudo ingresar al Dojo</h1><p style="color:#d4d4d4">${escapeHtml(message)}</p>
<p style="color:#737373;font-size:13px">Si el problema sigue, avisale a tu docente.</p>`, status);
}

export function htmlPage(title: string, bodyHtml: string) {
  return page(title, bodyHtml);
}

/** Código HTTP para cada error de la librería LTI. */
export function statusForLtiError(code: string | undefined): number {
  if (code === "not_configured") return 503;
  if (code === "platform_pending" || code === "unsupported_role" || code === "platform_disabled") return 403;
  return 400;
}

export function stateCookie(state: string) {
  // SameSite=None: el POST del launch viene de Moodle (otro sitio), a veces dentro de un iframe.
  return `${STATE_COOKIE}=${state}; Path=/api/v1/lti; Max-Age=600; HttpOnly; Secure; SameSite=None`;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}

/** Parámetros de un request GET o POST form-urlencoded. */
export async function readParams(request: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((value, key) => { out[key] = value; });
  if (request.method === "POST") {
    const type = request.headers.get("content-type") || "";
    if (type.includes("form")) {
      const form = await request.formData();
      form.forEach((value, key) => { if (typeof value === "string") out[key] = value; });
    }
  }
  return out;
}
