import { NextResponse } from "next/server";
import { callApi, errorResponse, resolveRoute } from "@/lib/server/callableProxy";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string };

/**
 * POST …/admin/cierre-cursada — congela el acta (UC-D17). Con
 * `{ "simulate": true, "rules": {...} }` solo simula, sin escribir.
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  try {
    const { courseId } = await resolveRoute(request, await params);
    const body = await request.json().catch(() => ({}));
    if (body?.simulate) {
      return NextResponse.json(await callApi(request, "getAcademicConditions", { courseId, rulesOverride: body.rules || {} }));
    }
    return NextResponse.json(await callApi(request, "closeCourse", { courseId, note: typeof body?.note === "string" ? body.note : undefined }));
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET …/admin/cierre-cursada — estado del cierre y versiones del acta. */
export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  try {
    const { courseId } = await resolveRoute(request, await params);
    return NextResponse.json(await callApi(request, "getCourseClosure", { courseId }));
  } catch (error) {
    return errorResponse(error);
  }
}
