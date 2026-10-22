import { NextResponse } from "next/server";
import { callApi, errorResponse, resolveRoute } from "@/lib/server/callableProxy";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string };

/**
 * POST …/admin/lti/ags-publish — publica notas en Moodle (AGS 2.0).
 * Body: { "practica": "tp-1" } o { "assessmentId": "…" }.
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  try {
    const body = await request.json().catch(() => ({}));
    const route = await resolveRoute(request, await params, body.practica ? { practica: String(body.practica) } : {});
    return NextResponse.json(await callApi(request, "publishLtiGrades", {
      courseId: route.courseId,
      assignmentId: route.assignmentId,
      assessmentId: body.assessmentId || null,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
