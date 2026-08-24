import { NextResponse } from "next/server";
import { adminDb, requireBearerProfile } from "../../middleware/api";

export const dynamic = "force-dynamic";

/**
 * Course assignments plus the caller's own submissions for the Dojo CLI
 * (`dojo assignments` / `dojo status`). Requires course membership; the
 * submissions list is always restricted to the bearer identity.
 */

async function isCourseMember(db: any, courseId: string, uid: string, role: string) {
  if (role === "admin") return true;

  const roster = await db.collection("course_roster").doc(`${courseId}_${uid}`).get();
  if (roster.exists) return true;

  const teacher = await db.collection("course_teachers").doc(`${courseId}_${uid}`).get();
  if (teacher.exists) return true;

  // Legacy self-enrollments use composite ids `<student>_<course>`.
  const enrollSnap = await db
    .collection("enrollments")
    .where("student_id", "==", uid)
    .get();
  return enrollSnap.docs.some((d: any) => String(d.id).includes(`_${courseId}`));
}

export async function GET(request: Request) {
  const session = await requireBearerProfile(request);
  if (session instanceof NextResponse) return session;
  const { user, profile } = session;
  const uid = user.uid;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "Falta el parámetro courseId" }, { status: 400 });
  }

  try {
    const db = adminDb();

    if (!(await isCourseMember(db, courseId, uid, profile.role))) {
      return NextResponse.json(
        { error: "No tenés acceso a esta cátedra" },
        { status: 403 }
      );
    }

    const assignSnap = await db
      .collection("assignments")
      .where("course_id", "==", courseId)
      .get();
    const assignments = assignSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title || "Sin título",
      description: d.data().description || "",
      due_date: d.data().due_date || null,
      template_repo: d.data().template_repo || null,
      is_group: Boolean(d.data().is_group),
      is_archived: Boolean(d.data().is_archived)
    }));

    const assignmentIds = new Set(assignments.map((a) => a.id));
    const subsSnap = await db
      .collection("submissions")
      .where("student_id", "==", uid)
      .get();
    const submissions = subsSnap.docs
      .filter((d) => assignmentIds.has(d.data().assignment_id))
      .map((d) => ({
        id: d.id,
        assignment_id: d.data().assignment_id,
        repo_url: d.data().repo_url || null,
        grade: d.data().grade ?? null,
        feedback: d.data().feedback || null,
        submitted_at: d.data().created_at?.toMillis?.() ?? null,
        graded_at: d.data().graded_at?.toMillis?.() ?? null
      }));

    return NextResponse.json({ assignments, submissions });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al cargar las tareas: " + error.message },
      { status: 500 }
    );
  }
}
