"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

interface UseTabDataLoaderArgs {
  activeTab: string;
  profile: any;
  setSelectedCourse: (c: any) => void;
  setCourses: (courses: any[]) => void;
  setUsers: (users: any[]) => void;
  setGlobalCalendarUrl: (url: string) => void;
  setSystemBackups: (backups: any[]) => void;
  setAssignments: (assignments: any[]) => void;
  setTeacherClasses: (classes: any[]) => void;
  setProfileName: (v: string) => void;
  setProfileMatricula: (v: string) => void;
  setProfileCohorte: (v: string) => void;
  setProfileGithubUser: (v: string) => void;
  setXpLogs: (logs: any[]) => void;
  setApiLoading: (v: boolean) => void;
  setError: (msg: string) => void;
}

/**
 * Loads the data required by each top-level dashboard tab (admin, teacher,
 * student, calendar, profile). Resets course selection on tab change.
 */
export function useTabDataLoader({
  activeTab, profile,
  setSelectedCourse, setCourses, setUsers,
  setGlobalCalendarUrl, setSystemBackups,
  setAssignments, setTeacherClasses,
  setProfileName, setProfileMatricula, setProfileCohorte, setProfileGithubUser, setXpLogs,
  setApiLoading, setError
}: UseTabDataLoaderArgs) {
  // Load data when tab changes
  useEffect(() => {
    setSelectedCourse(null);
    if (!profile || (profile.account_status !== "approved" && profile.role !== "admin" && profile.role !== "teacher")) return;

    const loadData = async () => {
      setApiLoading(true);
      try {
        if (activeTab === "admin-courses") {
          const res = await api("getAdminCourses");
          setCourses(res || []);
        } else if (activeTab === "admin-users") {
          const res = await api("getAdminUsers");
          setUsers(res || []);
        } else if (activeTab === "admin-settings") {
          const res = await api("getGlobalSettings");
          setGlobalCalendarUrl(res?.globalCalendarIcsUrl || "");
        } else if (activeTab === "admin-backups") {
          const res = await api("getSystemBackups");
          setSystemBackups(res || []);
        } else if (activeTab === "teacher-courses") {
          const res = await api("getTeacherCourses");
          setCourses(res || []);
        } else if (activeTab === "student-courses") {
          const res = await api("getStudentCourses");
          setCourses(res || []);
        } else if (activeTab === "calendar") {
          const userCourses = profile?.role === "student"
            ? await api("getStudentCourses")
            : await api("getTeacherCourses");
          const safeCourses = userCourses || [];
          setCourses(safeCourses);

          const courseIds = safeCourses.map((c: any) => c.id || c.course?.id).filter(Boolean);
          if (courseIds.length > 0) {
            // ⚡ Bolt: Performance Optimization
            // Replaced O(N) Array.find() scans with an O(1) Map lookup
            const courseNameMap = new Map<string, string>();
            for (let i = 0; i < safeCourses.length; i++) {
              const c = safeCourses[i];
              const cid = c.id || c.course?.id;
              if (cid) courseNameMap.set(cid, c.name || c.course?.name || "Cátedra");
            }
            const getCourseName = (cid: string) => courseNameMap.get(cid) || "Cátedra";

            const assignRes = profile?.role === "student"
              ? await api("getStudentAssignments", { courseIds })
              : await api("getTeacherAssignments", { courseIds });
            const rawAssignments = Array.isArray(assignRes) ? assignRes : (assignRes?.assignments || []);
            const loadedAssignments = rawAssignments.map((a: any) => ({
              ...a,
              course_name: a.course_name || getCourseName(a.course_id),
            }));
            setAssignments(loadedAssignments);

            const allClassInstances: any[] = [];
            await Promise.all(
              courseIds.map(async (cid: string) => {
                try {
                  const detail = await api("getCourseDetails", { courseId: cid });
                  const cName = detail?.name || getCourseName(cid);
                  const instances = detail?.class_instances || [];
                  instances.forEach((inst: any) => {
                    allClassInstances.push({
                      ...inst,
                      course_id: cid,
                      course_name: cName,
                    });
                  });
                } catch (e) {
                  console.error("Error fetching course details for calendar:", e);
                }
              })
            );
            setTeacherClasses(allClassInstances);
          }
        } else if (activeTab === "profile" && profile) {
          setProfileName(profile.full_name || "");
          setProfileMatricula(profile.matricula_unrn || "");
          setProfileCohorte(profile.cohorte || "");
          setProfileGithubUser(profile.github_user || "");
          api("getXpLogs").then(logs => setXpLogs(logs || [])).catch(() => setXpLogs([]));
        }
      } catch (err: any) {
        console.error("Error loading tab data:", err);
        setError("Error de red: " + err.message);
      } finally {
        setApiLoading(false);
      }
    };

    loadData();
    // Reload strictly on tab/profile changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profile]);
}
