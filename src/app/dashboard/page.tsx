"use client";

import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db, functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import { marked } from "marked";

// Callable API helper
const apiCall = httpsCallable(functions, "api");
const api = async (action: string, payload: any = {}) => {
  const res = await apiCall({ action, payload });
  return res.data as any;
};

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  avatar_url?: string;
  account_status: "pending" | "approved";
  matricula_unrn?: string;
  cohorte?: string;
}

interface ClassInstance {
  date: string;
  type: string;
  topic: string;
  presentation_url?: string;
  recording_url?: string;
  special_status: "Normal" | "Clase Remota" | "Examen" | "Feriado";
  description?: string;
  classNumber?: number;
}

interface ScheduleItem {
  day: string;
  time: string;
  type: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiLoading, setApiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const [error, setError] = useState("");

  // Pending Matricula inputs
  const [matriculaInput, setMatriculaInput] = useState("");
  const [matriculaError, setMatriculaError] = useState("");

  // Profile Edit state
  const [profileMatricula, setProfileMatricula] = useState("");
  const [profileCohorte, setProfileCohorte] = useState("");

  // Data states
  const [courses, setCourses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>({});
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [courseSubTab, setCourseSubTab] = useState("schedules"); // schedules, settings, assignments, announcements

  // Form states
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseOrg, setNewCourseOrg] = useState("");
  const [enrollCode, setEnrollCode] = useState("");
  const [globalCalendarUrl, setGlobalCalendarUrl] = useState("");

  // Teacher Schedule & Settings local states
  const [teacherStartDate, setTeacherStartDate] = useState("");
  const [teacherDuration, setTeacherDuration] = useState("");
  const [teacherCoverText, setTeacherCoverText] = useState("");
  const [teacherGithubToken, setTeacherGithubToken] = useState("");
  const [teacherExternalCalendars, setTeacherExternalCalendars] = useState("");
  const [teacherSchedules, setTeacherSchedules] = useState<ScheduleItem[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassInstance[]>([]);
  
  // Adding schedule states
  const [scheduleDay, setScheduleDay] = useState("Lunes");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleType, setScheduleType] = useState("Teoría");

  // Clone course config state
  const [otherTeacherCourses, setOtherTeacherCourses] = useState<any[]>([]);
  const [cloneSourceId, setCloneSourceId] = useState("");

