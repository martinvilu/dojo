import { NextResponse } from "next/server";
import { toolJwks } from "../../../../../../functions/src/lib/lti/keys";

export const dynamic = "force-dynamic";

/** JWKS público de la herramienta: la plataforma verifica con él nuestras firmas. */
export async function GET() {
  try {
    const jwks = toolJwks();
    if (jwks.keys.length === 0) {
      return NextResponse.json({ error: "La herramienta LTI no tiene claves configuradas." }, { status: 503 });
    }
    return NextResponse.json(jwks, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "Clave LTI inválida." }, { status: 500 });
  }
}
