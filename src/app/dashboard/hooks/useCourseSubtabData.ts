"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface UseCourseSubtabDataArgs {
  profile: any;
  selectedCourse: any;
  courseSubTab: string;
  assignments: any[];
  setAssignments: (a: any[]) => void;
  setSubmissions: (s: any[]) => void;
  setCourseSubmissions: (s: any[]) => void;
  setTeacherClasses: (classes: any[]) => void;
  setAnnouncements: (anns: any[]) => void;
  setCourseTeachers: (teachers: any[]) => void;
  setAllTeachersList: (teachers: any[]) => void;
  setTutors: (tutors: any[]) => void;
  setTutoringSessions: (sessions: any[]) => void;
  setStudyGroups: (groups: any[]) => void;
  applyCourseSettings: (data: any) => void;
  setOtherTeacherCourses: (courses: any[]) => void;
  setApiLoading: (v: boolean) => void;
}

/**
 * Loads the data required by each course detail sub-tab according to the
 * user role, plus the overview submissions aggregation and the students
 * tab submissions refresh.
 */
export function useCourseSubtabData({
  profile, selectedCourse, courseSubTab,
  assignments, setAssignments,
  setSubmissions,
  setCourseSubmissions,
  setTeacherClasses,
  setAnnouncements,
  setCourseTeachers,
  setAllTeachersList,
  setTutors, setTutoringSessions, setStudyGroups,
  applyCourseSettings, setOtherTeacherCourses,
  setApiLoading
}: UseCourseSubtabDataArgs) {
  const [overviewSubmissionsList, setOverviewSubmissionsList] = useState<any[]>([]);
  const [loadingOverviewSubmissions, setLoadingOverviewSubmissions] = useState<boolean>(false);

  const loadAllCourseSubmissions = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid || assignments.length === 0) return;

    try {
      const results = await Promise.all(assignments.map(async (a) => {
        const res = await api("getAssignmentSubmissions", { assignmentId: a.id });
        return res || [];
      }));
      setCourseSubmissions(results.flat());
    } catch (err) {
      console.error("Error loading course submissions for alerts:", err);
    }
  };

  useEffect(() => {
    if (courseSubTab === "students") {
      loadAllCourseSubmissions();
    }
    // Refresh on tab entry only; submissions are fetched per current
    // assignments snapshot at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseSubTab]);

  const loadOverviewData = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setLoadingOverviewSubmissions(true);
    try {
      let courseAssignments = assignments;
      if (assignments.length === 0) {
        const res = await api("getTeacherAssignments");
        courseAssignments = (res || []).filter((a: any) => a.course_id === cid);
        setAssignments(courseAssignments);
      }

      const subsPromises = courseAssignments.map(async (a: any) => {
        const res = await api("getAssignmentSubmissions", { assignmentId: a.id });
        return { assignmentId: a.id, title: a.title, submissions: res || [] };
      });
      const results = await Promise.all(subsPromises);

      const allSubs: any[] = [];
      results.forEach(r => {
        r.submissions.forEach((s: any) => {
          allSubs.push({
            ...s,
            assignmentTitle: r.title,
            assignmentId: r.assignmentId
          });
        });
      });
      setOverviewSubmissionsList(allSubs);
    } catch (err) {
      console.error("Error loading overview submissions:", err);
    } finally {
      setLoadingOverviewSubmissions(false);
    }
  };

  // Load course details subtabs
  useEffect(() => {
    if (!selectedCourse) return;
    const cid = selectedCourse.id || selectedCourse.course?.id;
    if (!cid) return;

    const loadSubTabData = async () => {
      setApiLoading(true);
      try {
        if (profile?.role === "teacher") {
          if (courseSubTab === "overview") {
            await loadOverviewData();
          } else if (courseSubTab === "settings") {
            const res = await api("getCourseSettings", { courseId: cid });
            const data = (res && (res.start_date !== undefined || res.invite_code !== undefined)) ? res : (res?.data || selectedCourse || {});
            applyCourseSettings(data);


            // Get other courses for cloning
            const otherCoursesRes = await api("getTeacherCourses");
            setOtherTeacherCourses(otherCoursesRes.filter((c: any) => c.id !== cid));
          } else if (courseSubTab === "schedules") {
            const res = await api("getCourseDetails", { courseId: cid });
            setTeacherClasses(res?.class_instances || []);
          } else if (courseSubTab === "assignments") {
            const res = await api("getTeacherAssignments");
            const courseAssignments = (res || []).filter((a: any) => a.course_id === cid);
            setAssignments(courseAssignments);
          } else if (courseSubTab === "announcements") {
            const res = await api("getTeacherAnnouncements");
            const courseAnnouncements = (res || []).filter((a: any) => a.course_id === cid);
            setAnnouncements(courseAnnouncements);
          } else if (courseSubTab === "teachers") {
            const tRes = await api("getCourseTeachers", { courseId: cid });
            setCourseTeachers(tRes || []);
          }
        } else if (profile?.role === "admin") {
          const detailRes = await api("getAdminCourseDetails", { courseId: cid });
          setTeacherClasses(detailRes?.class_instances || []);

          if (courseSubTab === "overview") {
            await loadOverviewData();
          } else if (courseSubTab === "settings") {
            const res = await api("getCourseSettings", { courseId: cid });
            const data = (res && (res.start_date !== undefined || res.invite_code !== undefined)) ? res : (res?.data || selectedCourse || {});
            applyCourseSettings(data);
          } else if (courseSubTab === "assignments") {
            setAssignments(detailRes?.assignments || []);
          } else if (courseSubTab === "teachers") {
            const tRes = await api("getCourseTeachers", { courseId: cid });
            setCourseTeachers(tRes || []);
            const uRes = await api("getAdminUsers");
            setAllTeachersList((uRes || []).filter((u: any) => u.role === "teacher"));
          }
        } else if (profile?.role === "student") {
          // Student details load
          const detailRes = await api("getCourseDetails", { courseId: cid });
          setTeacherClasses(detailRes?.class_instances || []);

          if (courseSubTab === "assignments") {
            const aRes = await api("getStudentAssignments", { courseIds: [cid] });
            setAssignments(aRes.assignments || []);
            setSubmissions(aRes.submissions || []);
          } else if (courseSubTab === "announcements") {
            const annRes = await api("getStudentAnnouncements", { courseIds: [cid] });
            setAnnouncements(annRes || []);
          }
        }

        if (courseSubTab === "tutorias") {
          const tutorsList = await api("getCourseTutors", { courseId: cid });
          setTutors(tutorsList || []);
          const studentSessions = await api("getTutoringSessions", { courseId: cid, role: "student" }).catch(() => []);
          const tutorSessions = await api("getTutoringSessions", { courseId: cid, role: "tutor" }).catch(() => []);
          const uniqueSessions = [...(studentSessions || []), ...(tutorSessions || [])]
            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
          setTutoringSessions(uniqueSessions);
        } else if (courseSubTab === "study_groups") {
          const groupsList = await api("getStudyGroups", { courseId: cid });
          setStudyGroups(groupsList || []);
        }
      } catch (err: any) {
        console.error("Error loading subtab data:", err);
      } finally {
        setApiLoading(false);
      }
    };

    loadSubTabData();
    // Reload strictly on tab/course/role changes; loader closures read
    // fresh state at call time and would cause redundant fetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseSubTab, selectedCourse, profile]);

  return { overviewSubmissionsList, loadingOverviewSubmissions };
}
