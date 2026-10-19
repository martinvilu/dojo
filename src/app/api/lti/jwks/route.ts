import { NextResponse } from "next/server";
import { loadPrivateKey, publicJwkFromPrivate } from "@/lib/lti/jwt";
import { toolKid } from "@/lib/lti/config";

export const dynamic = "force-dynamic";

/**
 * Keyset público de Ninja Dojo para LTI 1.3 (mejora 3.12): Moodle lo usa
 * para verificar las respuestas de Deep Linking y las aserciones de AGS.
 * Se deriva de LTI_TOOL_PRIVATE_KEY; sin clave configurada, queda vacío.
 */
export async function GET() {
  let keys: object[] = [];
  try {
    const privateKey = loadPrivateKey(process.env.LTI_TOOL_PRIVATE_KEY);
    if (privateKey) keys = [publicJwkFromPrivate(privateKey, toolKid())];
  } catch {
    keys = [];
  }
  return NextResponse.json({ keys }, { headers: { "Cache-Control": "public, max-age=300" } });
}
