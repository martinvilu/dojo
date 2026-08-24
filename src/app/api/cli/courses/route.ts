import { NextResponse } from "next/server";
import { adminDb, requireBearerProfile } from "../../middleware/api";

export const dynamic = "force-dynamic";

/**
 * Role-aware course listing for the Dojo CLI cloud mode (`dojo courses`).
 * Mirrors the callable actions (getStudentCourses / getTeacherCourses /
 * getAdminCourses) but scoped to the bearer identity. Subscription secrets
 * and invite codes are intentionally never exposed here.
 */

const CLI_COURSE_FIELDS = [
  "name",
  "start_date",
  "duration_weeks",
  "commissions",
  "cover_text",
  "archived"
] as const;

function projectCourse(id: string, data: any) {
  const course: Record<string, any> = { id };
  for (const field of CLI_COURSE_FIELDS) {
    if (data?.[field] !== undefined) course[field] = data[field];
  }
  return course;
}

export async function GET(request: Request) {
  const session = await requireBearerProfile(request);
  if (session instanceof NextResponse) return session;
  const { user, profile } = session;
  const uid = user.uid;

  try {
    const db = adminDb();
    const courseIds = new Set<string>();

    if (profile.role === "admin") {
      const snap = await db.collection("courses").get();
      return NextResponse.json({
        courses: snap.docs.map((d) => projectCourse(d.id, d.data()))
      });
    }

    if (profile.role === "teacher") {
      const snap = await db
        .collection("course_teachers")
        .where("teacher_id", "==", uid)
        .get();
      snap.docs.forEach((d) => courseIds.add(d.data().course_id));
    } else {
      // Students: roster assignments plus legacy self-enrollments.
      const rosterSnap = await db
        .collection("course_roster")
        .where("student_id", "==", uid)
        .get();
      rosterSnap.docs.forEach((d) => courseIds.add(d.data().course_id));

      const enrollSnap = await db
        .collection("enrollments")
        .where("student_id", "==", uid)
        .get();
      enrollSnap.docs.forEach((d) => {
        const courseId = String(d.id).split("_").pop();
        if (courseId) courseIds.add(courseId);
      });
    }

    const courses: any[] = [];
    for (const courseId of courseIds) {
      const snap = await db.collection("courses").doc(courseId).get();
      if (snap.exists) courses.push(projectCourse(snap.id, snap.data()));
    }

    return NextResponse.json({ courses });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al listar los cursos: " + error.message },
      { status: 500 }
    );
  }
}
