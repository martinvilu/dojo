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
 * Exposes moodleLtiParams for grade sync on assignment submissions.
 */
export function useDeepLinks({
  profile, setProfile, courses, setCourses,
  setActiveTab, viewCourseDetails, handleSetCourseSubTab, promptGithubUsername
}: UseDeepLinksArgs) {
  const hasProcessedParams = useRef(false);
  const moodleLtiParams = useRef<{ outcomeUrl?: string, resultId?: string }>({});

  // Load REST URL parameters (integration / direct link support)
  useEffect(() => {
    if (typeof window === "undefined" || !profile || courses.length === 0 || hasProcessedParams.current) return;
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get("courseId");
    const assignmentId = params.get("assignmentId");
    const userId = params.get("userId");
    const tab = params.get("tab");
    const subTab = params.get("subTab");

    const processParams = async () => {
      hasProcessedParams.current = true;
      const outcomeUrl = params.get("lis_outcome_service_url");
      const resultId = params.get("lis_result_sourcedid");
      const ltiLaunch = params.get("lti_launch") === "true";

      if (outcomeUrl && resultId) {
        moodleLtiParams.current = { outcomeUrl, resultId };
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
          await api("moodleAutoEnroll", { courseId });
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
