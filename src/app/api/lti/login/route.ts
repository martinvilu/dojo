import { NextResponse } from "next/server";
import { adminDb } from "../../middleware/api";
import { getLtiPlatform, toolBaseUrl } from "@/lib/lti/config";
import { createLoginState, redirectPage } from "@/lib/lti/launch";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Iniciación de login OIDC de LTI 1.3 (mejora 3.12). Moodle llama acá con
 * iss, login_hint, target_link_uri y lti_message_hint; respondemos con la
 * redirección al endpoint de autorización de la plataforma, con un state y
 * un nonce de un solo uso guardados en el servidor.
 */
async function handle(request: Request) {
  const config = getLtiPlatform();
  if (!config) return NextResponse.json({ error: "LTI 1.3 no está configurado en Ninja Dojo" }, { status: 503 });

  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  if (request.method === "POST") {
    const form = await request.formData();
    form.forEach((v, k) => typeof v === "string" && params.set(k, v));
  }

  const iss = params.get("iss");
  const loginHint = params.get("login_hint");
  const clientId = params.get("client_id");
  if (iss !== config.issuer) return NextResponse.json({ error: "Plataforma LTI desconocida" }, { status: 400 });
  if (clientId && clientId !== config.clientId) return NextResponse.json({ error: "client_id inválido" }, { status: 400 });
  if (!loginHint) return NextResponse.json({ error: "Falta login_hint" }, { status: 400 });

  const base = toolBaseUrl();
  const targetLinkUri = params.get("target_link_uri");
  if (targetLinkUri && !targetLinkUri.startsWith(base)) {
    return NextResponse.json({ error: "target_link_uri fuera de Ninja Dojo" }, { status: 400 });
  }

  const { state, nonce } = await createLoginState(adminDb(), targetLinkUri);
  const auth = new URL(config.authLoginUrl);
  auth.searchParams.set("scope", "openid");
  auth.searchParams.set("response_type", "id_token");
  auth.searchParams.set("response_mode", "form_post");
  auth.searchParams.set("prompt", "none");
  auth.searchParams.set("client_id", config.clientId);
  auth.searchParams.set("redirect_uri", `${base}/api/lti/launch`);
  auth.searchParams.set("login_hint", loginHint);
  auth.searchParams.set("state", state);
  auth.searchParams.set("nonce", nonce);
  const messageHint = params.get("lti_message_hint");
  if (messageHint) auth.searchParams.set("lti_message_hint", messageHint);

  logger.info("[LTI Login] iniciación OIDC", { iss });
  return new NextResponse(redirectPage(auth.toString(), "Conectando con Moodle..."), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const GET = handle;
export const POST = handle;
