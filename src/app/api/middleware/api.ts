import { NextResponse } from "next/server";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Shared middleware helpers for App Router API routes.
 *
 * Firebase Admin initializes with Application Default Credentials on
 * Firebase App Hosting (no service-account JSON needed).
 */
export function adminDb() {
  if (!getApps().length) {
    initializeApp();
  }
  return getFirestore();
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export interface CourseSubscription {
  courseId: string;
  course: any;
}

/**
 * Validates the per-course subscription share token (sync_secret), the same
 * scheme used by the CSV export cloud functions. Returns the course snapshot
 * or a NextResponse ready to be returned by the caller.
 *
 * Usage:
 *   const sub = await requireCourseSubscriptionToken(request);
 *   if (sub instanceof NextResponse) return sub;
 */
export async function requireCourseSubscriptionToken(
  request: Request,
  courseIdParam: string = "id"
): Promise<CourseSubscription | NextResponse> {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get(courseIdParam) || "";
  const token = searchParams.get("token") || "";

  if (!courseId) return jsonError(400, "Falta el ID del curso");
  if (!token) return jsonError(401, "Token de suscripción inválido");

  try {
    const snap = await adminDb().collection("courses").doc(courseId).get();
    if (!snap.exists) return jsonError(404, "Curso no encontrado");

    const course = snap.data();
    if (!course?.sync_secret || course.sync_secret !== token) {
      return jsonError(401, "Token de suscripción inválido");
    }
    return { courseId, course };
  } catch (error: any) {
    return jsonError(500, "Error al validar la suscripción: " + error.message);
  }
}

/** Basic sanitizer for free-text fields embedded in generated documents. */
export function sanitizeLine(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}
