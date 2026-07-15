"use client";

import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db, functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import { marked } from "marked";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, updateDoc, getDoc, getDocs, writeBatch, arrayUnion, arrayRemove } from "firebase/firestore";
import AdminPanel from "@/components/dashboard/AdminPanel";
import StudentPanel from "@/components/dashboard/StudentPanel";
import ProfilePanel from "@/components/dashboard/ProfilePanel";
import TeacherPanel from "@/components/dashboard/TeacherPanel";

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
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem("theme") as "light" | "dark" : null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
    }
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

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

  // Grader & GitHub activity states
  const [graderSubmissions, setGraderSubmissions] = useState<Record<string, any[]>>({});
  const [expandedGraderAssignmentId, setExpandedGraderAssignmentId] = useState<string | null>(null);
  const [githubActivitySubmissionId, setGithubActivitySubmissionId] = useState<string | null>(null);
  const [githubActivityData, setGithubActivityData] = useState<{ commits: any[], pullRequests: any[], comments: any[] } | null>(null);
  const [githubActivityLoading, setGithubActivityLoading] = useState(false);
  const [githubActivityTab, setGithubActivityTab] = useState<"commits" | "pulls" | "comments">("commits");
  const [editingGrades, setEditingGrades] = useState<Record<string, string>>({});
  const [editingFeedbacks, setEditingFeedbacks] = useState<Record<string, string>>({});
  const [expandedAuditLogs, setExpandedAuditLogs] = useState<Record<string, any[]>>({});
  const [courseSubmissions, setCourseSubmissions] = useState<any[]>([]);
  const [studentGithubActivity, setStudentGithubActivity] = useState<{ commits: any[], pullRequests: any[], comments: any[] } | null>(null);
  const [studentGithubActivityTab, setStudentGithubActivityTab] = useState<"commits" | "pulls" | "comments">("commits");

  // QR Attendance states
  const [teacherActiveQr, setTeacherActiveQr] = useState<{ code: string; classNumber: number; expiresIn: number } | null>(null);
  const [studentActiveAttendanceClass, setStudentActiveAttendanceClass] = useState<number | null>(null);
  const [studentQrToken, setStudentQrToken] = useState("");
  const [studentAttendanceGeoLoading, setStudentAttendanceGeoLoading] = useState(false);

  // Announcements states
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState("");

  // Calendar render state
  const [calendarViewMode, setCalendarViewMode] = useState<"list" | "grid">("list");

  // Course Teacher states
  const [courseTeachers, setCourseTeachers] = useState<any[]>([]);
  const [allTeachersList, setAllTeachersList] = useState<any[]>([]);
  const [selectedNewTeacherId, setSelectedNewTeacherId] = useState("");

  // Announcement Acknowledgement states
  const [visibleAcksId, setVisibleAcksId] = useState<string | null>(null);
  const [announcementAcks, setAnnouncementAcks] = useState<any[]>([]);

  // Class Q&A Comments states
  const [courseComments, setCourseComments] = useState<any[]>([]);
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});
  const [newCommentTexts, setNewCommentTexts] = useState<Record<number, string>>({});

  // Attendance states
  const [courseAttendance, setCourseAttendance] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [activeAttendanceClass, setActiveAttendanceClass] = useState<number | null>(null);
  const [editingAttendanceRecords, setEditingAttendanceRecords] = useState<Record<string, "present" | "absent" | "late">>({});

  useEffect(() => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) {
      setRoster([]);
      return;
    }
    api("getCourseRoster", { courseId: cid })
      .then((res) => {
        setRoster(res || []);
      })
      .catch((err) => {
        console.error("Error loading roster:", err);
      });
  }, [selectedCourse]);

  useEffect(() => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) {
      setCourseAttendance([]);
      return;
    }
    const q = collection(db, "courses", cid, "attendance");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const att = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCourseAttendance(att);
    }, (err) => {
      console.error("Error loading attendance:", err);
    });
    return () => unsubscribe();
  }, [selectedCourse]);

  useEffect(() => {
    if (!teacherActiveQr) return;
    const interval = setInterval(() => {
      setTeacherActiveQr(prev => {
        if (!prev) return null;
        if (prev.expiresIn <= 1) {
          clearInterval(interval);
          return null;
        }
        return { ...prev, expiresIn: prev.expiresIn - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [teacherActiveQr]);

  const handleGenerateAttendanceQr = async (classNumber: number) => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      let lat: number | null = null;
      let lng: number | null = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (geoErr) {
          console.warn("Geolocation denied or timed out:", geoErr);
        }
      }

      const activeQrRef = doc(db, "courses", cid, "active_qr", "current");
      await setDoc(activeQrRef, {
        token: code,
        classNumber,
        lat,
        lng,
        created_at: serverTimestamp()
      });
      
      setTeacherActiveQr({
        code,
        classNumber,
        expiresIn: 300
      });
    } catch (err: any) {
      alert("Error al generar QR de asistencia: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleSubmitStudentAttendanceQr = async (classNumber: number) => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    setStudentAttendanceGeoLoading(true);
    
    let lat: number | null = null;
    let lng: number | null = null;
    
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (err) {
        console.warn("Geolocation unavailable or denied:", err);
      }
    }
    
    setStudentAttendanceGeoLoading(false);
    
    try {
      await api("submitQrAttendance", {
        courseId: cid,
        classNumber,
        token: studentQrToken.trim().toUpperCase(),
        lat,
        lng
      });
      alert("¡Asistencia registrada con éxito! Ya estás presente.");
      setStudentActiveAttendanceClass(null);
      setStudentQrToken("");
    } catch (err: any) {
      alert("Error al registrar asistencia: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleSaveAttendance = async (classNumber: number) => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid || !profile) return;
    try {
      const docRef = doc(db, "courses", cid, "attendance", `class_${classNumber}`);
      await setDoc(docRef, {
        classNumber,
        records: editingAttendanceRecords,
        updated_at: serverTimestamp(),
        updated_by: profile.id
      });
      alert("Asistencia guardada con éxito.");
      setActiveAttendanceClass(null);
    } catch (err: any) {
      alert("Error al guardar asistencia: " + err.message);
    }
  };

  const startTakingAttendance = (classNumber: number) => {
    const docId = `class_${classNumber}`;
    const existing = courseAttendance.find(a => a.id === docId);
    const initialRecords: Record<string, "present" | "absent" | "late"> = {};
    roster.forEach(student => {
      initialRecords[student.id] = existing?.records?.[student.id] || "present";
    });
    setEditingAttendanceRecords(initialRecords);
    setActiveAttendanceClass(classNumber);
  };

  const toggleComments = (idx: number) => {
    setExpandedComments(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  useEffect(() => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) {
      setCourseComments([]);
      return;
    }
    
    const q = query(
      collection(db, "courses", cid, "class_comments"),
      orderBy("created_at", "asc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCourseComments(comments);
    }, (err) => {
      console.error("Error loading comments:", err);
    });
    
    return () => unsubscribe();
  }, [selectedCourse]);

  const handleAddComment = async (classNumber: number) => {
    const text = newCommentTexts[classNumber]?.trim();
    if (!text) return;
    
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid || !profile) return;
    
    try {
      await addDoc(collection(db, "courses", cid, "class_comments"), {
        classNumber,
        user_id: profile.id,
        user_name: profile.full_name || profile.email,
        user_role: profile.role,
        content: text,
        created_at: serverTimestamp()
      });
      setNewCommentTexts(prev => ({ ...prev, [classNumber]: "" }));
    } catch (err: any) {
      alert("Error al enviar comentario: " + err.message);
    }
  };

  const handleToggleReaction = async (commentId: string, reactionType: "thumbs_up" | "party" | "heart") => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid || !profile) return;
    
    const commentRef = doc(db, "courses", cid, "class_comments", commentId);
    try {
      const commentDoc = await getDoc(commentRef);
      if (!commentDoc.exists()) return;
      
      const data = commentDoc.data();
      const currentReactions = data.reactions?.[reactionType] || [];
      const hasReacted = currentReactions.includes(profile.id);
      
      await updateDoc(commentRef, {
        [`reactions.${reactionType}`]: hasReacted
          ? arrayRemove(profile.id)
          : arrayUnion(profile.id)
      });
    } catch (err: any) {
      console.error("Error toggling reaction:", err);
    }
  };

  const handleMarkBestAnswer = async (commentId: string, classNumber: number, currentStatus: boolean) => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid || !profile) return;
    if (profile.role !== "teacher" && profile.role !== "admin") return;
    
    try {
      const q = query(
        collection(db, "courses", cid, "class_comments"),
        where("classNumber", "==", classNumber),
        where("is_best_answer", "==", true)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, { is_best_answer: false });
      });
      
      const targetRef = doc(db, "courses", cid, "class_comments", commentId);
      batch.update(targetRef, { is_best_answer: !currentStatus });
      
      await batch.commit();
    } catch (err: any) {
      alert("Error al marcar mejor respuesta: " + err.message);
    }
  };

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
            const data = res?.data || {};
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

          if (courseSubTab === "assignments") {
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

  const handleAcknowledgeAnnouncement = async (announcementId: string) => {
    setApiLoading(true);
    try {
      await api("acknowledgeAnnouncement", { announcementId });
      const cid = selectedCourse.id || selectedCourse.course?.id;
      const annRes = await api("getStudentAnnouncements", { courseIds: [cid] });
      setAnnouncements(annRes || []);
    } catch (err: any) {
      setError("Error al confirmar recepción: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleToggleAcks = async (announcementId: string) => {
    if (visibleAcksId === announcementId) {
      setVisibleAcksId(null);
      setAnnouncementAcks([]);
    } else {
      setApiLoading(true);
      try {
        const res = await api("getAnnouncementAcknowledgements", { announcementId });
        setAnnouncementAcks(res || []);
        setVisibleAcksId(announcementId);
      } catch (err: any) {
        setError("Error al cargar acuses de recibo: " + err.message);
      } finally {
        setApiLoading(false);
      }
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
      setStudentGithubActivity(null);
      return;
    }
    setApiLoading(true);
    setStudentGithubActivityTab("commits");
    try {
      const res = await api("getStudentGithubActivity", { submissionId });
      setStudentGithubActivity(res || { commits: [], pullRequests: [], comments: [] });
      setVisibleCommitsSubId(submissionId);
    } catch (err: any) {
      alert("Error al cargar actividad de GitHub: " + err.message);
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

  const handleToggleGrader = async (assignmentId: string) => {
    if (expandedGraderAssignmentId === assignmentId) {
      setExpandedGraderAssignmentId(null);
      return;
    }
    setApiLoading(true);
    try {
      const res = await api("getAssignmentSubmissions", { assignmentId });
      setGraderSubmissions(prev => ({ ...prev, [assignmentId]: res || [] }));
      setExpandedGraderAssignmentId(assignmentId);
      
      const grades: Record<string, string> = {};
      const feedbacks: Record<string, string> = {};
      (res || []).forEach((s: any) => {
        grades[s.id] = s.grade || "";
        feedbacks[s.id] = s.feedback || "";
      });
      setEditingGrades(prev => ({ ...prev, ...grades }));
      setEditingFeedbacks(prev => ({ ...prev, ...feedbacks }));
    } catch (err: any) {
      alert("Error al cargar entregas: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleFetchGithubActivity = async (submissionId: string) => {
    if (githubActivitySubmissionId === submissionId) {
      setGithubActivitySubmissionId(null);
      setGithubActivityData(null);
      return;
    }
    setGithubActivityLoading(true);
    setGithubActivitySubmissionId(submissionId);
    setGithubActivityTab("commits");
    try {
      const res = await api("getStudentGithubActivity", { submissionId });
      setGithubActivityData(res || { commits: [], pullRequests: [], comments: [] });
    } catch (err: any) {
      alert("Error al cargar actividad de GitHub: " + err.message);
      setGithubActivitySubmissionId(null);
      setGithubActivityData(null);
    } finally {
      setGithubActivityLoading(false);
    }
  };

  const handleSaveSingleGrade = async (submissionId: string, assignmentId: string) => {
    const grade = editingGrades[submissionId];
    const feedback = editingFeedbacks[submissionId];
    setApiLoading(true);
    try {
      await api("gradeSubmission", { submissionId, grade, feedback });
      alert("Calificación guardada con éxito.");
      const res = await api("getAssignmentSubmissions", { assignmentId });
      setGraderSubmissions(prev => ({ ...prev, [assignmentId]: res || [] }));
    } catch (err: any) {
      alert("Error al guardar calificación: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleToggleAuditLogs = async (submissionId: string) => {
    if (expandedAuditLogs[submissionId]) {
      setExpandedAuditLogs(prev => {
        const next = { ...prev };
        delete next[submissionId];
        return next;
      });
      return;
    }
    
    try {
      const q = query(
        collection(db, "audit_logs"),
        where("submission_id", "==", submissionId),
        orderBy("created_at", "desc")
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpandedAuditLogs(prev => ({ ...prev, [submissionId]: logs }));
    } catch (err: any) {
      alert("Error al cargar auditoría: " + err.message);
    }
  };

  const loadAllCourseSubmissions = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid || assignments.length === 0) return;
    
    try {
      const allSubs: any[] = [];
      await Promise.all(assignments.map(async (a) => {
        const q = query(collection(db, "submissions"), where("assignment_id", "==", a.id));
        const snap = await getDocs(q);
        snap.forEach((doc) => {
          allSubs.push({ id: doc.id, ...doc.data() });
        });
      }));
      setCourseSubmissions(allSubs);
    } catch (err) {
      console.error("Error loading course submissions for alerts:", err);
    }
  };

  useEffect(() => {
    if (courseSubTab === "students") {
      loadAllCourseSubmissions();
    }
  }, [courseSubTab]);

  const handleDownloadGradesTemplate = async (assignmentId: string, title: string) => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      const res = await api("getCourseRoster", { courseId: cid });
      if (!res || res.length === 0) {
        alert("No hay alumnos inscriptos en esta materia todavía.");
        return;
      }
      let csv = "Matricula,Email,Usuario_Github,Nota,Feedback\n";
      res.forEach((p: any) => {
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

  const handleExportGradesMatrix = () => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    if (!cid) return;
    if (roster.length === 0) {
      alert("No hay alumnos inscriptos en esta materia todavía.");
      return;
    }
    
    try {
      let csv = "Nombre,Email,Matricula,";
      assignments.forEach(a => {
        csv += `"${a.title.replace(/"/g, '""')}",`;
      });
      csv += "Promedio,Asistencia,Alertas,Condicion\n";
      
      roster.forEach(student => {
        // Name, Email, Matricula
        csv += `"${(student.full_name || "").replace(/"/g, '""')}","${student.email || ""}","${student.matricula_unrn || ""}",`;
        
        let totalGradesSum = 0;
        let gradesCount = 0;
        
        // Assignments columns
        assignments.forEach(a => {
          const sub = courseSubmissions.find(s => s.student_id === student.id && s.assignment_id === a.id);
          const gradeVal = sub ? sub.grade : "";
          csv += `"${(gradeVal || "").replace(/"/g, '""')}",`;
          
          const num = parseFloat(gradeVal);
          if (!isNaN(num)) {
            totalGradesSum += num;
            gradesCount++;
          }
        });
        
        // Numerical Average
        const avg = gradesCount > 0 ? (totalGradesSum / gradesCount).toFixed(2) : "-";
        
        // Attendance percentage
        const studentAtts = courseAttendance.filter(c => c.records && c.records[student.id]);
        const recordedCount = studentAtts.length;
        const presentOrLate = studentAtts.filter(c => c.records[student.id] === "present" || c.records[student.id] === "late").length;
        const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
        const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;
        
        // Missing assignments
        const studentSubmissions = courseSubmissions.filter(s => s.student_id === student.id);
        const hasMissingAssignments = assignments.some(a => {
          const hasSub = studentSubmissions.some(s => s.assignment_id === a.id);
          const isPastDue = a.due_date ? new Date() > new Date(a.due_date) : false;
          return !hasSub && isPastDue;
        });
        
        // Alerts summary string
        const alertsArr = [];
        if (hasCriticalAttendance) alertsArr.push("Asistencia Critica");
        if (hasMissingAssignments) alertsArr.push("Tareas Atrasadas");
        const alertsStr = alertsArr.length > 0 ? alertsArr.join(" | ") : "Ninguna";
        
        // Condition status
        const cond = (hasCriticalAttendance || hasMissingAssignments) ? "EN RIESGO" : "REGULAR";
        
        csv += `"${avg}","${attendanceRate.toFixed(0)}%","${alertsStr}","${cond}"\n`;
      });
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `planilla_notas_y_alertas_${selectedCourse.name.replace(/\s+/g, "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error al exportar planilla: " + err.message);
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
      setAnnouncements((res || []).filter((a: any) => a.course_id === cid));
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
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col md:flex-row transition-colors duration-200">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-bg-secondary border-b md:border-b-0 md:border-r border-border-custom flex flex-col p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Gaula Classroom
          </h1>
          <p className="text-xs text-text-secondary mt-1 uppercase tracking-wider font-semibold">
            {profile?.role === "admin" ? "Administrador" : profile?.role === "teacher" ? "Profesor" : "Estudiante"}
          </p>
        </div>

        {/* User Badge */}
        <div className="flex items-center space-x-3 bg-bg-primary/50 p-3 rounded-xl border border-border-custom">
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

        <div className="border-t border-border-custom pt-4 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full text-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-bg-tertiary text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center justify-center space-x-2 border border-border-custom"
          >
            <span>{theme === "light" ? "🌙 Modo Oscuro" : "☀️ Modo Claro"}</span>
          </button>
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

        {/* ADMIN TABS COMPONENT */}
        {profile?.role === "admin" && (
          <AdminPanel
            activeTab={activeTab}
            courses={courses}
            users={users}
            globalCalendarUrl={globalCalendarUrl}
            setGlobalCalendarUrl={setGlobalCalendarUrl}
            newCourseName={newCourseName}
            setNewCourseName={setNewCourseName}
            newCourseOrg={newCourseOrg}
            setNewCourseOrg={setNewCourseOrg}
            handleCreateCourse={handleCreateCourse}
            handleUpdateUserRole={handleUpdateUserRole}
            handleApproveUser={handleApproveUser}
            handleSaveSettings={handleSaveSettings}
            viewCourseDetails={viewCourseDetails}
          />
        )}

        {/* TEACHER TABS COMPONENT */}
        {!selectedCourse && (
          <TeacherPanel
            activeTab={activeTab}
            courses={courses}
            viewCourseDetails={viewCourseDetails}
          />
        )}

        {/* STUDENT TABS COMPONENT */}
        {!selectedCourse && (
          <StudentPanel
            activeTab={activeTab}
            courses={courses}
            enrollCode={enrollCode}
            setEnrollCode={setEnrollCode}
            handleEnrollCourse={handleEnrollCourse}
            viewCourseDetails={viewCourseDetails}
          />
        )}

        {/* PROFILE TAB COMPONENT */}
        <ProfilePanel
          activeTab={activeTab}
          profile={profile}
          profileMatricula={profileMatricula}
          setProfileMatricula={setProfileMatricula}
          profileCohorte={profileCohorte}
          setProfileCohorte={setProfileCohorte}
          handleUpdateProfile={handleUpdateProfile}
        />

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
                    onClick={() => setCourseSubTab("students")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "students" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    👥 Alumnos y Alertas
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

            {profile?.role === "student" && (() => {
              const studentComments = courseComments.filter(c => c.user_id === profile?.id);
              const commentPoints = studentComments.length * 10;
              const solutionPoints = studentComments.filter(c => c.is_best_answer).length * 100;

              const studentAtts = courseAttendance.filter(c => c.records && c.records[profile?.id]);
              const attendancePoints = studentAtts.filter(c => c.records[profile?.id] === "present" || c.records[profile?.id] === "late").length * 10;

              const studentSubmissions = submissions.filter(s => s.student_id === profile?.id);
              let submissionPoints = studentSubmissions.length * 50;
              studentSubmissions.forEach(s => {
                const num = parseFloat(s.grade);
                if (!isNaN(num)) {
                  submissionPoints += num * 5;
                }
              });

              const totalXp = commentPoints + solutionPoints + attendancePoints + submissionPoints;
              const currentLevel = Math.floor(totalXp / 100) + 1;
              const currentLevelProgress = totalXp % 100;
              
              let gradesSum = 0;
              let gradesCount = 0;
              studentSubmissions.forEach(s => {
                const num = parseFloat(s.grade);
                if (!isNaN(num)) {
                  gradesSum += num;
                  gradesCount++;
                }
              });
              const avgGrade = gradesCount > 0 ? gradesSum / gradesCount : 0;
              const hasChakraMaster = avgGrade >= 9;

              const presentCount = studentAtts.filter(c => c.records[profile?.id] === "present" || c.records[profile?.id] === "late").length;
              const totalClasses = studentAtts.length;
              const hasPerfectAttendance = totalClasses >= 3 && presentCount === totalClasses;

              const hasActiveNinja = studentComments.length >= 3;
              const hasSolucionador = studentComments.some(c => c.is_best_answer);

              return (
                <div className="bg-gradient-to-r from-blue-955/20 via-neutral-900/60 to-purple-955/20 border border-neutral-800 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-lg animate-fade-in">
                  <div className="space-y-2.5 flex-1">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl animate-bounce">🥷</span>
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest font-sans">Rango Ninja de Cursada</h4>
                        <div className="text-lg font-black text-blue-400">
                          Nivel {currentLevel} — {currentLevel >= 5 ? "Jōnin" : currentLevel >= 3 ? "Chūnin" : "Genin"}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 font-mono">
                        <span>Progreso de Nivel ({totalXp} XP Totales)</span>
                        <span>{currentLevelProgress} / 100 XP</span>
                      </div>
                      <div className="w-full h-2 bg-neutral-950 border border-neutral-850 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${currentLevelProgress}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 min-w-[200px]">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Medallas de Honor</h4>
                    <div className="flex flex-wrap gap-2">
                      {hasChakraMaster && (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-955/60 border border-amber-800/40 text-amber-400 text-[10px] font-bold flex items-center space-x-1.5" title="Promedio de notas superior a 9">
                          <span>🥇 Maestro de Chakra</span>
                        </span>
                      )}
                      {hasPerfectAttendance && (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-955/60 border border-emerald-800/40 text-emerald-400 text-[10px] font-bold flex items-center space-x-1.5" title="Asistencia perfecta a todas las clases registradas">
                          <span>🥈 Asistencia Perfecta</span>
                        </span>
                      )}
                      {hasActiveNinja && (
                        <span className="px-2.5 py-1 rounded-xl bg-blue-955/60 border border-blue-800/40 text-blue-400 text-[10px] font-bold flex items-center space-x-1.5" title="Participación activa en foros de clases">
                          <span>🥉 Ninja Activo</span>
                        </span>
                      )}
                      {hasSolucionador && (
                        <span className="px-2.5 py-1 rounded-xl bg-purple-955/60 border border-purple-800/40 text-purple-400 text-[10px] font-bold flex items-center space-x-1.5" title="Respuestas marcadas como solución por el docente">
                          <span>🎖️ Solucionador</span>
                        </span>
                      )}
                      {!hasChakraMaster && !hasPerfectAttendance && !hasActiveNinja && !hasSolucionador && (
                        <span className="text-xs text-gray-500 italic">Participa y entrega tareas para ganar medallas.</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

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
                            
                            <div className="border-t border-neutral-800/80 pt-4 mt-4 space-y-4">
                              <div className="flex justify-between items-center">
                                <button
                                  type="button"
                                  onClick={() => toggleComments(ci.classNumber || (idx + 1))}
                                  className="text-amber-500 hover:text-amber-400 underline text-xs font-semibold focus:outline-none cursor-pointer flex items-center gap-1.5"
                                >
                                  💬 Foro de Consultas ({courseComments.filter(c => c.classNumber === (ci.classNumber || (idx + 1))).length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startTakingAttendance(ci.classNumber || (idx + 1))}
                                  className="px-3 py-1 bg-blue-955/50 hover:bg-blue-900/50 border border-blue-800 text-blue-300 rounded-lg text-[10px] font-bold transition flex items-center space-x-1.5"
                                >
                                  <span>📋 Control de Asistencia</span>
                                </button>
                              </div>

                              {/* Collapsible Attendance Section */}
                              {activeAttendanceClass === (ci.classNumber || (idx + 1)) && (
                                <div className="mt-4 bg-neutral-950 border border-neutral-850 p-4 rounded-xl space-y-4">
                                  <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                                    <h6 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Tomar Asistencia (Clase {ci.classNumber || (idx + 1)})</h6>
                                    <div className="flex gap-2.5 items-center">
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateAttendanceQr(ci.classNumber || (idx + 1))}
                                        className="px-2.5 py-1 bg-emerald-955/50 border border-emerald-800 text-emerald-300 hover:bg-emerald-900/50 rounded text-[10px] font-bold transition cursor-pointer"
                                      >
                                        🛡️ Generar QR Dinámico
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveAttendanceClass(null)}
                                        className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {roster.map((student) => {
                                      const currentVal = editingAttendanceRecords[student.id] || "present";
                                      return (
                                        <div key={student.id} className="flex justify-between items-center text-xs py-1.5 border-b border-neutral-900/60 last:border-b-0">
                                          <div className="flex flex-col">
                                            <span className="font-semibold text-white">{student.full_name || student.email}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">Matrícula: {student.matricula_unrn || "-"}</span>
                                          </div>
                                          <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                                            <button
                                              type="button"
                                              onClick={() => setEditingAttendanceRecords(prev => ({ ...prev, [student.id]: "present" }))}
                                              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                                                currentVal === "present"
                                                  ? "bg-green-600 text-white"
                                                  : "text-gray-400 hover:text-white"
                                              }`}
                                            >
                                              Presente
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingAttendanceRecords(prev => ({ ...prev, [student.id]: "late" }))}
                                              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                                                currentVal === "late"
                                                  ? "bg-amber-600 text-white"
                                                  : "text-gray-400 hover:text-white"
                                              }`}
                                            >
                                              Tarde
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingAttendanceRecords(prev => ({ ...prev, [student.id]: "absent" }))}
                                              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                                                currentVal === "absent"
                                                  ? "bg-red-600 text-white"
                                                  : "text-gray-400 hover:text-white"
                                              }`}
                                            >
                                              Ausente
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {roster.length === 0 && (
                                      <p className="text-xs text-gray-500 italic">No hay estudiantes inscriptos en el curso.</p>
                                    )}
                                  </div>

                                  <div className="flex justify-end gap-2 pt-2 border-t border-neutral-850">
                                    <button
                                      type="button"
                                      onClick={() => setActiveAttendanceClass(null)}
                                      className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-gray-400 rounded-xl text-xs font-semibold transition"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveAttendance(ci.classNumber || (idx + 1))}
                                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Collapsible Comments Section */}
                              {expandedComments[ci.classNumber || (idx + 1)] && (
                                <div className="space-y-4">
                                  {/* Comments List */}
                                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                    {courseComments
                                      .filter((c) => c.classNumber === (ci.classNumber || (idx + 1)))
                                      .map((comment: any) => (
                                        <div
                                          key={comment.id}
                                          className={`p-3.5 rounded-xl space-y-2 border transition ${
                                            comment.is_best_answer
                                              ? "border-emerald-500 bg-emerald-950/15"
                                              : "bg-neutral-950/60 border-neutral-850"
                                          }`}
                                        >
                                          <div className="flex justify-between items-center text-[10px]">
                                            <div className="flex items-center space-x-2">
                                              <span className={`font-bold ${comment.user_role === 'teacher' ? 'text-amber-400' : 'text-blue-400'}`}>
                                                {comment.user_name} ({comment.user_role === 'teacher' ? 'Profesor' : 'Estudiante'})
                                              </span>
                                              {comment.is_best_answer && (
                                                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-[8px] font-bold uppercase tracking-wider">
                                                  ✔️ Solución
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-gray-500">
                                              {comment.created_at?.toDate
                                                ? comment.created_at.toDate().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                                                : "Enviando..."}
                                            </span>
                                          </div>
                                          <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                                          
                                          <div className="flex justify-between items-center pt-2 mt-1 border-t border-neutral-900/60 text-[10px]">
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                onClick={() => handleToggleReaction(comment.id, "thumbs_up")}
                                                className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer text-[10px] ${
                                                  (comment.reactions?.thumbs_up || []).includes(profile?.id)
                                                    ? "bg-blue-950/40 border-blue-800 text-blue-400 font-bold"
                                                    : "bg-neutral-900/40 border-neutral-850 text-gray-500 hover:text-gray-305"
                                                }`}
                                              >
                                                👍 {(comment.reactions?.thumbs_up || []).length}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleToggleReaction(comment.id, "party")}
                                                className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer text-[10px] ${
                                                  (comment.reactions?.party || []).includes(profile?.id)
                                                    ? "bg-purple-950/40 border-purple-800 text-purple-400 font-bold"
                                                    : "bg-neutral-900/40 border-neutral-850 text-gray-500 hover:text-gray-305"
                                                }`}
                                              >
                                                🎉 {(comment.reactions?.party || []).length}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleToggleReaction(comment.id, "heart")}
                                                className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer text-[10px] ${
                                                  (comment.reactions?.heart || []).includes(profile?.id)
                                                    ? "bg-red-955/20 border-red-800 text-red-400 font-bold"
                                                    : "bg-neutral-900/40 border-neutral-850 text-gray-500 hover:text-gray-305"
                                                }`}
                                              >
                                                ❤️ {(comment.reactions?.heart || []).length}
                                              </button>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() => handleMarkBestAnswer(comment.id, ci.classNumber || (idx + 1), comment.is_best_answer || false)}
                                              className={`text-[9px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                                                comment.is_best_answer
                                                  ? "bg-emerald-950/50 border-emerald-800 text-emerald-400"
                                                  : "bg-neutral-900/50 border-neutral-850 text-gray-400 hover:text-white"
                                              }`}
                                            >
                                              {comment.is_best_answer ? "Desmarcar Solución" : "Marcar como Solución"}
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    {courseComments.filter((c) => c.classNumber === (ci.classNumber || (idx + 1))).length === 0 && (
                                      <p className="text-xs text-gray-500 italic">No hay consultas en esta clase todavía.</p>
                                    )}
                                  </div>

                                  {/* Add Comment Input */}
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={newCommentTexts[ci.classNumber || (idx + 1)] || ""}
                                      onChange={(e) => setNewCommentTexts(prev => ({ ...prev, [ci.classNumber || (idx + 1)]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleAddComment(ci.classNumber || (idx + 1));
                                        }
                                      }}
                                      placeholder="Escribe una respuesta o aviso..."
                                      className="flex-1 bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddComment(ci.classNumber || (idx + 1))}
                                      className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded-xl text-xs transition cursor-pointer"
                                    >
                                      Responder
                                    </button>
                                  </div>
                                </div>
                              )}
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

                              // Look up student attendance for this class
                              const attDoc = courseAttendance.find(a => a.classNumber === (ci.classNumber || 0));
                              const studentStatus = attDoc?.records?.[profile?.id || ""];

                              return (
                                <div
                                  key={index}
                                  className={`p-4 rounded-xl border border-neutral-800/50 bg-neutral-950/30 ${
                                    ci.special_status === "Feriado" ? "opacity-60 line-through" : ""
                                  }`}
                                >
                                  <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{ds}</span>
                                    <div className="flex items-center space-x-2">
                                      {studentStatus && (
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          studentStatus === "present"
                                            ? "bg-green-950/60 text-green-400 border border-green-800/40"
                                            : studentStatus === "late"
                                            ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                                            : "bg-red-950/60 text-red-400 border border-red-800/40"
                                        }`}>
                                          {studentStatus === "present" ? "Presente" : studentStatus === "late" ? "Tarde" : "Ausente"}
                                        </span>
                                      )}
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${tagClass}`}>
                                        {ci.special_status === "Normal" ? ci.type : ci.special_status}
                                      </span>
                                    </div>
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
                                    <button
                                      onClick={() => toggleComments(ci.classNumber || 0)}
                                      className="text-amber-500 hover:text-amber-400 underline font-semibold focus:outline-none cursor-pointer text-xs"
                                    >
                                      💬 Foro ({courseComments.filter(c => c.classNumber === (ci.classNumber || 0)).length})
                                    </button>
                                    {profile?.role === "student" && studentStatus !== "present" && studentStatus !== "late" && (
                                      <button
                                        type="button"
                                        onClick={() => setStudentActiveAttendanceClass(ci.classNumber || 0)}
                                        className="text-emerald-500 hover:text-emerald-400 underline font-semibold focus:outline-none cursor-pointer text-xs"
                                      >
                                        📷 Firmar Presente QR
                                      </button>
                                    )}
                                  </div>

                                  {/* Collapsible Comments Section */}
                                  {expandedComments[ci.classNumber || 0] && (
                                    <div className="mt-4 border-t border-neutral-800/80 pt-4 space-y-4">
                                      <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Foro de Consultas</h6>
                                      
                                      {/* Comments List */}
                                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                        {courseComments
                                          .filter((c) => c.classNumber === (ci.classNumber || 0))
                                          .map((comment: any) => (
                                            <div
                                              key={comment.id}
                                              className={`p-3.5 rounded-xl space-y-2 border transition ${
                                                comment.is_best_answer
                                                  ? "border-emerald-500 bg-emerald-950/15"
                                                  : "bg-neutral-950/60 border-neutral-850"
                                              }`}
                                            >
                                              <div className="flex justify-between items-center text-[10px]">
                                                <div className="flex items-center space-x-2">
                                                  <span className={`font-bold ${comment.user_role === 'teacher' ? 'text-amber-400' : 'text-blue-400'}`}>
                                                    {comment.user_name} ({comment.user_role === 'teacher' ? 'Profesor' : 'Estudiante'})
                                                  </span>
                                                  {comment.is_best_answer && (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-[8px] font-bold uppercase tracking-wider">
                                                      ✔️ Solución
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="text-gray-500">
                                                  {comment.created_at?.toDate
                                                    ? comment.created_at.toDate().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                                                    : "Enviando..."}
                                                </span>
                                              </div>
                                              <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                                              
                                              <div className="flex pt-2 mt-1 border-t border-neutral-900/60 text-[10px] gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleReaction(comment.id, "thumbs_up")}
                                                  className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer text-[10px] ${
                                                    (comment.reactions?.thumbs_up || []).includes(profile?.id)
                                                      ? "bg-blue-950/40 border-blue-800 text-blue-400 font-bold"
                                                      : "bg-neutral-900/40 border-neutral-850 text-gray-500 hover:text-gray-305"
                                                  }`}
                                                >
                                                  👍 {(comment.reactions?.thumbs_up || []).length}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleReaction(comment.id, "party")}
                                                  className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer text-[10px] ${
                                                    (comment.reactions?.party || []).includes(profile?.id)
                                                      ? "bg-purple-950/40 border-purple-800 text-purple-400 font-bold"
                                                      : "bg-neutral-900/40 border-neutral-850 text-gray-500 hover:text-gray-305"
                                                  }`}
                                                >
                                                  🎉 {(comment.reactions?.party || []).length}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleReaction(comment.id, "heart")}
                                                  className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer text-[10px] ${
                                                    (comment.reactions?.heart || []).includes(profile?.id)
                                                      ? "bg-red-955/20 border-red-800 text-red-400 font-bold"
                                                      : "bg-neutral-900/40 border-neutral-850 text-gray-500 hover:text-gray-305"
                                                  }`}
                                                >
                                                  ❤️ {(comment.reactions?.heart || []).length}
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        {courseComments.filter((c) => c.classNumber === (ci.classNumber || 0)).length === 0 && (
                                          <p className="text-xs text-gray-500 italic">No hay consultas en esta clase todavía.</p>
                                        )}
                                      </div>

                                      {/* Add Comment Input */}
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={newCommentTexts[ci.classNumber || 0] || ""}
                                          onChange={(e) => setNewCommentTexts(prev => ({ ...prev, [ci.classNumber || 0]: e.target.value }))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleAddComment(ci.classNumber || 0);
                                            }
                                          }}
                                          placeholder="Escribe tu consulta o duda..."
                                          className="flex-1 bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                          onClick={() => handleAddComment(ci.classNumber || 0)}
                                          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded-xl text-xs transition cursor-pointer"
                                        >
                                          Enviar
                                        </button>
                                      </div>
                                    </div>
                                  )}
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
                              <button
                                type="button"
                                onClick={() => handleToggleGrader(a.id)}
                                className="px-3 py-2 bg-blue-955/50 hover:bg-blue-900/50 border border-blue-800 rounded-xl text-xs font-semibold text-blue-300 transition cursor-pointer"
                              >
                                {expandedGraderAssignmentId === a.id ? "📂 Ocultar Entregas" : "📂 Ver Entregas y Actividad"}
                              </button>
                            </div>

                            {/* Grading CSV sync message */}
                            {gradesCSVStatus[a.id] && (
                              <p className="text-xs font-semibold">{gradesCSVStatus[a.id]}</p>
                            )}
                          </div>

                          {/* Collapsible Grader & Submissions List */}
                          {expandedGraderAssignmentId === a.id && (
                            <div className="border-t border-neutral-800/60 pt-6 mt-6 space-y-6">
                              <h6 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Entregas de los Estudiantes</h6>
                              
                              <div className="space-y-4">
                                {(graderSubmissions[a.id] || []).map((sub) => {
                                  const studentName = sub.profiles?.full_name || sub.profiles?.email || "Estudiante";
                                  const isGitHubLoaded = githubActivitySubmissionId === sub.id;
                                  
                                  return (
                                    <div key={sub.id} className="bg-neutral-950/60 border border-neutral-850 p-5 rounded-2xl space-y-4 text-left">
                                      <div className="flex justify-between items-start flex-wrap gap-2">
                                        <div>
                                          <h6 className="font-bold text-sm text-white">{studentName}</h6>
                                          <p className="text-[10px] text-gray-500 font-mono">Matrícula: {sub.profiles?.matricula_unrn || "-"}</p>
                                          {sub.repo_url && (
                                            <a
                                              href={sub.repo_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                                            >
                                              GitHub: {sub.repo_url.replace("https://github.com/", "")} ↗
                                            </a>
                                          )}
                                        </div>
                                        
                                        <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-[10px] font-bold">
                                          <span className={`px-2.5 py-1 rounded ${
                                            sub.status === "submitted" ? "bg-blue-950 text-blue-400" : "bg-neutral-800 text-gray-400"
                                          }`}>
                                            {sub.status === "submitted" ? "Entregado" : "Borrador"}
                                          </span>
                                        </div>
                                      </div>

                                      {/* View GitHub activity toggle */}
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => handleFetchGithubActivity(sub.id)}
                                          className="text-xs text-emerald-400 hover:text-emerald-300 underline font-semibold focus:outline-none flex items-center gap-1.5 cursor-pointer"
                                        >
                                          🔍 {isGitHubLoaded ? "Ocultar Actividad GitHub" : "Ver Actividad GitHub (Commits, PRs, Comentarios)"}
                                        </button>
                                      </div>

                                      {/* GitHub Activity Tabbed Panel */}
                                      {isGitHubLoaded && (
                                        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-4 mt-2 space-y-4 font-sans text-xs">
                                          {githubActivityLoading ? (
                                            <div className="flex items-center space-x-2 text-gray-500 animate-pulse py-2">
                                              <span className="w-3.5 h-3.5 border-2 border-t-transparent border-emerald-400 rounded-full animate-spin"></span>
                                              <span>Cargando actividad desde GitHub...</span>
                                            </div>
                                          ) : githubActivityData ? (
                                            <div className="space-y-4">
                                              {/* Sub-tabs */}
                                              <div className="flex border-b border-neutral-900 pb-2 gap-4">
                                                <button
                                                  type="button"
                                                  onClick={() => setGithubActivityTab("commits")}
                                                  className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
                                                    githubActivityTab === "commits"
                                                      ? "border-emerald-500 text-emerald-400"
                                                      : "border-transparent text-gray-400 hover:text-white"
                                                  }`}
                                                >
                                                  Commits ({githubActivityData.commits.length})
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setGithubActivityTab("pulls")}
                                                  className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
                                                    githubActivityTab === "pulls"
                                                      ? "border-emerald-500 text-emerald-400"
                                                      : "border-transparent text-gray-400 hover:text-white"
                                                  }`}
                                                >
                                                  Pull Requests ({githubActivityData.pullRequests.length})
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setGithubActivityTab("comments")}
                                                  className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
                                                    githubActivityTab === "comments"
                                                      ? "border-emerald-500 text-emerald-400"
                                                      : "border-transparent text-gray-400 hover:text-white"
                                                  }`}
                                                >
                                                  Comentarios ({githubActivityData.comments.length})
                                                </button>
                                              </div>

                                              {/* Commits Tab */}
                                              {githubActivityTab === "commits" && (
                                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 font-mono text-[10px]">
                                                  {githubActivityData.commits.map((c: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between border-b border-neutral-900/60 pb-1.5 last:border-0 last:pb-0">
                                                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-mono text-[10px]">
                                                        {c.sha.substring(0, 7)}: <span className="text-gray-300 font-sans">{c.message}</span>
                                                      </a>
                                                      <span className="text-gray-500">{new Date(c.date).toLocaleString("es-AR")}</span>
                                                    </div>
                                                  ))}
                                                  {githubActivityData.commits.length === 0 && (
                                                    <p className="text-gray-500 italic">No hay commits registrados en este repositorio.</p>
                                                  )}
                                                </div>
                                              )}

                                              {/* Pull Requests Tab */}
                                              {githubActivityTab === "pulls" && (
                                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                  {githubActivityData.pullRequests.map((p: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center border-b border-neutral-900/60 pb-1.5 last:border-0 last:pb-0">
                                                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                                        #{p.number}: <span className="text-gray-300 font-semibold">{p.title}</span>
                                                      </a>
                                                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                                        p.state === "open" ? "bg-green-950 text-green-400" : "bg-purple-950 text-purple-400"
                                                      }`}>
                                                        {p.state === "open" ? "Abierto" : "Cerrado"}
                                                      </span>
                                                    </div>
                                                  ))}
                                                  {githubActivityData.pullRequests.length === 0 && (
                                                    <p className="text-gray-500 italic">No hay pull requests abiertos o cerrados.</p>
                                                  )}
                                                </div>
                                              )}

                                              {/* Comments Tab */}
                                              {githubActivityTab === "comments" && (
                                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                  {githubActivityData.comments.map((c: any, idx: number) => (
                                                    <div key={idx} className="bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-900 space-y-1">
                                                      <div className="flex justify-between items-center text-[10px] text-gray-500">
                                                        <span className="font-bold text-gray-400">@{c.author}</span>
                                                        <span>{new Date(c.created_at).toLocaleString("es-AR")}</span>
                                                      </div>
                                                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{c.body}</p>
                                                    </div>
                                                  ))}
                                                  {githubActivityData.comments.length === 0 && (
                                                    <p className="text-gray-500 italic">No hay comentarios en el código o pull requests.</p>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <p className="text-gray-500">No se pudo cargar la actividad.</p>
                                          )}
                                        </div>
                                      )}

                                      {/* Grading Form */}
                                      <div className="border-t border-neutral-900/60 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                        <div>
                                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nota</label>
                                          <input
                                            type="text"
                                            value={editingGrades[sub.id] || ""}
                                            onChange={(e) => setEditingGrades(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                            placeholder="Nota (Ej: 9, Aprobado)"
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-white"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Feedback / Comentario</label>
                                          <input
                                            type="text"
                                            value={editingFeedbacks[sub.id] || ""}
                                            onChange={(e) => setEditingFeedbacks(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                            placeholder="Buen trabajo..."
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-white"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveSingleGrade(sub.id, a.id)}
                                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-xl transition cursor-pointer"
                                        >
                                          Guardar Calificación
                                        </button>
                                      </div>

                                      {/* Audit logs trigger */}
                                      <div className="pt-3">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAuditLogs(sub.id)}
                                          className="text-gray-500 hover:text-gray-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                        >
                                          📜 {expandedAuditLogs[sub.id] ? "Ocultar Bitácora de Auditoría" : "Ver Bitácora de Auditoría"}
                                        </button>
                                        
                                        {expandedAuditLogs[sub.id] && (
                                          <div className="mt-2 bg-neutral-950/80 border border-neutral-850 rounded-xl p-3 space-y-2">
                                            <h6 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Historial de Calificaciones (Inmutable)</h6>
                                            <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                                              {expandedAuditLogs[sub.id].map((log) => (
                                                <div key={log.id} className="text-[10.5px] border-b border-neutral-900 pb-2 last:border-b-0 space-y-1">
                                                  <div className="flex justify-between text-gray-500">
                                                    <span>Modificado por: <strong className="text-gray-300">{log.actor_name}</strong></span>
                                                    <span>
                                                      {log.created_at?.toDate
                                                        ? log.created_at.toDate().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                                                        : "Ahora"}
                                                    </span>
                                                  </div>
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                                                    <div>
                                                      <span className="text-[9px] text-gray-500 block uppercase font-bold">Cambio de Nota</span>
                                                      <span className="text-gray-400 font-mono">
                                                        {log.previous_grade || "(sin nota)"} ➔ <strong className="text-amber-400">{log.new_grade}</strong>
                                                      </span>
                                                    </div>
                                                    <div>
                                                      <span className="text-[9px] text-gray-500 block uppercase font-bold">Cambio de Feedback</span>
                                                      <p className="text-gray-400 italic">
                                                        "{log.previous_feedback || "(sin feedback)"}" ➔ <strong className="text-gray-300">"{log.new_feedback}"</strong>
                                                      </p>
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                              {expandedAuditLogs[sub.id].length === 0 && (
                                                <p className="text-[10px] text-gray-500 italic">No hay registros de auditoría para esta entrega.</p>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {(!graderSubmissions[a.id] || graderSubmissions[a.id].length === 0) && (
                                  <p className="text-xs text-gray-500 italic">No hay entregas registradas para esta tarea aún.</p>
                                )}
                              </div>
                            </div>
                          )}
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

                              {/* GitHub Activity Tabbed Panel */}
                              {visibleCommitsSubId === sub.id && (
                                <div className="bg-neutral-950/80 border border-neutral-850 p-4 rounded-xl space-y-4 text-xs mt-3">
                                  {studentGithubActivity ? (
                                    <div className="space-y-4 text-left">
                                      {/* Sub-tabs */}
                                      <div className="flex border-b border-neutral-900 pb-2 gap-4">
                                        <button
                                          type="button"
                                          onClick={() => setStudentGithubActivityTab("commits")}
                                          className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
                                            studentGithubActivityTab === "commits"
                                              ? "border-emerald-500 text-emerald-400"
                                              : "border-transparent text-gray-400 hover:text-white"
                                          }`}
                                        >
                                          Commits ({studentGithubActivity.commits.length})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setStudentGithubActivityTab("pulls")}
                                          className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
                                            studentGithubActivityTab === "pulls"
                                              ? "border-emerald-500 text-emerald-400"
                                              : "border-transparent text-gray-400 hover:text-white"
                                          }`}
                                        >
                                          Pull Requests ({studentGithubActivity.pullRequests.length})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setStudentGithubActivityTab("comments")}
                                          className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
                                            studentGithubActivityTab === "comments"
                                              ? "border-emerald-500 text-emerald-400"
                                              : "border-transparent text-gray-400 hover:text-white"
                                          }`}
                                        >
                                          Comentarios ({studentGithubActivity.comments.length})
                                        </button>
                                      </div>

                                      {/* Commits Tab */}
                                      {studentGithubActivityTab === "commits" && (
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 font-mono text-[10px]">
                                          {studentGithubActivity.commits.map((c: any, idx: number) => (
                                            <div key={idx} className="flex justify-between border-b border-neutral-900/60 pb-1.5 last:border-0 last:pb-0">
                                              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-mono text-[10px]">
                                                {c.sha.substring(0, 7)}: <span className="text-gray-300 font-sans">{c.message}</span>
                                              </a>
                                              <span className="text-gray-500">{new Date(c.date).toLocaleString("es-AR")}</span>
                                            </div>
                                          ))}
                                          {studentGithubActivity.commits.length === 0 && (
                                            <p className="text-gray-500 italic">No hay commits registrados en tu repositorio.</p>
                                          )}
                                        </div>
                                      )}

                                      {/* Pull Requests Tab */}
                                      {studentGithubActivityTab === "pulls" && (
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                          {studentGithubActivity.pullRequests.map((p: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center border-b border-neutral-900/60 pb-1.5 last:border-0 last:pb-0">
                                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                                #{p.number}: <span className="text-gray-300 font-semibold">{p.title}</span>
                                              </a>
                                              <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                                p.state === "open" ? "bg-green-950 text-green-400" : "bg-purple-950 text-purple-400"
                                              }`}>
                                                {p.state === "open" ? "Abierto" : "Cerrado"}
                                              </span>
                                            </div>
                                          ))}
                                          {studentGithubActivity.pullRequests.length === 0 && (
                                            <p className="text-gray-500 italic">No hay pull requests abiertos o cerrados.</p>
                                          )}
                                        </div>
                                      )}

                                      {/* Comments Tab */}
                                      {studentGithubActivityTab === "comments" && (
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                          {studentGithubActivity.comments.map((c: any, idx: number) => (
                                            <div key={idx} className="bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-900 space-y-1">
                                              <div className="flex justify-between items-center text-[10px] text-gray-500">
                                                <span className="font-bold text-gray-400 font-sans">@{c.author}</span>
                                                <span>{new Date(c.created_at).toLocaleString("es-AR")}</span>
                                              </div>
                                              <p className="text-xs text-gray-300 whitespace-pre-wrap">{c.body}</p>
                                            </div>
                                          ))}
                                          {studentGithubActivity.comments.length === 0 && (
                                            <p className="text-gray-500 italic">No hay comentarios en tu código o pull requests.</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-2 text-gray-500 animate-pulse py-2">
                                      <span className="w-3.5 h-3.5 border-2 border-t-transparent border-emerald-400 rounded-full animate-spin"></span>
                                      <span>Cargando actividad...</span>
                                    </div>
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

            {/* SUBTAB ALUMNOS Y ALERTAS */}
            {courseSubTab === "students" && (
              <div className="space-y-6">
                <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">Alumnos y Alertas de Desempeño</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Seguimiento en tiempo real del presentismo y cumplimiento de tareas de los estudiantes inscriptos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportGradesMatrix}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
                    >
                      <span>📊 Exportar Planilla (Sheets)</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto bg-neutral-950/40 border border-neutral-850 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-950/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          <th className="p-4">Estudiante</th>
                          <th className="p-4">Matrícula</th>
                          <th className="p-4">Asistencia</th>
                          <th className="p-4">Tareas Entregadas</th>
                          <th className="p-4">Alertas Tempranas</th>
                          <th className="p-4">Condición</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-850 text-xs text-gray-300">
                        {roster.map((student) => {
                          const studentAtts = courseAttendance.filter(c => c.records && c.records[student.id]);
                          const recordedCount = studentAtts.length;
                          const presentOrLate = studentAtts.filter(c => c.records[student.id] === "present" || c.records[student.id] === "late").length;
                          const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
                          const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

                          const studentSubmissions = courseSubmissions.filter(s => s.student_id === student.id);
                          const submittedCount = studentSubmissions.length;
                          const totalAssignments = assignments.length;
                          const hasMissingAssignments = assignments.some(a => {
                            const hasSub = studentSubmissions.some(s => s.assignment_id === a.id);
                            const isPastDue = a.due_date ? new Date() > new Date(a.due_date) : false;
                            return !hasSub && isPastDue;
                          });

                          const isAtRisk = hasCriticalAttendance || hasMissingAssignments;

                          return (
                            <tr key={student.id} className="hover:bg-neutral-900/30 transition-colors">
                              <td className="p-4">
                                <div className="font-semibold text-white">{student.full_name || "Estudiante"}</div>
                                <div className="text-[10px] text-gray-500">{student.email}</div>
                              </td>
                              <td className="p-4 font-mono text-gray-400">{student.matricula_unrn || "No provista"}</td>
                              <td className="p-4 space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span>{presentOrLate} / {recordedCount} clases</span>
                                  <span className={attendanceRate < 75 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                                    {attendanceRate.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="w-24 h-1.5 bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${attendanceRate < 75 ? "bg-red-500" : "bg-emerald-500"}`}
                                    style={{ width: `${Math.min(100, attendanceRate)}%` }}
                                  ></div>
                                </div>
                              </td>
                              <td className="p-4 space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span>{submittedCount} / {totalAssignments} tareas</span>
                                  <span className="text-gray-400 font-bold">
                                    {totalAssignments > 0 ? ((submittedCount / totalAssignments) * 100).toFixed(0) : 100}%
                                  </span>
                                </div>
                                <div className="w-24 h-1.5 bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{ width: `${totalAssignments > 0 ? (submittedCount / totalAssignments) * 100 : 100}%` }}
                                  ></div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1.5">
                                  {hasCriticalAttendance && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-950/80 border border-red-800/40 text-red-400 text-[9px] font-bold uppercase tracking-wider animate-pulse">
                                      ⚠️ Asistencia Crítica
                                    </span>
                                  )}
                                  {hasMissingAssignments && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-955/80 border border-amber-800/40 text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                                      ⚠️ Tareas Atrasadas
                                    </span>
                                  )}
                                  {!hasCriticalAttendance && !hasMissingAssignments && (
                                    <span className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-gray-500 text-[9px] font-bold uppercase tracking-wider">
                                      Sin Alertas
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                  isAtRisk
                                    ? "bg-red-950/40 border border-red-900/30 text-red-400"
                                    : "bg-emerald-950/40 border border-emerald-900/30 text-emerald-400"
                                }`}>
                                  {isAtRisk ? "EN RIESGO" : "REGULAR"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {roster.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-gray-500 italic">
                              No hay alumnos inscriptos en esta cátedra.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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
                      <div key={a.id} className="p-6 bg-neutral-900/40 border border-neutral-800 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                          <span className="text-xs font-bold text-blue-400">Aviso General</span>
                          <span className="text-[10px] text-gray-500 font-mono">{dateStr}</span>
                        </div>
                        <div 
                          className="text-xs text-gray-300 leading-relaxed font-sans markdown-body"
                          dangerouslySetInnerHTML={{ __html: marked.parse(a.message || "") }}
                        />
                        
                        {profile?.role === "student" && (
                          <div className="flex justify-end pt-3 border-t border-neutral-850">
                            {a.acknowledged ? (
                              <span className="text-[11px] text-green-400 font-semibold flex items-center space-x-1">
                                <span>Acuse de recepción confirmado ✓</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAcknowledgeAnnouncement(a.id)}
                                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-lg text-[10px] font-bold text-gray-300 transition cursor-pointer"
                              >
                                Confirmar Recepción
                              </button>
                            )}
                          </div>
                        )}

                        {(profile?.role === "teacher" || profile?.role === "admin") && (
                          <div className="pt-3 border-t border-neutral-850 space-y-3">
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => handleToggleAcks(a.id)}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold underline transition"
                              >
                                {visibleAcksId === a.id ? "Ocultar Acuses" : "Ver Acuses de Recepción"}
                              </button>
                            </div>
                            {visibleAcksId === a.id && (
                              <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Leído por:</h5>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                  {announcementAcks.map((ack) => {
                                    const ackDate = ack.acknowledged_at
                                      ? new Date(ack.acknowledged_at._seconds * 1000).toLocaleString("es-AR")
                                      : "Reciente";
                                    return (
                                      <div key={ack.student_id} className="text-xs flex justify-between text-gray-300">
                                        <span>{ack.profile?.full_name || "Estudiante"} ({ack.profile?.email || "-"})</span>
                                        <span className="text-gray-500 font-mono text-[10px]">{ackDate}</span>
                                      </div>
                                    );
                                  })}
                                  {announcementAcks.length === 0 && (
                                    <p className="text-[11px] text-gray-500 italic">Nadie ha confirmado recepción aún.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
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

      {/* Teacher QR Modal Overlay */}
      {teacherActiveQr && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white">Presentismo por Código QR</h3>
            <p className="text-xs text-gray-400">
              Proyecta este código en pantalla para que los alumnos lo escaneen y firmen su presente.
            </p>
            
            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=000000&data=${encodeURIComponent(
                  JSON.stringify({
                    courseId: selectedCourse?.id || selectedCourse?.course?.id,
                    classNumber: teacherActiveQr.classNumber,
                    token: teacherActiveQr.code
                  })
                )}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
            
            <div className="space-y-1">
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Código de asistencia</span>
              <div className="text-3xl font-black text-amber-500 font-mono tracking-widest bg-neutral-955 py-2.5 rounded-xl border border-neutral-850">
                {teacherActiveQr.code}
              </div>
            </div>
            
            <div className="flex items-center justify-center space-x-2 text-xs font-bold text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>
                Expira en: {Math.floor(teacherActiveQr.expiresIn / 60)}:
                {(teacherActiveQr.expiresIn % 60).toString().padStart(2, "0")}
              </span>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleGenerateAttendanceQr(teacherActiveQr.classNumber)}
                className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-gray-300 border border-neutral-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                🔄 Renovar
              </button>
              <button
                type="button"
                onClick={() => setTeacherActiveQr(null)}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student QR / Code Attendance Modal */}
      {studentActiveAttendanceClass !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full text-center space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Firmar Presente (Clase {studentActiveAttendanceClass})</h3>
            <p className="text-xs text-gray-400">
              Ingresá el código de 6 caracteres que se muestra en la pantalla del profesor. Se requiere acceso a tu ubicación.
            </p>
            
            <div className="space-y-4">
              <input
                type="text"
                maxLength={6}
                value={studentQrToken}
                onChange={(e) => setStudentQrToken(e.target.value.toUpperCase())}
                placeholder="Ej: A7B9X2"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold tracking-widest text-amber-400 focus:outline-none focus:border-blue-500"
              />
              
              {studentAttendanceGeoLoading && (
                <p className="text-[10px] text-blue-400 animate-pulse font-semibold">
                  🌍 Obteniendo ubicación GPS del dispositivo...
                </p>
              )}
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStudentActiveAttendanceClass(null);
                  setStudentQrToken("");
                }}
                className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-gray-300 border border-neutral-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={studentQrToken.length < 6 || studentAttendanceGeoLoading}
                onClick={() => handleSubmitStudentAttendanceQr(studentActiveAttendanceClass)}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Confirmar Presente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
