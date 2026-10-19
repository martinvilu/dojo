/**
 * Procesamiento de launches LTI 1.3 ya verificados (mejora 3.12) y
 * almacenamiento del flujo OIDC en Firestore.
 *
 * Flujo:
 *   1. /api/lti/login recibe la iniciación de Moodle, guarda state+nonce
 *      (lti_states, 10 min) y redirige al endpoint de autorización.
 *   2. /api/lti/launch recibe el id_token, consume el state, verifica la
 *      firma y el nonce, y guarda el launch verificado (lti_launches, 1 h).
 *   3. El dashboard recibe solo el ID del launch y lo canjea en el backend
 *      (consumeLtiLaunch): ningún dato del launch viaja por la URL.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { LTI_CLAIMS, type LtiPlatformConfig } from "./config.ts";

export const STATE_TTL_MS = 10 * 60 * 1000;
export const LAUNCH_TTL_MS = 60 * 60 * 1000;

const INSTRUCTOR_ROLE = /#(Instructor|Administrator|ContentDeveloper|TeachingAssistant)$|membership\/Instructor/;

export interface VerifiedLaunch {
  messageType: "LtiResourceLinkRequest" | "LtiDeepLinkingRequest";
  issuer: string;
  sub: string;
  email: string | null;
  name: string | null;
  roles: string[];
  isInstructor: boolean;
  deploymentId: string;
  contextId: string | null;
  contextTitle: string | null;
  resourceLinkId: string | null;
  courseId: string | null;
  assignmentId: string | null;
  targetModule: string | null;
  ags: { lineitem: string | null; lineitems: string | null; scope: string[] } | null;
  deepLinking: { returnUrl: string; data: string | null; acceptTypes: string[] } | null;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Valida los claims LTI del id_token (la firma ya se verificó). */
export function parseVerifiedLaunch(payload: Record<string, any>, config: LtiPlatformConfig): VerifiedLaunch {
  if (payload[LTI_CLAIMS.version] !== "1.3.0") throw new Error("Versión LTI no soportada");
  const messageType = payload[LTI_CLAIMS.messageType];
  if (messageType !== "LtiResourceLinkRequest" && messageType !== "LtiDeepLinkingRequest") {
    throw new Error("Tipo de mensaje LTI no soportado");
  }
  const deploymentId = str(payload[LTI_CLAIMS.deploymentId]);
  if (!deploymentId) throw new Error("Falta el deployment_id");
  if (config.deploymentIds.length > 0 && !config.deploymentIds.includes(deploymentId)) {
    throw new Error("Deployment LTI no autorizado");
  }
  const sub = str(payload.sub);
  if (!sub) throw new Error("Falta el usuario (sub) del launch");

  const roles: string[] = Array.isArray(payload[LTI_CLAIMS.roles]) ? payload[LTI_CLAIMS.roles].filter((r: unknown) => typeof r === "string") : [];
  const custom = payload[LTI_CLAIMS.custom] || {};
  const context = payload[LTI_CLAIMS.context] || {};
  const agsClaim = payload[LTI_CLAIMS.ags];
  const dl = payload[LTI_CLAIMS.deepLinkingSettings];
  if (messageType === "LtiDeepLinkingRequest" && !str(dl?.deep_link_return_url)) {
    throw new Error("Falta deep_link_return_url");
  }

  return {
    messageType,
    issuer: payload.iss,
    sub,
    email: str(payload.email)?.toLowerCase() ?? null,
    name: str(payload.name),
    roles,
    isInstructor: roles.some((r) => INSTRUCTOR_ROLE.test(r)),
    deploymentId,
    contextId: str(context.id),
    contextTitle: str(context.title),
    resourceLinkId: str(payload[LTI_CLAIMS.resourceLink]?.id),
    courseId: str(custom.courseId) || str(custom.course_id),
    assignmentId: str(custom.assignmentId) || str(custom.activityId),
    targetModule: str(custom.targetModule) || str(custom.target_module) || str(custom.target),
    ags: agsClaim
      ? { lineitem: str(agsClaim.lineitem), lineitems: str(agsClaim.lineitems), scope: Array.isArray(agsClaim.scope) ? agsClaim.scope : [] }
      : null,
    deepLinking: dl
      ? { returnUrl: dl.deep_link_return_url, data: str(dl.data), acceptTypes: Array.isArray(dl.accept_types) ? dl.accept_types : [] }
      : null,
  };
}

/** Pestaña y subpestaña del dashboard para un módulo destino. */
export function ltiNavigation(targetModule: string | null, assignmentId: string | null): { tab: string; subTab: string } {
  const t = (targetModule || "").toLowerCase();
  const map: Record<string, string> = {
    schedules: "schedules", calendar: "schedules",
    assignments: "assignments", activities: "assignments", github: "assignments",
    overview: "overview", status: "overview", roster: "overview", alerts: "overview", course: "overview",
    announcements: "announcements", avisos: "announcements",
    tutorias: "tutorias", tutoring: "tutorias",
    study_groups: "study_groups", groups: "study_groups", grupos: "study_groups",
    emails: "emails", mail: "emails",
    students: "students",
  };
  if (t === "profile" || t === "auth") return { tab: "profile", subTab: "" };
  return { tab: "student-courses", subTab: map[t] || (assignmentId ? "assignments" : "") };
}

export async function createLoginState(db: Firestore, targetLinkUri: string | null) {
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  await db.collection("lti_states").doc(state).set({
    nonce,
    target_link_uri: targetLinkUri,
    expires_at: new Date(Date.now() + STATE_TTL_MS),
  });
  return { state, nonce };
}

/** Consume el state una sola vez; devuelve el nonce esperado o null. */
export async function consumeLoginState(db: Firestore, state: string): Promise<string | null> {
  if (!state || state.length > 128 || state.includes("/")) return null;
  const ref = db.collection("lti_states").doc(state);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    const data = snap.data() as { nonce: string; expires_at: { toMillis?: () => number } | Date };
    const expires = data.expires_at instanceof Date ? data.expires_at.getTime() : data.expires_at?.toMillis?.() ?? 0;
    return expires > Date.now() ? data.nonce : null;
  });
}

export async function saveVerifiedLaunch(db: Firestore, launch: VerifiedLaunch): Promise<string> {
  const id = randomUUID();
  await db.collection("lti_launches").doc(id).set({
    ...launch,
    consumed_by: null,
    created_at: new Date(),
    expires_at: new Date(Date.now() + LAUNCH_TTL_MS),
  });
  return id;
}

/** Página que redirige del lado del cliente (App Hosting reescribe Location). */
export function redirectPage(url: string, message = "Redireccionando al Dojo..."): string {
  const safe = url.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]!);
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=${safe}"><title>${message}</title></head>
<body style="background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<p>${message}</p><script>window.location.replace(${JSON.stringify(url)});</script></body></html>`;
}

/** Formulario auto-enviado por POST (respuesta de Deep Linking). */
export function autoPostPage(action: string, fields: Record<string, string>, message: string): string {
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]!);
  const inputs = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${message}</title></head>
<body style="background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;text-align:center;padding:40px;">
<p>${message}</p><form id="f" method="POST" action="${esc(action)}">${inputs}</form>
<script>document.getElementById("f").submit();</script></body></html>`;
}
