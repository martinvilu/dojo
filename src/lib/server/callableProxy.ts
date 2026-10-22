import { NextResponse } from "next/server";

/**
 * Invoca la callable `api` de Cloud Functions con el ID token del llamador:
 * los Route Handlers REST reutilizan las mismas políticas de authz,
 * esquemas Zod y rate limiting en lugar de duplicar lógica.
 */
const STATUS_BY_CODE: Record<string, number> = {
  INVALID_ARGUMENT: 400, UNAUTHENTICATED: 401, PERMISSION_DENIED: 403, NOT_FOUND: 404,
  ALREADY_EXISTS: 409, FAILED_PRECONDITION: 412, RESOURCE_EXHAUSTED: 429,
};

function functionsUrl(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    || (process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : "");
  const region = process.env.FUNCTIONS_REGION || "us-central1";
  return process.env.FUNCTIONS_API_URL || `https://${region}-${projectId}.cloudfunctions.net/api`;
}

export class CallableError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function callApi<T = any>(request: Request, action: string, payload: unknown): Promise<T> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new CallableError(401, "Falta el token Bearer de Firebase.");
  const res = await fetch(functionsUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ data: { action, payload } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const status = STATUS_BY_CODE[body.error?.status] || (res.ok ? 500 : res.status);
    throw new CallableError(status, body.error?.message || "Error al invocar la API.");
  }
  return body.result as T;
}

export function errorResponse(error: unknown) {
  if (error instanceof CallableError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
}

/** Segmentos de la URL semántica -> IDs internos (valida el acceso del llamador). */
export async function resolveRoute(request: Request, params: Record<string, string>, extra: Record<string, unknown> = {}) {
  return callApi<{ courseId: string; commission: string | null; assignmentId: string | null }>(request, "resolveCourseRoute", {
    asignatura: params.asignatura, anio: params.anio, cuatrimestre: params.cuatrimestre, comision: params.comision, ...extra,
  });
}
