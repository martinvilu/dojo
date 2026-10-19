import { NextResponse } from "next/server";
import { adminDb } from "../../middleware/api";
import { getLtiPlatform, toolBaseUrl } from "@/lib/lti/config";
import { verifyPlatformJwt } from "@/lib/lti/jwt";
import { consumeLoginState, ltiNavigation, parseVerifiedLaunch, redirectPage, saveVerifiedLaunch } from "@/lib/lti/launch";
import { moduleSelectionPage } from "@/lib/lti/modules";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const html = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

function errorPage(message: string, status = 400) {
  return html(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Error LTI</title></head>
<body style="background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;padding:40px;text-align:center">
<h1 style="font-size:18px">No se pudo abrir Ninja Dojo desde Moodle</h1><p style="color:#a3a3a3">${message.replace(/[<>&]/g, "")}</p>
<p style="color:#a3a3a3;font-size:12px">Volvé a abrir la actividad desde Moodle. Si el problema sigue, avisá a la coordinación.</p></body></html>`, status);
}

function dashboardUrl(params: Record<string, string | null>) {
  const url = new URL("/dashboard", toolBaseUrl());
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * Launch LTI 1.3 (mejora 3.12). Con la plataforma configurada, el
 * id_token se verifica (firma RS256 contra el JWKS de Moodle, emisor,
 * audiencia, vigencia, state y nonce de un solo uso) y el dashboard recibe
 * solo el ID del launch verificado. Sin configuración (simulador local),
 * los parámetros sirven únicamente para navegar.
 */
export async function POST(request: Request) {
  const config = getLtiPlatform();
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") || "";
  const form = contentType.includes("form") || contentType.includes("multipart") ? await request.formData() : null;
  const field = (name: string) => (form?.get(name) as string | null) || url.searchParams.get(name);

  if (config) {
    const idToken = field("id_token");
    const state = field("state");
    if (!idToken || !state) return errorPage("Falta el token de inicio de sesión de Moodle.");
    try {
      const db = adminDb();
      const expectedNonce = await consumeLoginState(db, state);
      if (!expectedNonce) return errorPage("La sesión de inicio expiró o ya se usó.", 401);
      const payload = await verifyPlatformJwt(idToken, { jwksUrl: config.jwksUrl, issuer: config.issuer, audience: config.clientId });
      if (payload.nonce !== expectedNonce) return errorPage("El token no corresponde a este inicio de sesión.", 401);
      const launch = parseVerifiedLaunch(payload, config);
      const launchId = await saveVerifiedLaunch(db, launch);
      logger.info("[LTI Launch] verificado", { messageType: launch.messageType, courseId: launch.courseId });

      if (launch.messageType === "LtiDeepLinkingRequest") {
        if (!launch.isInstructor) return errorPage("Solo el equipo docente puede agregar módulos de Ninja Dojo.", 403);
        return html(moduleSelectionPage(`${toolBaseUrl()}/api/lti/deeplink`, { launchId }));
      }
      const nav = ltiNavigation(launch.targetModule, launch.assignmentId);
      return html(redirectPage(dashboardUrl({
        lti_launch: launchId,
        tab: nav.tab,
        subTab: nav.subTab,
        courseId: launch.courseId,
        assignmentId: launch.assignmentId,
      })));
    } catch (error: any) {
      logger.warn("[LTI Launch] rechazado", { error: error.message });
      return errorPage(`El inicio desde Moodle no es válido: ${error.message}.`, 401);
    }
  }

  // Modo sin LTI 1.3 configurado (simulador / desarrollo): solo navegación.
  // Nada del launch es confiable, así que no se propagan identidad, roles
  // ni la URL de outcome de notas.
  const targetModule = field("targetModule") || field("custom_targetmodule") || field("custom_target_module");
  const courseId = field("courseId") || field("custom_courseid") || field("custom_course_id");
  const assignmentId = field("assignmentId") || field("custom_assignmentid") || field("custom_activityid");
  const nav = ltiNavigation(targetModule, assignmentId);
  logger.warn("[LTI Launch] LTI 1.3 no configurado: launch sin verificar, solo navegación");
  return html(redirectPage(dashboardUrl({
    lti_launch: "unverified",
    tab: nav.tab,
    subTab: nav.subTab,
    targetModule,
    courseId,
    assignmentId,
  })));
}

export async function GET(request: Request) {
  return POST(request);
}
