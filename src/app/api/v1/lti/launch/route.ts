import { logger } from "@/lib/logger";
import { STATE_COOKIE, htmlError, htmlRedirect, ltiDeps, readCookie, readParams, resolvePlatformKey, statusForLtiError } from "@/lib/lti/server";
import { completeLaunch } from "../../../../../../functions/src/lib/lti/launch";

export const dynamic = "force-dynamic";

/**
 * Redirect URI de LTI 1.3: verifica el id_token (firma RS256 contra el JWKS
 * de la plataforma, state, nonce, deployment), provisiona usuario e
 * inscripción y deriva a /lti/continuar para iniciar la sesión de Firebase.
 */
export async function POST(request: Request) {
  try {
    const params = await readParams(request);
    const { db, admin } = ltiDeps();
    const { code } = await completeLaunch(db, {
      idToken: params.id_token,
      state: params.state,
      cookieState: readCookie(request, STATE_COOKIE),
    }, { admin, resolvePlatformKey });
    return htmlRedirect(`/lti/continuar?code=${encodeURIComponent(code)}`, {
      "Set-Cookie": `${STATE_COOKIE}=; Path=/api/v1/lti; Max-Age=0; HttpOnly; Secure; SameSite=None`,
    });
  } catch (error: any) {
    logger.warn("[LTI] launch rechazado", { code: error?.code, message: error?.message });
    return htmlError(error?.message || "No se pudo validar el ingreso desde Moodle.", statusForLtiError(error?.code));
  }
}
