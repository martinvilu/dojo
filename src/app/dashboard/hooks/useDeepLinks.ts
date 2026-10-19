"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

interface UseDeepLinksArgs {
  profile: any;
  setProfile: (updater: (prev: any) => any) => void;
  courses: any[];
  setCourses: (courses: any[]) => void;
  setActiveTab: (tab: string) => void;
  viewCourseDetails: (course: any) => Promise<void>;
  handleSetCourseSubTab: (tab: string) => void;
  promptGithubUsername: () => Promise<string | null>;
}

/**
 * Deep-link / query-param integration: consumes courseId, assignmentId,
 * userId, tab/subTab and LTI launch params once per auth+data readiness.
 * Exposes moodleLtiParams (the verified LTI launch id) so accepting an
 * assignment can link it to the Moodle gradebook through AGS.
 */
export function useDeepLinks({
  profile, setProfile, courses, setCourses,
  setActiveTab, viewCourseDetails, handleSetCourseSubTab, promptGithubUsername
}: UseDeepLinksArgs) {
  const hasProcessedParams = useRef(false);
  const moodleLtiParams = useRef<{ launchId?: string }>({});

  // Load REST URL parameters (integration / direct link support)
  useEffect(() => {
    if (typeof window === "undefined" || !profile || courses.length === 0 || hasProcessedParams.current) return;
    const params = new URLSearchParams(window.location.search);
    let courseId = params.get("courseId");
    let assignmentId = params.get("assignmentId");
    const userId = params.get("userId");
    const tab = params.get("tab");
    const subTab = params.get("subTab");

    const processParams = async () => {
      hasProcessedParams.current = true;
      const ltiParam = params.get("lti_launch");
      const ltiLaunch = Boolean(ltiParam);

      // Launch LTI 1.3 verificado: el contexto sale del backend, no de la URL.
      if (ltiParam && ltiParam !== "unverified" && ltiParam !== "true") {
        try {
          const launch = await api("consumeLtiLaunch", { launchId: ltiParam });
          moodleLtiParams.current = { launchId: ltiParam };
          courseId = launch?.courseId || courseId;
          assignmentId = launch?.assignmentId || assignmentId;
          if (launch && launch.emailMatches === false) {
            showToast("Entraste desde Moodle con un usuario distinto al de esta sesión de Ninja Dojo. Verificá que sea tu cuenta.", "error");
          }
        } catch (e: any) {
          showToast("No se pudo validar el ingreso desde Moodle: " + e.message, "error");
        }
      }
      if (tab) {
        setActiveTab(tab);
      }
      if (subTab) {
        handleSetCourseSubTab(subTab);
      }

      let updatedCourses = courses;
      if (ltiLaunch && courseId) {
        try {
          const enrollment = await api("moodleAutoEnroll", { courseId });
          if (enrollment?.status === "pending") {
            showToast("Tu inscripción desde Moodle quedó pendiente de aprobación por el docente.", "success");
          }
          const roleTab = profile.role === "admin" ? "getAdminCourses" : (profile.role === "teacher" ? "getTeacherCourses" : "getStudentCourses");
          const updated = await api(roleTab);
          setCourses(updated || []);
          updatedCourses = updated || [];

          if (profile.role === "student" && !profile.github_user) {
            const githubUser = await promptGithubUsername();
            if (githubUser && githubUser.trim()) {
              const cleanedUser = githubUser.trim();
              await api("updateProfile", { github_user: cleanedUser });
              setProfile((prev: any) => prev ? { ...prev, github_user: cleanedUser } : null);
              showToast("¡Tu usuario de GitHub ha sido vinculado correctamente!", "success");
            } else {
              showToast("⚠️ Atención: Debes vincular tu usuario de GitHub desde la pestaña Mi Perfil antes de poder entregar tareas.", "success");
            }
          }
        } catch (e) {
          console.error("LTI Auto-enroll error:", e);
        }
      }

      if (courseId) {
        const found = updatedCourses.find((c: any) => (c.id === courseId || c.course?.id === courseId));
        if (found) {
          await viewCourseDetails(found.course || found);
        }
      }
      if (assignmentId) {
        let matchedCourse = null;
        for (const c of updatedCourses) {
          const cid = c.id || c.course?.id;
          if (cid) {
            try {
              const res = await api("getCourseDetails", { courseId: cid });
              if (res && res.assignments && res.assignments.some((a: any) => a.id === assignmentId)) {
                matchedCourse = c.course || c;
                break;
              }
            } catch {}
          }
        }
        if (matchedCourse) {
          await viewCourseDetails(matchedCourse);
          handleSetCourseSubTab("assignments");
        }
      }
      if (userId && profile?.role === "admin") {
        setActiveTab("admin-users");
      }
    };

    processParams();
    // Query params must be consumed once per auth/data readiness;
    // the handlers are unstable closures that would re-trigger this flow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, courses]);

  return { moodleLtiParams };
}
