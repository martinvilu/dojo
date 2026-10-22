import { NextResponse } from "next/server";
import { jsonError, requireBearerUser } from "@/app/api/middleware/api";
import { baseUrlFor, ltiDeps } from "@/lib/lti/server";
import { buildDeepLinkingResponse } from "../../../../../../functions/src/lib/lti/deepLinking";
import { currentSigningKey } from "../../../../../../functions/src/lib/lti/keys";

export const dynamic = "force-dynamic";

const MODULES = [
  { id: "module:overview", title: "Resumen de la cátedra", text: "Panel principal de la cursada.", target: "overview" },
  { id: "module:schedules", title: "Cronograma y clases", text: "Clases, materiales y grabaciones.", target: "schedules" },
  { id: "module:assignments", title: "Trabajos prácticos", text: "Consignas y entregas en GitHub.", target: "assignments" },
  { id: "module:academic", title: "Mi cursada", text: "Condición, parciales y excepciones.", target: "academic" },
  { id: "module:tutorias", title: "Tutorías entre pares", text: "Reservá una mentoría con un compañero.", target: "tutorias" },
  { id: "module:study_groups", title: "Grupos de estudio", text: "Encontrá compañeros con tu horario.", target: "study_groups" },
];

async function loadSession(request: Request, sessionId: string | null) {
  const user = await requireBearerUser(request);
  if (user instanceof NextResponse) return user;
  if (!sessionId) return jsonError(400, "Falta la sesión de Deep Linking.");
  const { db } = ltiDeps();
  const ref = db.collection("lti_deep_link_sessions").doc(sessionId);
  const snap = await ref.get();
  const session = snap.exists ? snap.data() : null;
  const expires = session?.expires_at?.toMillis ? session.expires_at.toMillis() : 0;
  if (!session || session.uid !== user.uid || expires < Date.now()) {
    return jsonError(403, "La sesión para agregar actividades venció. Volvé a intentarlo desde Moodle.");
  }
  return { db, ref, session };
}

async function catalog(db: any, courseId: string) {
  const assignments = await db.collection("assignments").where("course_id", "==", courseId).get();
  return [
    ...MODULES,
    ...assignments.docs
      .filter((d: any) => !d.data().is_archived)
      .map((d: any) => ({ id: `assignment:${d.id}`, title: `TP: ${d.data().title}`, text: "Consigna y entrega del trabajo práctico.", target: "assignments", assignmentId: d.id })),
  ];
}

/** Contenido que el docente puede insertar en Moodle. */
export async function GET(request: Request) {
  const loaded = await loadSession(request, new URL(request.url).searchParams.get("session"));
  if (loaded instanceof NextResponse) return loaded;
  const { db, session } = loaded;
  const course = await db.collection("courses").doc(session.course_id).get();
  const items = (await catalog(db, session.course_id)).map(({ id, title, text }) => ({ id, title, text }));
  return NextResponse.json({ courseName: course.data()?.name || "", acceptMultiple: session.accept_multiple, items });
}

/** Firma la respuesta LtiDeepLinkingResponse con la selección del docente. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const loaded = await loadSession(request, body.session || null);
  if (loaded instanceof NextResponse) return loaded;
  const { db, ref, session } = loaded;

  const selected = new Set<string>(Array.isArray(body.selected) ? body.selected.map(String) : []);
  const chosen = (await catalog(db, session.course_id)).filter((item) => selected.has(item.id));
  if (chosen.length === 0) return jsonError(400, "Elegí al menos una actividad.");
  if (!session.accept_multiple && chosen.length > 1) return jsonError(400, "Moodle acepta una sola actividad en este lugar.");

  const platformSnap = await db.collection("lti_platforms").doc(session.platform_id).get();
  if (!platformSnap.exists) return jsonError(400, "La plataforma ya no está registrada.");

  try {
    const launchUrl = `${baseUrlFor(request)}/api/v1/lti/launch`;
    const jwt = buildDeepLinkingResponse({
      platform: platformSnap.data() as { issuer: string; client_id: string },
      deploymentId: session.deployment_id,
      data: session.data,
      signingKey: currentSigningKey(),
      items: chosen.map((item: any) => ({
        title: item.title,
        text: item.text,
        url: launchUrl,
        custom: { courseId: session.course_id, targetModule: item.target, ...(item.assignmentId ? { assignmentId: item.assignmentId } : {}) },
      })),
    });
    await ref.delete();
    return NextResponse.json({ returnUrl: session.return_url, jwt });
  } catch (error: any) {
    return jsonError(error?.code === "not_configured" ? 503 : 500, error?.message || "No se pudo firmar la respuesta.");
  }
}
