import { NextResponse } from "next/server";
import { callApi, errorResponse, resolveRoute } from "@/lib/server/callableProxy";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string };

/** POST …/admin/lti/nrps-sync — sincroniza el padrón desde Moodle (NRPS 2.0). */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  try {
    const { courseId } = await resolveRoute(request, await params);
    return NextResponse.json(await callApi(request, "syncLtiRoster", { courseId }));
  } catch (error) {
    return errorResponse(error);
  }
}
