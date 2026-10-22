import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { logger } from "@/lib/logger";
import { ltiDeps } from "@/lib/lti/server";
import { redeemHandoff } from "../../../../../../functions/src/lib/lti/launch";

export const dynamic = "force-dynamic";

/**
 * Canjea el código de un launch verificado (un uso, 2 minutos) por un custom
 * token de Firebase. El token se emite en el momento: nunca se guarda.
 */
export async function POST(request: Request) {
  try {
    const { code } = await request.json().catch(() => ({ code: "" }));
    const { db } = ltiDeps();
    const { uid, redirect } = await redeemHandoff(db, code);
    const customToken = await getAuth().createCustomToken(uid, { lti: true });
    return NextResponse.json({ customToken, redirect }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    if (error?.code !== "invalid_handoff") logger.error("[LTI] handoff falló", error);
    const status = error?.code === "invalid_handoff" ? 400 : 500;
    return NextResponse.json({ error: error?.code === "invalid_handoff" ? error.message : "No se pudo iniciar la sesión." }, { status });
  }
}