  // Assignments states
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignTemplate, setAssignTemplate] = useState("");
  const [assignPr, setAssignPr] = useState(false);
  const [assignGroup, setAssignGroup] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [selectedSubmissionsId, setSelectedSubmissionsId] = useState<string | null>(null);
  const [gradesCSVStatus, setGradesCSVStatus] = useState<Record<string, string>>({});
  const [visibleCommitsSubId, setVisibleCommitsSubId] = useState<string | null>(null);
  const [subCommits, setSubCommits] = useState<any[]>([]);

  // Announcements states
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState("");

  // Calendar render state
  const [calendarViewMode, setCalendarViewMode] = useState<"list" | "grid">("list");

  // Course Teacher states
  const [courseTeachers, setCourseTeachers] = useState<any[]>([]);
  const [allTeachersList, setAllTeachersList] = useState<any[]>([]);
  const [selectedNewTeacherId, setSelectedNewTeacherId] = useState("");

  // Fetch profiles and manage auth status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);
      try {
        let profileRes = await api("getProfile");
        if (!profileRes) {
          await new Promise((r) => setTimeout(r, 2000));
          profileRes = await api("getProfile");
        }
        
        const userProfile = profileRes as UserProfile;
        setProfile(userProfile);

        if (userProfile.account_status === "approved" || userProfile.role === "admin" || userProfile.role === "teacher") {
          if (userProfile.role === "admin") {
            setActiveTab("admin-courses");
          } else if (userProfile.role === "teacher") {
            setActiveTab("teacher-courses");
          } else {
            setActiveTab("student-courses");
          }
        }
      } catch (err: any) {
        console.error("Error loading profile:", err);
        setError("Error al cargar perfil de usuario: " + err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

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
          setGlobalSettings(res || {});
          setGlobalCalendarUrl(res?.globalCalendarIcsUrl || "");
        } else if (activeTab === "teacher-courses") {
          const res = await api("getTeacherCourses");
          setCourses(res || []);
        } else if (activeTab === "student-courses") {
          const res = await api("getStudentCourses");
          setCourses(res || []);
        } else if (activeTab === "profile" && profile) {
          setProfileMatricula(profile.matricula_unrn || "");
          setProfileCohorte(profile.cohorte || "");
        }
      } catch (err: any) {
        console.error("Error loading tab data:", err);
        setError("Error de red: " + err.message);
      } finally {
        setApiLoading(false);
      }
    };

    loadData();
  }, [activeTab, profile]);

  // Load course details subtabs
  useEffect(() => {
    if (!selectedCourse) return;
    const cid = selectedCourse.id || selectedCourse.course?.id;
    if (!cid) return;

    const loadSubTabData = async () => {
      setApiLoading(true);
      try {
        if (profile?.role === "teacher") {
          if (courseSubTab === "settings") {
            const res = await api("getCourseSettings", { courseId: cid });
            const data = res.data;
            setTeacherStartDate(data.start_date || "");
            setTeacherDuration(data.duration_weeks?.toString() || "");
            setTeacherCoverText(data.cover_text || "");
            setTeacherGithubToken(data.github_token || "");
            setTeacherExternalCalendars((data.external_calendars || []).join(", "));
            setTeacherSchedules(data.schedules || []);
            
            // Get other courses for cloning
            const otherCoursesRes = await api("getTeacherCourses");
            setOtherTeacherCourses(otherCoursesRes.filter((c: any) => c.id !== cid));
          } else if (courseSubTab === "schedules") {
            const res = await api("getCourseSettings", { courseId: cid });
            setTeacherClasses(res.data.class_instances || []);
          } else if (courseSubTab === "assignments") {
            const res = await api("getTeacherAssignments");
            const courseAssignments = (res.data || []).filter((a: any) => a.course_id === cid);
            setAssignments(courseAssignments);
          } else if (courseSubTab === "announcements") {
            const res = await api("getTeacherAnnouncements");
            const courseAnnouncements = (res.data || []).filter((a: any) => a.course_id === cid);
            setAnnouncements(courseAnnouncements);
          }
        } else if (profile?.role === "admin") {
          const detailRes = await api("getAdminCourseDetails", { courseId: cid });
          setTeacherClasses(detailRes?.class_instances || []);

          if (courseSubTab === "assignments") {
            setAssignments(detailRes?.assignments || []);
          } else if (courseSubTab === "teachers") {
            const tRes = await api("getCourseTeachers", { courseId: cid });
            setCourseTeachers(tRes || []);
            const uRes = await api("getAdminUsers");
            setAllTeachersList((uRes || []).filter((u: any) => u.role === "teacher"));
          }
        } else if (profile?.role === "teacher") {
          if (courseSubTab === "teachers") {
            const tRes = await api("getCourseTeachers", { courseId: cid });
            setCourseTeachers(tRes || []);
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
            setAnnouncements(annRes.data || []);
          }
        }
      } catch (err: any) {
        console.error("Error loading subtab data:", err);
      } finally {
        setApiLoading(false);
      }
    };

    loadSubTabData();
  }, [courseSubTab, selectedCourse, profile]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // Submit matricula validation (for pending students)
  const handleSubmitMatricula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^UNRN-\d{5,}$/.test(matriculaInput)) {
      setMatriculaError("Formato inválido. Debe ser UNRN- seguido de al menos 5 números.");
      return;
    }
    setMatriculaError("");
    setApiLoading(true);
    try {
      await api("submitMatricula", { matricula: matriculaInput });
      const profileRes = await api("getProfile");
      setProfile(profileRes);
      if (profileRes?.role === "student") {
        setActiveTab("student-courses");
      }
    } catch (err: any) {
      setError("Error al enviar la matrícula: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Admin Actions
  const handleApproveUser = async (uid: string) => {
    if (!confirm("¿Aprobar manualmente a este usuario?")) return;
    setApiLoading(true);
    try {
      await api("approveUser", { targetUid: uid });
      const res = await api("getAdminUsers");
      setUsers(res || []);
    } catch (err: any) {
      setError("Error al aprobar usuario: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleUpdateUserRole = async (uid: string, newRole: "admin" | "teacher" | "student") => {
    if (!confirm(`¿Estás seguro de que deseas cambiar el rol del usuario a ${newRole === "admin" ? "Administrador" : newRole === "teacher" ? "Profesor" : "Estudiante"}?`)) return;
    setApiLoading(true);
    try {
      await api("updateUserRole", { targetUid: uid, newRole });
      const res = await api("getAdminUsers");
      setUsers(res || []);
    } catch (err: any) {
      setError("Error al cambiar rol: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedCourse || !selectedNewTeacherId) return;
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      await api("assignTeacher", { courseId: cid, teacherId: selectedNewTeacherId });
      setSelectedNewTeacherId("");
      const tRes = await api("getCourseTeachers", { courseId: cid });
      setCourseTeachers(tRes || []);
    } catch (err: any) {
      setError("Error al asignar profesor: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    if (!selectedCourse) return;
    if (!confirm("¿Desasignar a este profesor de la cátedra?")) return;
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      await api("removeTeacher", { courseId: cid, teacherId });
      const tRes = await api("getCourseTeachers", { courseId: cid });
      setCourseTeachers(tRes || []);
    } catch (err: any) {
      setError("Error al desasignar profesor: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName) return;
    setApiLoading(true);
    try {
      await api("createCourse", { name: newCourseName, github_org: newCourseOrg });
      setNewCourseName("");
      setNewCourseOrg("");
      const res = await api("getAdminCourses");
      setCourses(res || []);
    } catch (err: any) {
      setError("Error al crear curso: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiLoading(true);
    try {
      await api("saveGlobalSettings", { globalCalendarIcsUrl: globalCalendarUrl });
      alert("Configuración guardada.");
    } catch (err: any) {
      setError("Error al guardar configuraciones: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Student Actions
  const handleEnrollCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollCode) return;
    setApiLoading(true);
    try {
      await api("enrollCourse", { code: enrollCode.toUpperCase().trim() });
      setEnrollCode("");
      const res = await api("getStudentCourses");
      setCourses(res || []);
      alert("¡Te has enrolado con éxito!");
    } catch (err: any) {
      alert("Error al enrolarse: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleAcceptAssignment = async (assignmentId: string, isGroup: boolean) => {
    let groupName = "";
    if (isGroup) {
      groupName = prompt("Esta es una tarea grupal. Ingresá el nombre de tu equipo (sin espacios ni caracteres raros):") || "";
      if (!groupName) return;
    }
    setApiLoading(true);
    try {
      await api("acceptAssignment", { assignmentId, groupName });
      alert("¡Repositorio de GitHub creado con éxito!");
      // Reload assignments
      const cid = selectedCourse.id || selectedCourse.course?.id;
      const aRes = await api("getStudentAssignments", { courseIds: [cid] });
      setAssignments(aRes.assignments || []);
      setSubmissions(aRes.submissions || []);
    } catch (err: any) {
      alert("Error al aceptar la tarea: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleMarkAsSubmitted = async (submissionId: string) => {
    const msg = prompt("¿Querés dejarle algún comentario al profesor sobre esta entrega? (Opcional)") || "";
    setApiLoading(true);
    try {
      await api("submitAssignment", { submissionId, message: msg });
      alert("¡Entrega enviada exitosamente!");
      const cid = selectedCourse.id || selectedCourse.course?.id;
      const aRes = await api("getStudentAssignments", { courseIds: [cid] });
      setAssignments(aRes.assignments || []);
      setSubmissions(aRes.submissions || []);
    } catch (err: any) {
      alert("Error al enviar la entrega: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleViewCommits = async (submissionId: string) => {
    if (visibleCommitsSubId === submissionId) {
      setVisibleCommitsSubId(null);
      return;
    }
    setApiLoading(true);
    try {
      const res = await api("getStudentCommits", { submissionId });
      setSubCommits(res || []);
      setVisibleCommitsSubId(submissionId);
    } catch (err: any) {
      alert("Error al cargar commits: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Teacher Schedule settings manipulation
  const handleAddSchedule = () => {
    if (!scheduleTime) return alert("Poné una hora válida.");
    setTeacherSchedules([...teacherSchedules, { day: scheduleDay, time: scheduleTime, type: scheduleType }]);
    setScheduleTime("");
  };

  const handleRemoveSchedule = (idx: number) => {
    setTeacherSchedules(teacherSchedules.filter((_, i) => i !== idx));
  };

  const handleGenerateClasses = () => {
    if (!teacherStartDate || !teacherDuration || teacherSchedules.length === 0) {
      alert("Primero configurá la fecha de inicio, duración en semanas y al menos un horario.");
      return;
    }
    if (!confirm("¿Seguro querés regenerar? Vas a perder los temas, links y estados especiales ya cargados.")) return;

    const [y, m, d] = teacherStartDate.split("-").map(Number);
    const baseDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayMap: Record<string, number> = { "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6 };

    let generated: ClassInstance[] = [];
    teacherSchedules.forEach((sch) => {
      const targetDay = dayMap[sch.day];
      if (targetDay === undefined) return;

      let currentDay = baseDate.getUTCDay();
      let diff = targetDay - currentDay;
      if (diff < 0) diff += 7;

      const firstClassDate = new Date(baseDate.getTime() + diff * 86400000);
      const [hh, mm] = (sch.time || "00:00").split(":").map(Number);
      firstClassDate.setUTCHours(hh, mm, 0);

      const durationWeeks = parseInt(teacherDuration);
      for (let i = 0; i < durationWeeks; i++) {
        const classDate = new Date(firstClassDate.getTime() + i * 7 * 86400000);
        generated.push({
          date: classDate.toISOString(),
          type: sch.type,
          topic: "",
          presentation_url: "",
          recording_url: "",
          special_status: "Normal",
          description: ""
        });
      }
    });

    generated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Map class number
    generated.forEach((ci, idx) => {
      ci.classNumber = idx + 1;
    });

    setTeacherClasses(generated);
  };

  const handleSaveTeacherSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      const durationNum = parseInt(teacherDuration);
      await api("updateCourseSettings", {
        courseId: cid,
        data: {
          cover_text: teacherCoverText,
          duration_weeks: isNaN(durationNum) ? null : durationNum,
          start_date: teacherStartDate,
          external_calendars: teacherExternalCalendars.split(",").map(c => c.trim()).filter(Boolean),
          github_token: teacherGithubToken,
          schedules: teacherSchedules
        }
      });
      alert("Configuración de cátedra guardada.");
    } catch (err: any) {
      alert("Error al guardar configuración: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleCloneCourseConfig = async () => {
    if (!cloneSourceId) return;
    if (!confirm("¿Seguro que querés clonar la configuración? Sobrescribirá tus horarios y duración.")) return;
    setApiLoading(true);
    try {
      const cid = selectedCourse.id || selectedCourse.course?.id;
      await api("cloneCourseExtraData", { sourceCourseId: cloneSourceId, targetCourseId: cid });
      // Reload settings tab
      const res = await api("getCourseSettings", { courseId: cid });
      const data = res.data;
      setTeacherStartDate(data.start_date || "");
      setTeacherDuration(data.duration_weeks?.toString() || "");
      setTeacherCoverText(data.cover_text || "");
      setTeacherGithubToken(data.github_token || "");
      setTeacherExternalCalendars((data.external_calendars || []).join(", "));
      setTeacherSchedules(data.schedules || []);
      alert("Configuración clonada exitosamente.");
    } catch (err: any) {
      alert("Error al clonar configuración: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleUpdateClassInstance = (idx: number, field: keyof ClassInstance, value: any) => {
    const updated = [...teacherClasses];
    updated[idx] = { ...updated[idx], [field]: value };
    setTeacherClasses(updated);
  };

  const handleSaveTeacherSchedule = async () => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      await api("updateCourseSettings", {
        courseId: cid,
        data: { class_instances: teacherClasses }
      });
      alert("Cronograma de clases guardado correctamente.");
    } catch (err: any) {
      alert("Error al guardar cronograma: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Teacher Assignments Actions
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTitle || !assignTemplate) return alert("Título y Repositorio Plantilla son obligatorios.");
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      if (editingAssignmentId) {
        await api("updateAssignment", {
          assignmentId: editingAssignmentId,
          data: {
            title: assignTitle,
            template_repo: assignTemplate,
            create_feedback_pr: assignPr,
            is_group: assignGroup
          }
        });
        setEditingAssignmentId(null);
        alert("Tarea modificada.");
      } else {
        await api("createAssignment", {
          course_id: cid,
          title: assignTitle,
          template_repo: assignTemplate,
          create_feedback_pr: assignPr,
          is_group: assignGroup
        });
        alert("Tarea creada exitosamente.");
      }
      setAssignTitle("");
      setAssignTemplate("");
      setAssignPr(false);
      setAssignGroup(false);

      const res = await api("getTeacherAssignments");
      setAssignments((res.data || []).filter((a: any) => a.course_id === cid));
    } catch (err: any) {
      alert("Error al gestionar tarea: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleArchiveAssignment = async (id: string) => {
    if (!confirm("¿Seguro que deseas archivar esta tarea? Los permisos en GitHub cambiarán a SOLO LECTURA.")) return;
    setApiLoading(true);
    try {
      const res = await api("archiveAssignment", { assignmentId: id });
      alert(`¡Tarea archivada! Permisos modificados en ${res.data.count} repositorios.`);
      const cid = selectedCourse.id || selectedCourse.course?.id;
      const r = await api("getTeacherAssignments");
      setAssignments((r.data || []).filter((a: any) => a.course_id === cid));
    } catch (err: any) {
      alert("Error al archivar la tarea: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleDownloadGradesTemplate = async (assignmentId: string, title: string) => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      const res = await api("getCourseRoster", { courseId: cid });
      if (!res.data || res.data.length === 0) {
        alert("No hay alumnos inscriptos en esta materia todavía.");
        return;
      }
      let csv = "Matricula,Email,Usuario_Github,Nota,Feedback\n";
      res.data.forEach((p: any) => {
        csv += `"${p.matricula_unrn || ""}","${p.email || ""}","${p.github_user || ""}","",""\n`;
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantilla_notas_${title.replace(/\s+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error al generar plantilla: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleImportCSVGrades = async (assignmentId: string, token: string, files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    setGradesCSVStatus({ ...gradesCSVStatus, [assignmentId]: "⏳ Subiendo notas..." });

    try {
      const text = await file.text();
      const res = await fetch(`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/importGrades?assignmentId=${assignmentId}&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text
      });
      
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setGradesCSVStatus({ ...gradesCSVStatus, [assignmentId]: `✅ Éxito: ${data.updatedCount || 0} notas cargadas.` });
    } catch (err: any) {
      setGradesCSVStatus({ ...gradesCSVStatus, [assignmentId]: "❌ Error: " + err.message });
    }
  };

  // Teacher Announcements Actions
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncementMessage) return;
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      await api("createAnnouncement", { course_id: cid, message: newAnnouncementMessage });
      setNewAnnouncementMessage("");
      const res = await api("getTeacherAnnouncements");
      setAnnouncements((res.data || []).filter((a: any) => a.course_id === cid));
      alert("Aviso enviado a la cátedra.");
    } catch (err: any) {
      alert("Error al enviar aviso: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Profile update state
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiLoading(true);
    try {
      await api("updateProfile", { matricula_unrn: profileMatricula, cohorte: profileCohorte });
      const profileRes = await api("getProfile");
      setProfile(profileRes);
      alert("Perfil actualizado correctamente.");
    } catch (err: any) {
      setError("Error al actualizar perfil: " + err.message);
    } finally {
      setApiLoading(false);
    }
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
      setCourseSubTab("schedules");
    } catch (err: any) {
      alert("Error al cargar detalles de la cátedra: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-blue-900 rounded-full animate-spin"></div>
          <p className="text-gray-400 font-medium">Cargando plataforma...</p>
        </div>
      </div>
    );
  }

  // PENDING APPROVAL VIEW
  if (profile && profile.account_status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.05)_0%,transparent_70%)] pointer-events-none"></div>
        <div className="w-full max-w-lg bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl relative z-10 text-center">
          <h2 className="text-2xl font-bold text-amber-500 mb-4">Registro en Proceso de Aprobación</h2>
          <p className="text-gray-300 text-sm mb-6">
            Para acceder como estudiante, es requisito validar tu número de matrícula de la UNRN (formato <strong>UNRN-######</strong>).
          </p>
          
          <form onSubmit={handleSubmitMatricula} className="space-y-4 max-w-md mx-auto">
            <input
              type="text"
              value={matriculaInput}
              onChange={(e) => setMatriculaInput(e.target.value)}
              placeholder="Ej: UNRN-12345"
              className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-center font-mono text-white"
              required
            />
            {matriculaError && (
              <p className="text-red-400 text-xs text-left">{matriculaError}</p>
            )}
            <button
              type="submit"
              disabled={apiLoading}
              className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 transition text-white font-medium py-3 rounded-xl shadow-lg shadow-amber-500/20 text-sm disabled:opacity-55"
            >
              {apiLoading ? "Enviando..." : "Validar Matrícula"}
            </button>
          </form>

          <div className="my-6 border-t border-neutral-800"></div>

          <p className="text-gray-400 text-xs mb-6">
            ¿No sos estudiante o no tenés matrícula?<br />
            Tu cuenta quedará en espera de aprobación manual por parte de un docente o administrador.
          </p>

          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-sm transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // Helper to group classes by weeks
  const getWeeklyClasses = (classes: ClassInstance[]) => {
    if (!classes || classes.length === 0) return {};
    const weeks: Record<number, ClassInstance[]> = {};
    
    // Find Monday of the first class week
    const firstClassDate = new Date(classes[0].date);
    const dayOfWeek = firstClassDate.getUTCDay();
    const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const baseMonday = new Date(firstClassDate);
    baseMonday.setUTCDate(baseMonday.getUTCDate() - offsetToMonday);
    baseMonday.setUTCHours(0,0,0,0);

    classes.forEach(ci => {
      const d = new Date(ci.date);
      const diffTime = Math.abs(d.getTime() - baseMonday.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekNumber = Math.floor(diffDays / 7) + 1;
      
      if (!weeks[weekNumber]) weeks[weekNumber] = [];
      weeks[weekNumber].push(ci);
    });

    return weeks;
  };

  const weeklyClassesGrouped = getWeeklyClasses(teacherClasses);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-neutral-900 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Gaula Classroom
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
            {profile?.role === "admin" ? "Administrador" : profile?.role === "teacher" ? "Profesor" : "Estudiante"}
          </p>
        </div>

        {/* User Badge */}
        <div className="flex items-center space-x-3 bg-neutral-950/50 p-3 rounded-xl border border-neutral-800">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white uppercase overflow-hidden text-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              profile?.full_name?.substring(0, 2) || "U"
            )}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold truncate">{profile?.full_name}</h4>
            <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {profile?.role === "admin" && (
            <>
              <button
                onClick={() => setActiveTab("admin-courses")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-courses" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Cátedras</span>
              </button>
              <button
                onClick={() => setActiveTab("admin-users")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-users" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Usuarios</span>
              </button>
              <button
                onClick={() => setActiveTab("admin-settings")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-settings" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Configuración</span>
              </button>
            </>
          )}

          {profile?.role === "teacher" && (
            <>
              <button
                onClick={() => setActiveTab("teacher-courses")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "teacher-courses" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Mis Cátedras</span>
              </button>
            </>
          )}

          {profile?.role === "student" && (
            <>
              <button
                onClick={() => setActiveTab("student-courses")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "student-courses" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Mis Cátedras</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
              activeTab === "profile" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
            }`}
          >
            <span>Mi Perfil</span>
          </button>
        </nav>

        <div className="border-t border-neutral-800 pt-4">
          <button
            onClick={handleLogout}
            className="w-full text-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/80 rounded-xl text-red-400 text-sm flex justify-between items-center animate-fade-in">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-xs text-gray-400 hover:text-white underline">
              Cerrar
            </button>
          </div>
        )}

        {apiLoading && (
          <div className="mb-6 p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-blue-400 text-sm flex items-center space-x-3 animate-pulse">
            <span className="w-4 h-4 border-2 border-t-transparent border-blue-500 rounded-full animate-spin"></span>
            <span>Sincronizando con base de datos remota...</span>
          </div>
        )}

        {/* 1. ADMIN COURSES */}
        {activeTab === "admin-courses" && !selectedCourse && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Gestión de Cátedras</h2>

            {/* Create course */}
            <form onSubmit={handleCreateCourse} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre de la Cátedra</label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Ej: Programación II"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Organización GitHub</label>
                <input
                  type="text"
                  value={newCourseOrg}
                  onChange={(e) => setNewCourseOrg(e.target.value)}
                  placeholder="Ej: unrn-prog2-2026"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl transition cursor-pointer"
              >
                Crear Nueva Cátedra
              </button>
            </form>

            {/* Courses List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((c) => (
                <div key={c.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between hover:border-neutral-700 transition">
                  <div>
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Organización: {c.github_org || "Ninguna"}</p>
                    <p className="text-xs text-amber-500 mt-1 font-mono">Código: {c.invite_code}</p>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => viewCourseDetails(c)}
                      className="px-4 py-2 bg-neutral-850 hover:bg-neutral-800 rounded-xl text-xs font-medium border border-neutral-800 transition cursor-pointer"
                    >
                      Ver Detalle
                    </button>
                  </div>
                </div>
              ))}
              {courses.length === 0 && (
                <p className="text-gray-500 text-sm col-span-2">No hay cátedras registradas en la base de datos.</p>
              )}
            </div>
          </div>
        )}

        {/* 2. ADMIN USERS */}
        {activeTab === "admin-users" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Usuarios Registrados</h2>
            <div className="overflow-x-auto bg-neutral-900/40 border border-neutral-800 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/40 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="p-4">Nombre</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4">Matrícula</th>
                    <th className="p-4">Cohorte</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850 text-sm text-gray-300">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="p-4 font-medium text-white">{u.full_name || "-"}</td>
                      <td className="p-4">{u.email}</td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value as any)}
                          className="bg-neutral-950/80 border border-neutral-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-white"
                        >
                          <option value="admin">Administrador</option>
                          <option value="teacher">Profesor</option>
                          <option value="student">Estudiante</option>
                        </select>
                      </td>
                      <td className="p-4 font-mono">{u.matricula_unrn || "-"}</td>
                      <td className="p-4">{u.cohorte || "-"}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.account_status === "approved" ? "bg-green-950/50 text-green-400" : "bg-amber-950/50 text-amber-400"
                        }`}>
                          {u.account_status === "approved" ? "Aprobado" : "Pendiente"}
                        </span>
                      </td>
                      <td className="p-4">
                        {u.account_status === "pending" && (
                          <button
                            onClick={() => handleApproveUser(u.id)}
                            className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Aprobar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. ADMIN SETTINGS */}
        {activeTab === "admin-settings" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Configuración Global del Sistema</h2>
            <form onSubmit={handleSaveSettings} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  URL de Calendario Global (.ics)
                </label>
                <input
                  type="url"
                  value={globalCalendarUrl}
                  onChange={(e) => setGlobalCalendarUrl(e.target.value)}
                  placeholder="https://example.com/calendar.ics"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer"
              >
                Guardar Configuración
              </button>
            </form>
          </div>
        )}

        {/* 4. TEACHER COURSES */}
        {activeTab === "teacher-courses" && !selectedCourse && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Mis Cátedras Asignadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((c) => (
                <div key={c.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between hover:border-neutral-700 transition">
                  <div>
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Organización: {c.github_org || "No vinculada"}</p>
                    <div className="mt-3 flex items-center space-x-2">
                      <span className="text-xs text-gray-400">Código de Invitación Estudiante:</span>
                      <span className="text-sm text-blue-400 font-mono font-bold tracking-wider">{c.invite_code}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => viewCourseDetails(c)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Ingresar a Cátedra
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. STUDENT COURSES */}
        {activeTab === "student-courses" && !selectedCourse && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <h2 className="text-2xl font-bold">Mis Cursadas</h2>
              
              <form onSubmit={handleEnrollCourse} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value)}
                  placeholder="Código Cátedra"
                  className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-blue-500 uppercase font-mono tracking-widest text-center text-white"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Unirse
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((c) => (
                <div key={c.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between hover:border-neutral-700 transition">
                  <div>
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Organización: {c.github_org || "No configurada"}</p>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => viewCourseDetails(c)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Ingresar
                    </button>
                  </div>
                </div>
              ))}
              {courses.length === 0 && (
                <p className="text-gray-500 text-sm">No te has inscripto en ninguna cátedra aún. Coloca el código provisto por tu profesor.</p>
              )}
            </div>
          </div>
        )}

        {/* 6. PROFILE TAB */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Datos Académicos y Perfil</h2>
            <form onSubmit={handleUpdateProfile} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre Completo</label>
                <input
                  type="text"
                  value={profile?.full_name || ""}
                  disabled
                  className="w-full bg-neutral-950/40 border border-neutral-850 rounded-xl px-4 py-2.5 text-sm text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Correo Primario</label>
                <input
                  type="text"
                  value={profile?.email || ""}
                  disabled
                  className="w-full bg-neutral-950/40 border border-neutral-850 rounded-xl px-4 py-2.5 text-sm text-gray-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Matrícula UNRN</label>
                  <input
                    type="text"
                    value={profileMatricula}
                    onChange={(e) => setProfileMatricula(e.target.value)}
                    placeholder="Ej: UNRN-12345"
                    className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cohorte / Año de Ingreso</label>
                  <input
                    type="text"
                    value={profileCohorte}
                    onChange={(e) => setProfileCohorte(e.target.value)}
                    placeholder="Ej: 2026"
                    className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer"
              >
                Guardar Cambios
              </button>
            </form>
          </div>
        )}

        {/* DETALLADA VISTA DE CÁTEDRA */}
        {selectedCourse && ["admin-courses", "teacher-courses", "student-courses"].includes(activeTab) && (
          <div className="space-y-6">
            {/* Header Detail */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-800 pb-4 gap-4">
              <div>
                <div className="flex items-center space-x-2 text-sm text-gray-400 mb-1">
                  <button onClick={() => setSelectedCourse(null)} className="hover:text-white underline transition">
                    Cátedras
                  </button>
                  <span>/</span>
                  <span className="text-gray-300 font-semibold">{selectedCourse.name}</span>
                </div>
                <h2 className="text-2xl font-bold">{selectedCourse.name}</h2>
              </div>

              {/* Subtabs controls */}
              <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 text-xs font-medium">
                <button
                  onClick={() => setCourseSubTab("schedules")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "schedules" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  Cronograma
                </button>
                <button
                  onClick={() => setCourseSubTab("assignments")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "assignments" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  Tareas
                </button>
                <button
                  onClick={() => setCourseSubTab("announcements")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "announcements" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  Avisos
                </button>
                {profile?.role === "teacher" && (
                  <button
                    onClick={() => setCourseSubTab("settings")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "settings" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    Ajustes Cátedra
                  </button>
                )}
                {(profile?.role === "admin" || profile?.role === "teacher") && (
                  <button
                    onClick={() => setCourseSubTab("teachers")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "teachers" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    Docentes
                  </button>
                )}
              </div>
            </div>

            {/* DETAIL CONTENT AREA BY SUBTAB */}

            {/* SUBTAB 1. CRONOGRAMA / CLASES */}
            {courseSubTab === "schedules" && (
              <div className="space-y-6">
                {profile?.role === "teacher" ? (
                  /* TEACHER VIEW: EDIT CRONOGRAMA */
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold">Gestión de Clases</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerateClasses}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold transition cursor-pointer text-amber-500"
                        >
                          🔄 Regenerar Clases
                        </button>
                        <button
                          onClick={handleSaveTeacherSchedule}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          💾 Guardar Cronograma
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {teacherClasses.map((ci, idx) => {
                        const dateObj = new Date(ci.date);
                        const dateStr = dateObj.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
                        const timeStr = dateObj.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

                        return (
                          <div
                            key={idx}
                            className={`p-6 rounded-2xl border ${
                              ci.special_status === "Feriado" ? "bg-neutral-950/40 border-neutral-900 opacity-60" : "bg-neutral-900/40 border-neutral-800"
                            } space-y-4`}
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-800 pb-3 gap-2">
                              <h4 className="font-bold text-white uppercase text-xs tracking-wider">
                                Clase {idx + 1}: {dateStr} - {timeStr} ({ci.type})
                              </h4>
                              <select
                                value={ci.special_status}
                                onChange={(e) => handleUpdateClassInstance(idx, "special_status", e.target.value)}
                                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-gray-300 focus:outline-none"
                              >
                                <option value="Normal">Normal</option>
                                <option value="Clase Remota">Clase Remota</option>
                                <option value="Examen">Examen</option>
                                <option value="Feriado">Feriado / Sin Clase</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tema Principal</label>
                                <input
                                  type="text"
                                  value={ci.topic}
                                  onChange={(e) => handleUpdateClassInstance(idx, "topic", e.target.value)}
                                  placeholder="Ej: Unidad 1: Git y GitHub"
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Descripción / Contenido</label>
                                <textarea
                                  value={ci.description || ""}
                                  onChange={(e) => handleUpdateClassInstance(idx, "description", e.target.value)}
                                  placeholder="Detalle o viñetas..."
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-white h-9"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Link Presentación / Material</label>
                                <input
                                  type="url"
                                  value={ci.presentation_url || ""}
                                  onChange={(e) => handleUpdateClassInstance(idx, "presentation_url", e.target.value)}
                                  placeholder="https://docs.google.com/..."
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Link Grabación Clase</label>
                                <input
                                  type="url"
                                  value={ci.recording_url || ""}
                                  onChange={(e) => handleUpdateClassInstance(idx, "recording_url", e.target.value)}
                                  placeholder="https://youtube.com/..."
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none text-white"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {teacherClasses.length === 0 && (
                        <p className="text-gray-500 text-sm">No hay clases creadas. Ve a la pestaña 'Ajustes Cátedra' para crearlas.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* STUDENT VIEW: CHRONOGRAM */
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold">Planificación de Clases</h3>
                      <button
                        onClick={() => {
                          const cid = selectedCourse.id || selectedCourse.course?.id;
                          window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(`${window.location.origin}/api/calendar?id=${cid}`)}`, "_blank");
                        }}
                        className="px-4 py-2 bg-purple-950/50 hover:bg-purple-900/50 border border-purple-800/80 rounded-xl text-xs font-bold text-purple-300 transition flex items-center space-x-2"
                      >
                        <span>📅 Suscribirse a Calendario</span>
                      </button>
                    </div>

                    <div className="space-y-6">
                      {Object.keys(weeklyClassesGrouped).map((weekNum) => (
                        <div key={weekNum} className="border border-neutral-800 bg-neutral-900/20 p-6 rounded-2xl space-y-4">
                          <h4 className="text-lg font-bold text-blue-400">Semana {weekNum}</h4>
                          <div className="space-y-3">
                            {weeklyClassesGrouped[parseInt(weekNum)].map((ci, index) => {
                              const d = new Date(ci.date);
                              const ds = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
                              
                              let tagClass = "bg-neutral-800 text-gray-400";
                              if (ci.special_status === "Clase Remota") tagClass = "bg-amber-950/60 text-amber-400 border border-amber-800/40";
                              if (ci.special_status === "Examen") tagClass = "bg-purple-950/60 text-purple-400 border border-purple-800/40";
                              if (ci.special_status === "Feriado") tagClass = "bg-red-950/60 text-red-400 border border-red-800/40";

                              return (
                                <div
                                  key={index}
                                  className={`p-4 rounded-xl border border-neutral-800/50 bg-neutral-950/30 ${
                                    ci.special_status === "Feriado" ? "opacity-60 line-through" : ""
                                  }`}
                                >
                                  <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{ds}</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${tagClass}`}>
                                      {ci.special_status === "Normal" ? ci.type : ci.special_status}
                                    </span>
                                  </div>
                                  <h5 className="font-semibold text-sm text-white">
                                    {ci.topic || ci.type}
                                  </h5>
                                  {ci.description && (
                                    <div 
                                      className="text-xs text-gray-400 mt-2 bg-neutral-950 p-3 rounded-lg border border-neutral-900 markdown-body"
                                      dangerouslySetInnerHTML={{ __html: marked.parse(ci.description) }}
                                    />
                                  )}
                                  
                                  <div className="mt-3 flex gap-4 text-xs font-semibold">
                                    {ci.presentation_url && (
                                      <a href={ci.presentation_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 underline">
                                        Material de Clase ↗
                                      </a>
                                    )}
                                    {ci.recording_url && (
                                      <a href={ci.recording_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 underline">
                                        Video Grabación ↗
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 2. TAREAS (ASSIGNMENTS) */}
            {courseSubTab === "assignments" && (
              <div className="space-y-6">
                {profile?.role === "teacher" ? (
                  /* TEACHER ASSIGNMENTS */
                  <div className="space-y-6">
                    {/* Create Assignment Form */}
                    <form onSubmit={handleCreateAssignment} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                      <h4 className="font-bold text-sm text-gray-400 uppercase tracking-wider">
                        {editingAssignmentId ? "✏️ Editar Tarea" : "➕ Crear Nueva Tarea"}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">Título de la Tarea</label>
                          <input
                            type="text"
                            value={assignTitle}
                            onChange={(e) => setAssignTitle(e.target.value)}
                            placeholder="Ej: Trabajo Práctico 1"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">Repositorio Plantilla (org/repo)</label>
                          <input
                            type="text"
                            value={assignTemplate}
                            onChange={(e) => setAssignTemplate(e.target.value)}
                            placeholder="Ej: unrn-prog2-2026/tp1-plantilla"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex space-x-6 items-center">
                        <label className="flex items-center space-x-2 text-xs font-semibold text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignPr}
                            onChange={(e) => setAssignPr(e.target.checked)}
                            className="rounded bg-neutral-950 border-neutral-800 text-blue-600 focus:ring-0"
                          />
                          <span>Crear Pull Request de Feedback</span>
                        </label>
                        <label className="flex items-center space-x-2 text-xs font-semibold text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignGroup}
                            onChange={(e) => setAssignGroup(e.target.checked)}
                            className="rounded bg-neutral-950 border-neutral-800 text-blue-600 focus:ring-0"
                          />
                          <span>Tarea Grupal</span>
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
                        >
                          {editingAssignmentId ? "Guardar Cambios" : "Crear Tarea"}
                        </button>
                        {editingAssignmentId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAssignmentId(null);
                              setAssignTitle("");
                              setAssignTemplate("");
                              setAssignPr(false);
                              setAssignGroup(false);
                            }}
                            className="px-5 py-2.5 bg-neutral-950 border border-neutral-800 text-gray-400 rounded-xl text-xs font-semibold transition"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </form>

                    {/* Assignments List */}
                    <div className="space-y-4">
                      {assignments.map((a) => (
                        <div key={a.id} className="p-6 bg-neutral-900/40 border border-neutral-800 rounded-2xl space-y-4">
                          <div className="flex justify-between items-start flex-wrap gap-2">
                            <div>
                              <h5 className="font-bold text-base text-white">
                                {a.title}
                                {a.is_group && (
                                  <span className="ml-2.5 px-2 py-0.5 rounded bg-blue-950 border border-blue-800/40 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                                    Grupal
                                  </span>
                                )}
                              </h5>
                              <p className="text-xs text-gray-500 mt-1">Plantilla: {a.template_repo}</p>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingAssignmentId(a.id);
                                  setAssignTitle(a.title);
                                  setAssignTemplate(a.template_repo);
                                  setAssignPr(a.create_feedback_pr || false);
                                  setAssignGroup(a.is_group || false);
                                }}
                                className="px-3 py-1.5 bg-amber-950/50 hover:bg-amber-900/50 border border-amber-800/60 rounded-lg text-[11px] font-semibold text-amber-300 transition"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleArchiveAssignment(a.id)}
                                className="px-3 py-1.5 bg-red-950/50 hover:bg-red-900/50 border border-red-800/60 rounded-lg text-[11px] font-semibold text-red-300 transition"
                              >
                                Archivar (Solo Lectura)
                              </button>
                            </div>
                          </div>

                          <div className="border-t border-neutral-800/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            {/* Import/Export grades */}
                            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                              <button
                                onClick={() => handleDownloadGradesTemplate(a.id, a.title)}
                                className="px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-gray-300 transition"
                              >
                                📥 Descargar Plantilla Notas
                              </button>
                              <div className="relative">
                                <input
                                  type="file"
                                  accept=".csv"
                                  id={`csv-file-${a.id}`}
                                  onChange={(e) => {
                                    const cid = selectedCourse.id || selectedCourse.course?.id;
                                    handleImportCSVGrades(a.id, selectedCourse.sync_secret || "TOKEN", e.target.files);
                                  }}
                                  className="hidden"
                                />
                                <label
                                  htmlFor={`csv-file-${a.id}`}
                                  className="px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-gray-300 transition inline-block text-center cursor-pointer"
                                >
                                  📤 Cargar Notas CSV
                                </label>
                              </div>
                            </div>

                            {/* Grading CSV sync message */}
                            {gradesCSVStatus[a.id] && (
                              <p className="text-xs font-semibold">{gradesCSVStatus[a.id]}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* STUDENT ASSIGNMENTS */
                  <div className="space-y-4">
                    {assignments.map((a) => {
                      const sub = submissions.find((s: any) => s.assignment_id === a.id);
                      return (
                        <div
                          key={a.id}
                          className={`p-6 rounded-2xl border ${
                            sub ? "bg-green-950/10 border-green-900/40" : "bg-neutral-900/30 border-neutral-800"
                          } space-y-4`}
                        >
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <h5 className="font-bold text-base text-white">
                              {sub ? "✅ " : "⏳ "} {a.title}
                              {a.is_group && (
                                <span className="ml-2.5 px-2 py-0.5 rounded bg-blue-950 border border-blue-800/40 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                                  Grupal
                                </span>
                              )}
                            </h5>

                            {sub && (
                              <span className="text-xs bg-neutral-950 border border-neutral-850 px-3 py-1 rounded-lg">
                                <strong>Nota:</strong> {sub.grade || <span className="text-gray-500">Sin calificar</span>}
                              </span>
                            )}
                          </div>

                          {sub ? (
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <a
                                  href={sub.repo_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold text-green-400 hover:underline"
                                >
                                  Ver mi repositorio en GitHub ↗
                                </a>
                                {sub.feedback && (
                                  <p className="text-xs text-gray-300">
                                    <strong>Feedback:</strong> {sub.feedback}
                                  </p>
                                )}
                              </div>

                              <div className="border-t border-neutral-850 pt-4 flex gap-2">
                                <button
                                  onClick={() => handleViewCommits(sub.id)}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
                                >
                                  🔍 Ver Commits
                                </button>
                                {sub.status !== "submitted" ? (
                                  <button
                                    onClick={() => handleMarkAsSubmitted(sub.id)}
                                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
                                  >
                                    🚀 Marcar como Entregado
                                  </button>
                                ) : (
                                  <span className="text-xs text-blue-400 font-bold px-3 py-1.5 bg-blue-950/40 border border-blue-900/40 rounded-xl">
                                    Entregado para Corrección
                                  </span>
                                )}
                              </div>

                              {/* Commit panel */}
                              {visibleCommitsSubId === sub.id && (
                                <div className="bg-neutral-950/80 p-4 rounded-xl border border-neutral-800 space-y-2 mt-2 max-h-52 overflow-y-auto font-mono text-[11px]">
                                  <h6 className="font-semibold text-gray-400 uppercase text-[9px] mb-1.5">Últimos Commits subidos:</h6>
                                  {subCommits.map((c: any, i: number) => (
                                    <div key={i} className="flex justify-between border-b border-neutral-900 pb-1.5 last:border-0 last:pb-0">
                                      <span className="text-blue-400">{c.sha.substring(0, 7)}: <span className="text-gray-300">{c.message}</span></span>
                                      <span className="text-gray-500">{new Date(c.date).toLocaleString("es-AR")}</span>
                                    </div>
                                  ))}
                                  {subCommits.length === 0 && (
                                    <p className="text-gray-600">No hay commits registrados en este repositorio todavía.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                                Aún no has aceptado esta tarea. Al hacer click abajo se creará tu repositorio académico personal o grupal en la organización de GitHub del curso.
                              </p>
                              <button
                                onClick={() => handleAcceptAssignment(a.id, a.is_group || false)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
                              >
                                Aceptar Tarea en GitHub
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {assignments.length === 0 && (
                      <p className="text-gray-550 text-sm">No hay tareas pendientes en este curso.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 3. AVISOS (ANNOUNCEMENTS) */}
            {courseSubTab === "announcements" && (
              <div className="space-y-6">
                {profile?.role === "teacher" && (
                  /* TEACHER SEND ANNOUNCEMENT */
                  <form onSubmit={handleCreateAnnouncement} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                    <h4 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Publicar Aviso a Alumnos</h4>
                    <div>
                      <textarea
                        value={newAnnouncementMessage}
                        onChange={(e) => setNewAnnouncementMessage(e.target.value)}
                        placeholder="Mensaje o temario del aviso (Soporta Markdown)..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-xs focus:outline-none text-white h-24 font-sans"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
                    >
                      Enviar Aviso
                    </button>
                  </form>
                )}

                {/* Announcements List */}
                <div className="space-y-4">
                  {announcements.map((a) => {
                    const dateStr = a.created_at
                      ? new Date(a.created_at._seconds * 1000).toLocaleString("es-AR")
                      : "Reciente";
                    return (
                      <div key={a.id} className="p-6 bg-neutral-900/40 border border-neutral-800 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                          <span className="text-xs font-bold text-blue-400">Aviso General</span>
                          <span className="text-[10px] text-gray-500 font-mono">{dateStr}</span>
                        </div>
                        <div 
                          className="text-xs text-gray-300 leading-relaxed font-sans markdown-body"
                          dangerouslySetInnerHTML={{ __html: marked.parse(a.message || "") }}
                        />
                      </div>
                    );
                  })}
                  {announcements.length === 0 && (
                    <p className="text-gray-550 text-sm">No hay avisos publicados en esta cátedra.</p>
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB 4. AJUSTES CÁTEDRA (TEACHERS ONLY) */}
            {courseSubTab === "settings" && profile?.role === "teacher" && (
              <div className="space-y-6">
                <form onSubmit={handleSaveTeacherSettings} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <h3 className="text-lg font-bold">Datos Generales</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Fecha de Inicio de Cursada</label>
                      <input
                        type="date"
                        value={teacherStartDate}
                        onChange={(e) => setTeacherStartDate(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Duración en Semanas</label>
                      <input
                        type="number"
                        value={teacherDuration}
                        onChange={(e) => setTeacherDuration(e.target.value)}
                        placeholder="Ej: 16"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">GitHub Personal Token (Con permisos para crear repositorios)</label>
                    <input
                      type="password"
                      value={teacherGithubToken}
                      onChange={(e) => setTeacherGithubToken(e.target.value)}
                      placeholder="ghp_..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Calendarios Externos ICS (URLs separadas por comas)</label>
                    <input
                      type="text"
                      value={teacherExternalCalendars}
                      onChange={(e) => setTeacherExternalCalendars(e.target.value)}
                      placeholder="https://example.com/calendar.ics"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Texto de Portada</label>
                    <textarea
                      value={teacherCoverText}
                      onChange={(e) => setTeacherCoverText(e.target.value)}
                      placeholder="Detalles sobre la cátedra..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white h-16"
                    />
                  </div>

                  {/* Schedules creation */}
                  <div className="border-t border-neutral-800/60 pt-4 space-y-4">
                    <h4 className="font-bold text-xs text-gray-400 uppercase tracking-wider">Horarios Semanales recurrentes</h4>
                    
                    <div className="flex flex-wrap gap-2 items-end bg-neutral-950 p-4 rounded-xl border border-neutral-850">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Día</label>
                        <select
                          value={scheduleDay}
                          onChange={(e) => setScheduleDay(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
                        >
                          <option value="Lunes">Lunes</option>
                          <option value="Martes">Martes</option>
                          <option value="Miércoles">Miércoles</option>
                          <option value="Jueves">Jueves</option>
                          <option value="Viernes">Viernes</option>
                          <option value="Sábado">Sábado</option>
                          <option value="Domingo">Domingo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hora Inicio</label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo clase</label>
                        <select
                          value={scheduleType}
                          onChange={(e) => setScheduleType(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
                        >
                          <option value="Teoría">Teoría</option>
                          <option value="Práctica">Práctica</option>
                          <option value="Laboratorio">Laboratorio</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSchedule}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition"
                      >
                        Añadir Horario
                      </button>
                    </div>

                    <div className="space-y-2">
                      {teacherSchedules.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-neutral-950 border border-neutral-850 p-3 rounded-lg text-xs">
                          <span><strong>{s.day}</strong> a las <strong>{s.time}</strong> ({s.type})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSchedule(idx)}
                            className="bg-red-950/40 text-red-400 hover:bg-red-900/40 border border-red-800/45 px-2.5 py-1 rounded transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition"
                  >
                    Guardar Configuración
                  </button>
                </form>

                {/* CSV grading synchronization */}
                <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <h3 className="text-lg font-bold">Sincronización de Planilla de Notas</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Usa esta URL para sincronizar las notas de tus alumnos de esta cátedra directamente en tu planilla externa:
                  </p>
                  <input
                    type="text"
                    value={`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/exportGradesCsv?courseId=${selectedCourse.id || selectedCourse.course?.id}&token=${selectedCourse.sync_secret || "TOKEN"}`}
                    disabled
                    className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-amber-500 font-mono"
                  />
                </div>

                {/* Clone course settings from another course */}
                {otherTeacherCourses.length > 0 && (
                  <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                    <h3 className="text-lg font-bold">Clonar Ajustes de Otra Cátedra</h3>
                    <div className="flex gap-2">
                      <select
                        value={cloneSourceId}
                        onChange={(e) => setCloneSourceId(e.target.value)}
                        className="bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white flex-1 focus:outline-none"
                      >
                        <option value="">Selecciona cátedra origen...</option>
                        {otherTeacherCourses.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleCloneCourseConfig}
                        disabled={!cloneSourceId}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                      >
                        Clonar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 5. DOCENTES (ADMIN & TEACHER) */}
            {courseSubTab === "teachers" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Docentes Asignados</h3>
                </div>

                {profile?.role === "admin" && (
                  <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                    <h4 className="text-sm font-semibold text-white">Asignar Nuevo Profesor</h4>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Seleccionar Profesor</label>
                        <select
                          value={selectedNewTeacherId}
                          onChange={(e) => setSelectedNewTeacherId(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Selecciona un profesor...</option>
                          {allTeachersList
                            .filter(t => !courseTeachers.some(ct => ct.teacher_id === t.id))
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.full_name} ({t.email})
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        onClick={handleAssignTeacher}
                        disabled={!selectedNewTeacherId}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Asignar Profesor
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto bg-neutral-900/40 border border-neutral-800 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950/40 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <th className="p-4">Nombre</th>
                        <th className="p-4">Email</th>
                        {profile?.role === "admin" && <th className="p-4">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850 text-sm text-gray-300">
                      {courseTeachers.map((ct) => (
                        <tr key={ct.teacher_id}>
                          <td className="p-4 font-medium text-white">{ct.profiles?.full_name || "Docente"}</td>
                          <td className="p-4">{ct.profiles?.email || "-"}</td>
                          {profile?.role === "admin" && (
                            <td className="p-4">
                              <button
                                onClick={() => handleRemoveTeacher(ct.teacher_id)}
                                className="text-red-500 hover:text-red-400 text-xs font-semibold underline"
                              >
                                Desasignar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {courseTeachers.length === 0 && (
                        <tr>
                          <td colSpan={profile?.role === "admin" ? 3 : 2} className="p-4 text-gray-500 text-center">
                            No hay profesores asignados a esta cátedra.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
