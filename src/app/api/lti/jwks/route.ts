import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    keys: [
      {
        kty: "RSA",
        n: "fake-public-modulus-for-lti-key-verification",
        e: "AQAB",
        kid: "ninja-dojo-key-1",
        use: "sig",
        alg: "RS256"
      }
    ]
  });
}
