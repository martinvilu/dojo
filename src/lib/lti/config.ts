/**
 * Configuración LTI 1.3 de la plataforma (Moodle) y de la herramienta
 * (Ninja Dojo), desde variables de entorno del servidor (mejora 3.12).
 *
 * Plataforma (los datos los da Moodle al registrar la herramienta):
 *   LTI_PLATFORM_ISSUER      p. ej. https://moodle.unrn.edu.ar
 *   LTI_CLIENT_ID            client_id asignado a Ninja Dojo
 *   LTI_PLATFORM_AUTH_URL    .../mod/lti/auth.php
 *   LTI_PLATFORM_JWKS_URL    .../mod/lti/certs.php
 *   LTI_PLATFORM_TOKEN_URL   .../mod/lti/token.php (AGS)
 *   LTI_DEPLOYMENT_IDS       IDs de deployment aceptados, separados por coma
 * Herramienta:
 *   LTI_TOOL_PRIVATE_KEY     clave RSA privada (PEM) para firmar y para el JWKS
 *   LTI_TOOL_KID             identificador de la clave (por defecto dojo-lti-1)
 */
export interface LtiPlatformConfig {
  issuer: string;
  clientId: string;
  authLoginUrl: string;
  jwksUrl: string;
  tokenUrl: string | null;
  deploymentIds: string[];
}

export function getLtiPlatform(env: Record<string, string | undefined> = process.env): LtiPlatformConfig | null {
  const issuer = env.LTI_PLATFORM_ISSUER;
  const clientId = env.LTI_CLIENT_ID;
  const authLoginUrl = env.LTI_PLATFORM_AUTH_URL;
  const jwksUrl = env.LTI_PLATFORM_JWKS_URL;
  if (!issuer || !clientId || !authLoginUrl || !jwksUrl) return null;
  return {
    issuer,
    clientId,
    authLoginUrl,
    jwksUrl,
    tokenUrl: env.LTI_PLATFORM_TOKEN_URL || null,
    deploymentIds: (env.LTI_DEPLOYMENT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

export const TOOL_KID_DEFAULT = "dojo-lti-1";

export function toolKid(env: Record<string, string | undefined> = process.env): string {
  return env.LTI_TOOL_KID || TOOL_KID_DEFAULT;
}

/** URL pública canónica de la app (nunca la dirección interna del contenedor). */
export function toolBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.NEXT_PUBLIC_APP_URL || "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app").replace(/\/+$/, "");
}

export const LTI_CLAIMS = {
  messageType: "https://purl.imsglobal.org/spec/lti/claim/message_type",
  version: "https://purl.imsglobal.org/spec/lti/claim/version",
  deploymentId: "https://purl.imsglobal.org/spec/lti/claim/deployment_id",
  roles: "https://purl.imsglobal.org/spec/lti/claim/roles",
  context: "https://purl.imsglobal.org/spec/lti/claim/context",
  resourceLink: "https://purl.imsglobal.org/spec/lti/claim/resource_link",
  custom: "https://purl.imsglobal.org/spec/lti/claim/custom",
  ags: "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint",
  deepLinkingSettings: "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings",
  contentItems: "https://purl.imsglobal.org/spec/lti-dl/claim/content_items",
  data: "https://purl.imsglobal.org/spec/lti-dl/claim/data",
} as const;
