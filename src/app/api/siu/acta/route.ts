import { NextResponse } from "next/server";
import { adminDb, requireCourseSubscriptionToken } from "../../middleware/api";
import { buildRegularityActa, signActa } from "@/lib/siuActa";

export const dynamic = "force-dynamic";

/**
 * Acta de regularidades en JSON para SIU Guaraní (mejora 3.43).
 *
 *   GET /api/siu/acta?id=<courseId>&token=<sync_secret>[&min_attendance=75][&min_grade=4]
 *
 * Autenticada con el token del equipo docente; la respuesta lleva
 * `X-Dojo-Signature: sha256=<HMAC del cuerpo con el mismo token>`.
 */
export async function GET(request: Request) {
  const sub = await requireCourseSubscriptionToken(request);
  if (sub instanceof NextResponse) return sub;
  const { courseId, course } = sub;

  const params = new URL(request.url).searchParams;
  const minAttendance = Number(params.get("min_attendance") ?? 75);
  const minGrade = Number(params.get("min_grade") ?? 4);
  if (!Number.isFinite(minAttendance) || minAttendance < 0 || minAttendance > 100 || !Number.isFinite(minGrade) || minGrade < 0 || minGrade > 10) {
    return NextResponse.json({ error: "Criterios inválidos (min_attendance 0-100, min_grade 0-10)" }, { status: 400 });
  }

  const acta = await buildRegularityActa(adminDb(), courseId, course, { minAttendance, minGrade });
  const body = JSON.stringify(acta);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Dojo-Signature": signActa(body, course.sync_secret),
    },
  });
}
