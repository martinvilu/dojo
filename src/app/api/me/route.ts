import { NextResponse } from "next/server";
import { requireBearerProfile } from "../middleware/api";

export const dynamic = "force-dynamic";

/**
 * Identity sanity endpoint for the Dojo CLI (`dojo login` connection test).
 * Returns the caller's Firebase Auth identity plus their Firestore profile.
 */
export async function GET(request: Request) {
  const session = await requireBearerProfile(request);
  if (session instanceof NextResponse) return session;
  const { user, profile } = session;

  return NextResponse.json({
    uid: user.uid,
    email: user.email || null,
    profile: {
      id: profile.id ?? user.uid,
      full_name: profile.full_name || "",
      role: profile.role,
      account_status: profile.account_status,
      matricula_unrn: profile.matricula_unrn || null,
      cohorte: profile.cohorte || null,
      github_user: profile.github_user || null
    }
  });
}
