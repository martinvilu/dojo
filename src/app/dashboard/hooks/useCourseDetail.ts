"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

interface UseCourseDetailArgs {
  profile: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  courses: any[];
  setTeacherClasses: (classes: any[]) => void;
  setApiLoading: (v: boolean) => void;
}

/**
 * Course detail domain: selected course + sub-tab state, breadcrumb-safe
 * sub-tab navigation with history sync, detail loading per role, calendar
 * shortcut and command-palette navigation.
 */
export function useCourseDetail({
  profile, activeTab, setActiveTab, courses, setTeacherClasses, setApiLoading
}: UseCourseDetailArgs) {
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [courseSubTab, setCourseSubTab] = useState("schedules");

  const handleSetCourseSubTab = (tab: string) => {
    setCourseSubTab(tab);
    if (selectedCourse?.id || selectedCourse?.course?.id) {
      const cid = selectedCourse.id || selectedCourse.course.id;
      window.history.pushState(null, "", `/dashboard/courses/${cid}/${tab}`);
    }
  };

  // Open course calendar directly
  const handleOpenCourseCalendar = (courseId: string) => {
    const courseMatch = courses.find((c: any) => (c.id || c.course?.id) === courseId);
    if (courseMatch) {
      const cData = courseMatch.course || courseMatch;
      const instances = cData.class_instances || [];
      const formattedClasses = instances.map((inst: any) => ({
        ...inst,
        course_id: courseId,
        course_name: cData.name || courseMatch.name,
      }));
      setTeacherClasses(formattedClasses);
    }
    setActiveTab("calendar");
  };

  // View course details (shared logic)
  const viewCourseDetails = async (course: any) => {
    const courseId = course.id;
    setApiLoading(true);
    try {
      if (profile?.role === "admin") {
        const res = await api("getAdminCourseDetails", { courseId });
        setSelectedCourse({ id: courseId, name: course.name, ...res });
      } else {
        const res = await api("getCourseDetails", { courseId });
        setSelectedCourse({ id: courseId, name: course.name, ...res });
      }
      if (profile?.role === "teacher" || profile?.role === "admin") {
        handleSetCourseSubTab("overview");
      } else {
        handleSetCourseSubTab("schedules");
      }
    } catch (err: any) {
      showToast("Error al cargar detalles de la cátedra: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleCommandNavigate = async (r: any) => {
    if (!r?.courseRef) return;
    const tabByRole = profile?.role === "admin" ? "admin-courses" : profile?.role === "teacher" ? "teacher-courses" : "student-courses";
    setActiveTab(tabByRole);
    await viewCourseDetails(r.courseRef);
    if (r.subTab) handleSetCourseSubTab(r.subTab);
  };

  // Dynamic Document Title based on active course or tab (starts with "Dojo")
  useEffect(() => {
    if (typeof window === "undefined") return;

    let titleStr = "Dojo";

    if (selectedCourse) {
      const courseName = selectedCourse.name || "Cátedra";
      const subtabMap: Record<string, string> = {
        overview: "Inicio",
        classes: "Clases y Cronograma",
        assignments: "Tareas y Entregas",
        roster: "Alumnos y Alertas",
        forum: "Foros y Consultas",
        groups: "Grupos de Estudio",
        tutorias: "Tutorías Académicas",
        announcements: "Avisos",
        settings: "Configuración",
      };
      const subtabName = subtabMap[courseSubTab] || "Detalles";
      titleStr = `Dojo | ${courseName} - ${subtabName}`;
    } else {
      const tabMap: Record<string, string> = {
        "teacher-courses": "Mis Cátedras",
        "student-courses": "Mis Cursadas",
        "admin-courses": "Gestión de Cátedras",
        "admin-users": "Administración de Usuarios",
        "admin-backups": "Respaldos de Sistema",
        calendar: "Calendario Global",
        profile: "Mi Perfil",
      };
      const tabName = tabMap[activeTab] || "Dashboard";
      titleStr = `Dojo | ${tabName}`;
    }

    document.title = titleStr;
  }, [selectedCourse, courseSubTab, activeTab]);

  return {
    selectedCourse, setSelectedCourse,
    courseSubTab, setCourseSubTab,
    handleSetCourseSubTab,
    handleOpenCourseCalendar,
    viewCourseDetails,
    handleCommandNavigate
  };
}
