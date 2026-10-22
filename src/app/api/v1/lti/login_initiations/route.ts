import { logger } from "@/lib/logger";
import { baseUrlFor, htmlError, htmlRedirect, ltiDeps, readParams, stateCookie, statusForLtiError } from "@/lib/lti/server";
import { startLogin } from "../../../../../../functions/src/lib/lti/launch";

export const dynamic = "force-dynamic";

/** OIDC third-party initiated login (LTI Core 1.3 §5.1.1). */
async function handle(request: Request) {
  try {
    const params = await readParams(request);
    const { db } = ltiDeps();
    const { redirectUrl, state } = await startLogin(db, params, { baseUrl: baseUrlFor(request) });
    return htmlRedirect(redirectUrl, { "Set-Cookie": stateCookie(state) });
  } catch (error: any) {
    logger.warn("[LTI] login initiation rechazado", { code: error?.code, message: error?.message });
    return htmlError(error?.message || "No se pudo iniciar el ingreso desde Moodle.", statusForLtiError(error?.code));
  }
}

export const GET = handle;
export const POST = handle;
