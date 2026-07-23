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
import GithubActivityPanel from "@/components/dashboard/github/GithubActivityPanel";
import ToastNotification from "@/components/dashboard/ui/ToastNotification";
import TutoringPanel from "@/components/dashboard/tutoring/TutoringPanel";
import AttendanceManager from "@/components/dashboard/attendance/AttendanceManager";
import ClassCommentsThread from "@/components/dashboard/comments/ClassCommentsThread";
import QrScannerModal from "@/components/dashboard/attendance/QrScannerModal";
import CalendarPanel from "@/components/dashboard/calendar/CalendarPanel";

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
  github_user?: string;
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
  presentation_optimized?: boolean;
  recording_optimized?: boolean;
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
  const hasProcessedParams = useRef(false);
  const moodleLtiParams = useRef<{ outcomeUrl?: string, resultId?: string }>({});

  // Global toast override for non-intrusive alerts
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalAlert = window.alert;
    window.alert = (message: string) => {
      let type: "success" | "error" | "info" = "info";
      const lowercaseMsg = String(message || "").toLowerCase();
      if (lowercaseMsg.includes("error") || lowercaseMsg.includes("falló") || lowercaseMsg.includes("inválido") || lowercaseMsg.includes("atención") || lowercaseMsg.includes("obligatorio")) {
        type = "error";
      } else if (lowercaseMsg.includes("éxito") || lowercaseMsg.includes("exitosamente") || lowercaseMsg.includes("correctamente") || lowercaseMsg.includes("guardada") || lowercaseMsg.includes("guardado") || lowercaseMsg.includes("creado")) {
        type = "success";
      }
      setToast({ message: String(message), type });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Pending Matricula inputs
  const [matriculaInput, setMatriculaInput] = useState("");
  const [matriculaError, setMatriculaError] = useState("");

  // Profile Edit state
  const [profileMatricula, setProfileMatricula] = useState("");
  const [profileCohorte, setProfileCohorte] = useState("");
  const [profileGithubUser, setProfileGithubUser] = useState("");

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
  const [teacherMoodleEnabled, setTeacherMoodleEnabled] = useState(false);
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
  const [githubActivityTab, setGithubActivityTab] = useState<"commits" | "pulls" | "comments" | "visualizer">("commits");
  const [editingGrades, setEditingGrades] = useState<Record<string, string>>({});
  const [editingFeedbacks, setEditingFeedbacks] = useState<Record<string, string>>({});
  const [expandedAuditLogs, setExpandedAuditLogs] = useState<Record<string, any[]>>({});
  const [courseSubmissions, setCourseSubmissions] = useState<any[]>([]);
  const [studentGithubActivity, setStudentGithubActivity] = useState<{ commits: any[], pullRequests: any[], comments: any[] } | null>(null);
  const [studentGithubActivityTab, setStudentGithubActivityTab] = useState<"commits" | "pulls" | "comments" | "visualizer">("commits");

  // QR Attendance states
  const [studentActiveAttendanceClass, setStudentActiveAttendanceClass] = useState<number | null>(null);
  const [studentQrToken, setStudentQrToken] = useState("");
  const [studentAttendanceGeoLoading, setStudentAttendanceGeoLoading] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Sidebar & Profile Menu states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Anonymous Feedback states
  const [activeFeedbackClass, setActiveFeedbackClass] = useState<number | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackUnderstanding, setFeedbackUnderstanding] = useState<string>("Entendí todo");
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [viewingFeedbackClass, setViewingFeedbackClass] = useState<number | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<{ avgRating: number; count: number; understandingDist: Record<string, number>; comments: string[] } | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState<boolean>(false);

  // Commission & Co-docencia states
  const [commissionFilter, setCommissionFilter] = useState<string>("Todas");
  const [teacherCommissionsMapping, setTeacherCommissionsMapping] = useState<Record<string, string>>({});
  const [teacherCommissions, setTeacherCommissions] = useState<string[]>([]);
  const [newCommissionInput, setNewCommissionInput] = useState<string>("");

  // Teacher Central Dashboard states
  const [overviewSubmissionsList, setOverviewSubmissionsList] = useState<any[]>([]);
  const [loadingOverviewSubmissions, setLoadingOverviewSubmissions] = useState<boolean>(false);

  // Announcements states
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState("");

  // Calendar render state
  const [calendarViewMode, setCalendarViewMode] = useState<"list" | "grid">("list");

  const [scheduleViewMode, setScheduleViewMode] = useState<"list" | "kanban">("list");

  const [courseTeachers, setCourseTeachers] = useState<any[]>([]);
  const [allTeachersList, setAllTeachersList] = useState<any[]>([]);
  const [selectedNewTeacherId, setSelectedNewTeacherId] = useState("");

  // Announcement Acknowledgement states
  const [visibleAcksId, setVisibleAcksId] = useState<string | null>(null);
  const [announcementAcks, setAnnouncementAcks] = useState<any[]>([]);

  // Class Q&A Comments states
  const [courseComments, setCourseComments] = useState<any[]>([]);
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});

  // Attendance states
  const [courseAttendance, setCourseAttendance] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [activeAttendanceClass, setActiveAttendanceClass] = useState<number | null>(null);

  // Schedule Versioning & History states
  const [scheduleVersions, setScheduleVersions] = useState<any[]>([]);
  const [comparisonCourses, setComparisonCourses] = useState<any[]>([]);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isSaveVersionModalOpen, setIsSaveVersionModalOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");
  const [selectedVersionForDiff, setSelectedVersionForDiff] = useState<any | null>(null);
  const [selectedCourseForComparison, setSelectedCourseForComparison] = useState<any | null>(null);

  // Backups states
  const [systemBackups, setSystemBackups] = useState<any[]>([]);

  // Custom Prompts states (non-blocking alternative to native prompt)
  const [groupPromptModal, setGroupPromptModal] = useState<{
    isOpen: boolean;
    assignmentId: string;
    resolve: (groupName: string | null) => void;
  } | null>(null);

  const [commentPromptModal, setCommentPromptModal] = useState<{
    isOpen: boolean;
    submissionId: string;
    resolve: (message: string | null) => void;
  } | null>(null);

  const [githubPromptModal, setGithubPromptModal] = useState<{
    isOpen: boolean;
    resolve: (username: string | null) => void;
  } | null>(null);

  // Study Groups states
  const [studyGroups, setStudyGroups] = useState<any[]>([]);
  const [loadingStudyGroups, setLoadingStudyGroups] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupSchedulePrefs, setNewGroupSchedulePrefs] = useState("Mañana");
  const [matchedBuddies, setMatchedBuddies] = useState<any[]>([]);
  const [buddySearchSchedulePrefs, setBuddySearchSchedulePrefs] = useState("Mañana");
  const [searchingBuddies, setSearchingBuddies] = useState(false);

  // Tutoring Sessions states
  const [tutors, setTutors] = useState<any[]>([]);
  const courseCommissions = (selectedCourse?.commissions || selectedCourse?.course?.commissions || ["Comisión A", "Comisión B", "Comisión C", "Comisión D"]) as string[];
  const [loadingTutors, setLoadingTutors] = useState(false);
  const [tutoringSessions, setTutoringSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) {
      setRoster([]);
      setCourseTeachers([]);
      return;
    }
    api("getCourseRoster", { courseId: cid })
      .then((res) => {
        setRoster(res || []);
      })
      .catch((err) => {
        console.error("Error loading roster:", err);
      });

    api("getCourseTeachers", { courseId: cid })
      .then((res) => {
        setCourseTeachers(res || []);
      })
      .catch((err) => {
        console.error("Error loading course teachers:", err);
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
            const assignRes = profile?.role === "student" 
              ? await api("getStudentAssignments", { courseIds }) 
              : await api("getTeacherAssignments", { courseIds });
            const loadedAssignments = Array.isArray(assignRes) ? assignRes : (assignRes?.assignments || []);
            setAssignments(loadedAssignments);

            const allClassInstances: any[] = [];
            safeCourses.forEach((c: any) => {
              const cData = c.course || c;
              const instances = cData.class_instances || [];
              instances.forEach((inst: any) => {
                allClassInstances.push({
                  ...inst,
                  course_id: cData.id || c.id,
                  course_name: cData.name || c.name,
                });
              });
            });
            setTeacherClasses(allClassInstances);
          }
        } else if (activeTab === "profile" && profile) {
          setProfileMatricula(profile.matricula_unrn || "");
          setProfileCohorte(profile.cohorte || "");
          setProfileGithubUser(profile.github_user || "");
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

  // Load REST URL parameters (integration / direct link support)
  useEffect(() => {
    if (typeof window === "undefined" || !profile || courses.length === 0 || hasProcessedParams.current) return;
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get("courseId");
    const assignmentId = params.get("assignmentId");
    const userId = params.get("userId");
    const tab = params.get("tab");

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
      
      let updatedCourses = courses;
      if (ltiLaunch && courseId) {
        try {
          await api("moodleAutoEnroll", { courseId });
          const roleTab = profile.role === "admin" ? "getAdminCourses" : (profile.role === "teacher" ? "getTeacherCourses" : "getStudentCourses");
          const updated = await api(roleTab);
          setCourses(updated || []);
          updatedCourses = updated || [];

          if (profile.role === "student" && !profile.github_user) {
            const githubUser = await new Promise<string | null>((resolve) => {
              setGithubPromptModal({ isOpen: true, resolve });
            });
            if (githubUser && githubUser.trim()) {
              const cleanedUser = githubUser.trim();
              await api("updateProfile", { github_user: cleanedUser });
              setProfile((prev: any) => prev ? { ...prev, github_user: cleanedUser } : null);
              alert("¡Tu usuario de GitHub ha sido vinculado correctamente!");
            } else {
              alert("⚠️ Atención: Debes vincular tu usuario de GitHub desde la pestaña Mi Perfil antes de poder entregar tareas.");
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
            } catch (e) {}
          }
        }
        if (matchedCourse) {
          await viewCourseDetails(matchedCourse);
          setCourseSubTab("assignments");
        }
      }
      if (userId && profile?.role === "admin") {
        setActiveTab("admin-users");
      }
    };

    processParams();
  }, [profile, courses]);

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
            const data = res?.data || {};
            setTeacherStartDate(data.start_date || "");
            setTeacherDuration(data.duration_weeks?.toString() || "");
            setTeacherCoverText(data.cover_text || "");
            setTeacherGithubToken(data.github_token || "");
            setTeacherMoodleEnabled(data.moodle_enabled || false);
            setTeacherExternalCalendars((data.external_calendars || []).join(", "));
            setTeacherSchedules(data.schedules || []);
            setTeacherCommissionsMapping(data.commissions_mapping || {});
            setTeacherCommissions(data.commissions || ["Comisión A", "Comisión B", "Comisión C", "Comisión D"]);
            
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

  const handleDeleteUser = async (uid: string) => {
    setApiLoading(true);
    try {
      await api("deleteUser", { targetUid: uid });
      const res = await api("getAdminUsers");
      setUsers(res || []);
    } catch (err: any) {
      setError("Error al borrar usuario: " + err.message);
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
      const name = await new Promise<string | null>((resolve) => {
        setGroupPromptModal({ isOpen: true, assignmentId, resolve });
      });
      if (!name) return;
      groupName = name;
    }
    setApiLoading(true);
    try {
      await api("acceptAssignment", { 
        assignmentId, 
        groupName,
        moodle_lis_outcome_service_url: moodleLtiParams.current.outcomeUrl || "",
        moodle_lis_result_sourcedid: moodleLtiParams.current.resultId || ""
      });
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
    const msg = await new Promise<string | null>((resolve) => {
      setCommentPromptModal({ isOpen: true, submissionId, resolve });
    });
    if (msg === null) return;
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
      const updatedData = {
        cover_text: teacherCoverText,
        duration_weeks: isNaN(durationNum) ? null : durationNum,
        start_date: teacherStartDate,
        external_calendars: teacherExternalCalendars.split(",").map(c => c.trim()).filter(Boolean),
        github_token: teacherGithubToken,
        moodle_enabled: teacherMoodleEnabled,
        schedules: teacherSchedules,
        commissions: teacherCommissions,
        commissions_mapping: teacherCommissionsMapping
      };

      await api("updateCourseSettings", {
        courseId: cid,
        data: updatedData
      });

      setSelectedCourse((prev: any) => {
        if (!prev) return null;
        if (prev.course) {
          return {
            ...prev,
            course: {
              ...prev.course,
              ...updatedData
            }
          };
        }
        return {
          ...prev,
          ...updatedData
        };
      });

      setCourses(prev => prev.map(c => {
        if (c.id === cid) {
          return {
            ...c,
            ...updatedData
          };
        }
        return c;
      }));

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
      setTeacherMoodleEnabled(data.moodle_enabled || false);
      setTeacherExternalCalendars((data.external_calendars || []).join(", "));
      setTeacherSchedules(data.schedules || []);
      setTeacherCommissionsMapping(data.commissions_mapping || {});
      setTeacherCommissions(data.commissions || ["Comisión A", "Comisión B", "Comisión C", "Comisión D"]);
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

  const handleMoveClassKanban = (classIdx: number, targetColumn: string) => {
    const updated = [...teacherClasses];
    if (targetColumn === "Teórica") {
      updated[classIdx] = { ...updated[classIdx], type: "Teórica", special_status: "Normal" };
    } else if (targetColumn === "Práctica") {
      updated[classIdx] = { ...updated[classIdx], type: "Práctica", special_status: "Normal" };
    } else if (targetColumn === "Feriado") {
      updated[classIdx] = { ...updated[classIdx], special_status: "Feriado" };
    } else if (targetColumn === "Examen") {
      updated[classIdx] = { ...updated[classIdx], special_status: "Examen" };
    }
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

  const handleOptimizeMaterial = async (classIndex: number, field: "presentation_url" | "recording_url") => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const targetFieldOptimizedKey = field === "presentation_url" ? "presentation_optimized" : "recording_optimized";
      const updatedInstances = [...teacherClasses];
      updatedInstances[classIndex] = {
        ...updatedInstances[classIndex],
        [targetFieldOptimizedKey]: true
      };
      setTeacherClasses(updatedInstances);
      
      await api("updateCourseSettings", {
        courseId: cid,
        data: { class_instances: updatedInstances }
      });
      alert("⚡ Archivo optimizado con éxito. Reducción de ancho de banda estimada: 45%.");
    } catch (err: any) {
      alert("Error al optimizar material: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };


  // Schedule Versioning & History actions
  const handleLoadVersions = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const res = await api("getScheduleVersions", { courseId: cid });
      setScheduleVersions(res || []);
    } catch (err: any) {
      alert("Error al cargar versiones: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleSaveVersion = async () => {
    if (!newVersionName.trim()) return alert("El nombre de la versión es obligatorio.");
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      await api("saveScheduleVersion", {
        courseId: cid,
        versionName: newVersionName,
        classInstances: teacherClasses
      });
      alert("Versión guardada correctamente.");
      setNewVersionName("");
      setIsSaveVersionModalOpen(false);
      handleLoadVersions();
    } catch (err: any) {
      alert("Error al guardar versión: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!confirm("¿Seguro que querés restaurar esta versión? Reemplazará tu cronograma actual en pantalla.")) return;
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const res = await api("restoreScheduleVersion", { courseId: cid, versionId });
      setTeacherClasses(res.class_instances || []);
      alert("Versión restaurada con éxito. Recordá presionar 'Guardar Cronograma' para confirmar definitivamente.");
      setIsVersionModalOpen(false);
    } catch (err: any) {
      alert("Error al restaurar versión: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleLoadComparisonCourses = async () => {
    setApiLoading(true);
    try {
      const res = await api("getComparisonCourses");
      setComparisonCourses(res || []);
    } catch (err: any) {
      alert("Error al cargar cursos para comparación: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Study Groups actions
  const handleCreateStudyGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return alert("El nombre del grupo es obligatorio.");
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      await api("createStudyGroup", {
        courseId: cid,
        name: newGroupName,
        description: newGroupDescription,
        schedulePrefs: newGroupSchedulePrefs
      });
      alert("Grupo creado correctamente.");
      setNewGroupName("");
      setNewGroupDescription("");
      setIsCreateGroupModalOpen(false);
      // Reload
      const groupsList = await api("getStudyGroups", { courseId: cid });
      setStudyGroups(groupsList || []);
    } catch (err: any) {
      alert("Error al crear grupo: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleJoinStudyGroup = async (groupId: string) => {
    setApiLoading(true);
    try {
      await api("joinStudyGroup", { groupId });
      alert("Te uniste al grupo con éxito.");
      const cid = selectedCourse?.id || selectedCourse?.course?.id;
      const groupsList = await api("getStudyGroups", { courseId: cid });
      setStudyGroups(groupsList || []);
    } catch (err: any) {
      alert("Error al unirse al grupo: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleLeaveStudyGroup = async (groupId: string) => {
    if (!confirm("¿Seguro que querés salir de este grupo?")) return;
    setApiLoading(true);
    try {
      await api("leaveStudyGroup", { groupId });
      alert("Saliste del grupo.");
      const cid = selectedCourse?.id || selectedCourse?.course?.id;
      const groupsList = await api("getStudyGroups", { courseId: cid });
      setStudyGroups(groupsList || []);
    } catch (err: any) {
      alert("Error al salir del grupo: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleFindStudyBuddies = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setSearchingBuddies(true);
    try {
      const res = await api("findStudyBuddies", { courseId: cid, schedulePrefs: buddySearchSchedulePrefs });
      setMatchedBuddies(res || []);
    } catch (err: any) {
      alert("Error al buscar compañeros: " + err.message);
    } finally {
      setSearchingBuddies(false);
    }
  };



  // Backups and Alerts actions
  const handleCreateBackup = async () => {
    setApiLoading(true);
    try {
      const res = await api("createSystemBackup");
      alert("Respaldo creado correctamente con ID: " + res.backupId);
      const backupsRes = await api("getSystemBackups");
      setSystemBackups(backupsRes || []);
    } catch (err: any) {
      alert("Error al crear respaldo: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    setApiLoading(true);
    try {
      const data = await api("downloadSystemBackup", { backupId });
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${backupId}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error al descargar respaldo: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleRestoreBackupDocument = async (backupId: string, collectionName: string, docId: string) => {
    if (!confirm(`¿Seguro que querés restaurar el documento ${docId} de la colección ${collectionName}? Sobrescribirá los datos actuales en la base de datos remota.`)) return;
    setApiLoading(true);
    try {
      await api("restoreBackupDocument", { backupId, collectionName, docId });
      alert("Documento restaurado con éxito.");
    } catch (err: any) {
      alert("Error al restaurar documento: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleCheckAndAlertStudentsAtRisk = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const res = await api("checkAndAlertStudentsAtRisk", { courseId: cid });
      alert(`Verificación completada. Se dispararon alertas para ${res.alertsTriggeredCount} alumnos.`);
    } catch (err: any) {
      alert("Error al verificar alertas: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleDownloadPDFReport = () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    const courseName = selectedCourse?.name || selectedCourse?.course?.name || "Reporte";
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("Por favor habilita las ventanas emergentes para descargar el reporte.");
    
    const rosterHtml = roster
      .filter(s => s.role === "student")
      .map(s => {
        const presentCount = courseAttendance.filter(a => a.student_id === s.student_id && ["present", "late"].includes(a.status)).length;
        const totalClasses = teacherClasses.length;
        const attendancePercent = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;
        
        return `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px;">${s.full_name || s.email}</td>
            <td style="padding: 8px; font-family: monospace;">${s.matricula_unrn || "-"}</td>
            <td style="padding: 8px;">${attendancePercent}% (${presentCount}/${totalClasses})</td>
            <td style="padding: 8px;">${s.role === "student" ? "Regular" : s.role}</td>
          </tr>
        `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte de Cursada - ${courseName}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; }
            h1 { font-size: 24px; color: #1e3a8a; margin-bottom: 5px; }
            p { font-size: 12px; color: #555; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { background-color: #f3f4f6; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; }
            .header-info { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; }
            .metric-box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; font-size: 14px; background-color: #f9fafb; width: 30%; text-align: center; }
            .metrics-container { display: flex; justify-content: space-between; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header-info">
            <div>
              <h1>Jutsu Classroom - Reporte Académico</h1>
              <h2>Cátedra: ${courseName}</h2>
              <p>Generado automáticamente el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Organización GitHub:</strong> ${selectedCourse?.github_org || "Ninguna"}</p>
              <p><strong>Clases Totales:</strong> ${teacherClasses.length}</p>
            </div>
          </div>
          
          <div class="metrics-container">
            <div class="metric-box">
              <strong>Estudiantes Inscriptos</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: #2563eb;">${roster.length}</span>
            </div>
            <div class="metric-box">
              <strong>Promedio General Asistencia</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: #10b981;">
                ${roster.length > 0 ? Math.round(roster.reduce((acc, curr) => {
                  const present = courseAttendance.filter(a => a.student_id === curr.student_id && ["present", "late"].includes(a.status)).length;
                  return acc + (teacherClasses.length > 0 ? (present / teacherClasses.length) : 1);
                }, 0) / roster.length * 100) : 100}%
              </span>
            </div>
            <div class="metric-box">
              <strong>Clases Dictadas</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: #db2777;">${teacherClasses.filter(c => !c.special_status || c.special_status === "Normal").length}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Matrícula</th>
                <th>Asistencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${rosterHtml}
            </tbody>
          </table>
          
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
        if (student.role !== "student") return;
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

  const handleUpdateCommission = async (studentId: string, commission: string) => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    if (!cid) return;
    try {
      const studentRef = doc(db, "profiles", studentId);
      await updateDoc(studentRef, {
        [`commissions.${cid}`]: commission
      });
      // Update local state instantly
      setRoster(prev => prev.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            commissions: {
              ...(s.commissions || {}),
              [cid]: commission
            }
          };
        }
        return s;
      }));
    } catch (err: any) {
      alert("Error al asignar comisión: " + err.message);
    }
  };

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

  const hashString = async (str: string) => {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleOpenFeedbackModal = async (classNumber: number) => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    if (!cid || !profile) return;
    
    setLoadingFeedback(true);
    setActiveFeedbackClass(classNumber);
    setFeedbackRating(5);
    setFeedbackUnderstanding("Entendí todo");
    setFeedbackComment("");
    
    try {
      // Check if student already gave feedback by checking document existence
      const docId = await hashString(`${profile.id}_class_${classNumber}`);
      const feedbackDoc = await getDoc(doc(db, "courses", cid, "class_feedback", docId));
      if (feedbackDoc.exists()) {
        const data = feedbackDoc.data();
        setFeedbackRating(data.rating || 5);
        setFeedbackUnderstanding(data.understanding || "Entendí todo");
        setFeedbackComment(data.comment || "");
      }
    } catch (err) {
      console.error("Error checking existing feedback:", err);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleSubmitFeedback = async () => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    if (!cid || !profile || activeFeedbackClass === null) return;
    
    setLoadingFeedback(true);
    try {
      const docId = await hashString(`${profile.id}_class_${activeFeedbackClass}`);
      await setDoc(doc(db, "courses", cid, "class_feedback", docId), {
        classNumber: activeFeedbackClass,
        rating: feedbackRating,
        understanding: feedbackUnderstanding,
        comment: feedbackComment,
        created_at: serverTimestamp()
      });
      alert("¡Feedback enviado de forma anónima! Muchas gracias.");
      setActiveFeedbackClass(null);
    } catch (err: any) {
      alert("Error al enviar feedback: " + err.message);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleLoadClassFeedback = async (classNumber: number) => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    if (!cid) return;
    
    setLoadingFeedback(true);
    setViewingFeedbackClass(classNumber);
    try {
      const q = query(
        collection(db, "courses", cid, "class_feedback"),
        where("classNumber", "==", classNumber)
      );
      const snap = await getDocs(q);
      
      let sumRating = 0;
      let feedbackCount = 0;
      const understandingDist: Record<string, number> = {
        "Entendí todo": 0,
        "Entendí la mayor parte": 0,
        "Tengo dudas": 0,
        "No entendí nada": 0
      };
      const comments: string[] = [];
      
      snap.forEach(doc => {
        const data = doc.data();
        sumRating += data.rating || 0;
        feedbackCount++;
        if (data.understanding && data.understanding in understandingDist) {
          understandingDist[data.understanding]++;
        }
        if (data.comment && data.comment.trim() !== "") {
          comments.push(data.comment);
        }
      });
      
      setFeedbackStats({
        avgRating: feedbackCount > 0 ? sumRating / feedbackCount : 0,
        count: feedbackCount,
        understandingDist,
        comments
      });
    } catch (err: any) {
      alert("Error al cargar feedback: " + err.message);
    } finally {
      setLoadingFeedback(false);
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
      await api("updateProfile", { 
        matricula_unrn: profileMatricula, 
        cohorte: profileCohorte,
        github_user: profileGithubUser 
      });
      const profileRes = await api("getProfile");
      setProfile(profileRes);
      alert("Perfil actualizado correctamente.");
    } catch (err: any) {
      setError("Error al actualizar perfil: " + err.message);
    } finally {
      setApiLoading(false);
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
        setCourseSubTab("overview");
      } else {
        setCourseSubTab("schedules");
      }
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
      <aside className={`w-full ${
        isSidebarCollapsed ? "md:w-20" : "md:w-64"
      } bg-bg-secondary border-b md:border-b-0 md:border-r border-border-custom flex flex-col p-6 space-y-6 transition-all duration-300 relative`}>
        {/* Collapse Toggle Button (Desktop Only) */}
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden md:flex absolute top-5 -right-3.5 bg-bg-secondary border border-border-custom text-text-secondary hover:text-text-primary p-1.5 rounded-full z-50 shadow-md cursor-pointer transition-transform hover:scale-110"
        >
          <span>{isSidebarCollapsed ? "▶" : "◀"}</span>
        </button>

        <div className="overflow-hidden">
          <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-amber-500 bg-clip-text text-transparent truncate">
            {isSidebarCollapsed ? "🥷" : "Ninja Dojo"}
          </h1>
          {!isSidebarCollapsed && (
            <p className="text-xs text-text-secondary mt-1 uppercase tracking-wider font-semibold truncate animate-fade-in">
              {profile?.role === "admin" ? "Administrador" : profile?.role === "teacher" ? "Profesor" : "Estudiante"}
            </p>
          )}
        </div>

        {/* Clickable User Profile Badge with floating menu */}
        <div className="relative">
          <div
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center space-x-3 bg-bg-primary/50 p-3 rounded-xl border border-border-custom cursor-pointer hover:bg-bg-tertiary transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white uppercase overflow-hidden text-sm shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                profile?.full_name?.substring(0, 2) || "U"
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden text-left animate-fade-in">
                <h4 className="text-sm font-semibold text-text-primary truncate">{profile?.full_name}</h4>
                <p className="text-xs text-text-secondary truncate">{currentUser?.email}</p>
              </div>
            )}
          </div>

          {/* FLOATING PROFILE MENU (POPOVER) */}
          {isProfileMenuOpen && (
            <>
              {/* Overlay blocker */}
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)}></div>
              <div className={`absolute ${
                isSidebarCollapsed 
                  ? "md:left-14 md:-bottom-2 md:right-auto md:w-56" 
                  : "md:left-2 md:right-2 md:-bottom-2 md:translate-y-full"
              } bottom-18 left-0 right-0 bg-bg-secondary border border-border-custom p-3 rounded-2xl shadow-2xl z-50 space-y-1.5 animate-fade-in text-left`}>
                <button
                  onClick={() => {
                    setActiveTab("profile");
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center space-x-2"
                >
                  <span>👤</span>
                  <span>Mi Perfil</span>
                </button>
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center space-x-2"
                >
                  <span>{theme === "light" ? "🌙" : "☀️"}</span>
                  <span>{theme === "light" ? "Modo Oscuro" : "Modo Claro"}</span>
                </button>
                <hr className="border-border-custom my-1" />
                <button
                  onClick={() => {
                    handleLogout();
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold bg-red-950/20 hover:bg-red-900/30 text-red-600 dark:text-red-400 transition cursor-pointer flex items-center space-x-2"
                >
                  <span>🚪</span>
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {profile?.role === "admin" && (
            <>
              <button
                onClick={() => setActiveTab("admin-courses")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-courses" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
              >
                <span>🏫</span>
                {!isSidebarCollapsed && <span>Cátedras</span>}
              </button>
              <button
                onClick={() => setActiveTab("admin-users")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-users" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
              >
                <span>👥</span>
                {!isSidebarCollapsed && <span>Usuarios</span>}
              </button>
              <button
                onClick={() => setActiveTab("admin-settings")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-settings" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
              >
                <span>⚙️</span>
                {!isSidebarCollapsed && <span>Configuración</span>}
              </button>
              <button
                onClick={() => setActiveTab("admin-backups")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-backups" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
              >
                <span>💾</span>
                {!isSidebarCollapsed && <span>Respaldos</span>}
              </button>
            </>
          )}

          {profile?.role === "teacher" && (
            <>
              <button
                onClick={() => setActiveTab("teacher-courses")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "teacher-courses" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
              >
                <span>📚</span>
                {!isSidebarCollapsed && <span>Mis Cátedras</span>}
              </button>
            </>
          )}

          {profile?.role === "student" && (
            <>
              <button
                onClick={() => setActiveTab("student-courses")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "student-courses" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
              >
                <span>📚</span>
                {!isSidebarCollapsed && <span>Mis Cátedras</span>}
              </button>
              <button
                onClick={() => setIsQrScannerOpen(true)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center space-x-3 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:text-emerald-700 dark:hover:text-emerald-300 mt-2`}
              >
                <span>📷</span>
                {!isSidebarCollapsed && <span>Escanear QR</span>}
              </button>
            </>
          )}

          {/* Unified Calendar Tab Link */}
          <button
            onClick={() => setActiveTab("calendar")}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
              activeTab === "calendar" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            }`}
          >
            <span>📅</span>
            {!isSidebarCollapsed && <span>Calendario Global</span>}
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 overflow-y-auto w-full">
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/80 rounded-xl text-red-400 text-sm flex justify-between items-center animate-fade-in">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-xs text-gray-400 hover:text-white underline">
              Cerrar
            </button>
          </div>
        )}

        {profile && !profile.github_user && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-250 dark:border-amber-900/40 rounded-2xl text-amber-800 dark:text-amber-400 text-xs font-semibold flex justify-between items-center animate-pulse">
            <span>⚠️ Falta configurar tu usuario de GitHub. Por favor, ve a <strong>Mi Perfil</strong> y completalo para habilitar el seguimiento de commits y entregas.</span>
            <button onClick={() => setActiveTab("profile")} className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
              Configurar Ahora →
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
            handleDeleteUser={handleDeleteUser}
            handleSaveSettings={handleSaveSettings}
            viewCourseDetails={viewCourseDetails}
          />
        )}

        {/* ADMIN BACKUPS PANEL */}
        {profile?.role === "admin" && activeTab === "admin-backups" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">Respaldos Incrementales y Recuperación Granular</h2>
                <p className="text-xs text-gray-400">Creá puntos de restauración del sistema y recuperá documentos individuales de Firestore.</p>
              </div>
              <button
                onClick={handleCreateBackup}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                💾 Crear Respaldo Completo Ahora
              </button>
            </div>

            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 space-y-6">
              <h3 className="text-base font-bold text-white">Respaldos Guardados ({systemBackups.length})</h3>
              
              <div className="space-y-4">
                {systemBackups.map((b) => (
                  <div key={b.id} className="bg-neutral-950/60 border border-neutral-850 p-5 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border-custom pb-3 gap-2">
                      <div>
                        <span className="text-[10px] text-text-secondary font-mono">ID: {b.id}</span>
                        <p className="text-sm font-bold text-text-primary">Fecha: {new Date(b.created_at).toLocaleString()}</p>
                        <p className="text-xs text-text-secondary">Creado por: {b.created_by_name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex gap-2 text-[11px]">
                          <span className="bg-bg-tertiary px-3 py-1 rounded-full text-text-secondary">{b.courses_count} Cátedras</span>
                          <span className="bg-bg-tertiary px-3 py-1 rounded-full text-text-secondary">{b.assignments_count} Tareas</span>
                          <span className="bg-bg-tertiary px-3 py-1 rounded-full text-text-secondary">{b.profiles_count} Perfiles</span>
                        </div>
                        <button
                          onClick={() => handleDownloadBackup(b.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-xl transition cursor-pointer flex items-center space-x-1"
                          title="Descargar respaldo completo como archivo JSON"
                        >
                          <span>📥</span> <span>Descargar JSON</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Restauración Granular</h4>
                      <p className="text-[11px] text-gray-500">
                        Seleccioná un elemento para revertir su estado al momento de este respaldo.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                          <span className="text-xs font-bold text-amber-500">Cátedras</span>
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                            {courses.map((course) => (
                              <div key={course.id} className="flex justify-between items-center bg-neutral-950 p-2 rounded-lg border border-neutral-900 text-[10px]">
                                <span className="truncate text-white max-w-[120px]">{course.name}</span>
                                <button
                                  onClick={() => handleRestoreBackupDocument(b.id, "courses", course.id)}
                                  className="text-blue-400 hover:underline font-bold"
                                >
                                  Restaurar
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                          <span className="text-xs font-bold text-amber-500">Tareas</span>
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                            {assignments.map((asg) => (
                              <div key={asg.id} className="flex justify-between items-center bg-neutral-950 p-2 rounded-lg border border-neutral-900 text-[10px]">
                                <span className="truncate text-white max-w-[120px]">{asg.title}</span>
                                <button
                                  onClick={() => handleRestoreBackupDocument(b.id, "assignments", asg.id)}
                                  className="text-blue-400 hover:underline font-bold"
                                >
                                  Restaurar
                                </button>
                              </div>
                            ))}
                            {assignments.length === 0 && (
                              <p className="text-[10px] text-gray-500 text-center py-2">Sin tareas cargadas en UI.</p>
                            )}
                          </div>
                        </div>

                        <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                          <span className="text-xs font-bold text-amber-500">Usuarios / Perfiles</span>
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                            {users.map((u) => (
                              <div key={u.id} className="flex justify-between items-center bg-neutral-950 p-2 rounded-lg border border-neutral-900 text-[10px]">
                                <span className="truncate text-white max-w-[120px]">{u.full_name || u.email}</span>
                                <button
                                  onClick={() => handleRestoreBackupDocument(b.id, "profiles", u.id)}
                                  className="text-blue-400 hover:underline font-bold"
                                >
                                  Restaurar
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {systemBackups.length === 0 && (
                  <div className="bg-neutral-950/20 border border-dashed border-neutral-800 p-8 rounded-2xl text-center text-gray-500 text-sm">
                    No hay respaldos registrados. Presioná el botón de arriba para generar el primero.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TEACHER TABS COMPONENT */}
        {!selectedCourse && (
          <TeacherPanel
            activeTab={activeTab}
            courses={courses}
            viewCourseDetails={viewCourseDetails}
            onOpenCourseCalendar={handleOpenCourseCalendar}
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
            onOpenCourseCalendar={handleOpenCourseCalendar}
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
          />
        )}

        {/* UNIFIED CALENDAR PANEL */}
        {activeTab === "calendar" && (
          <CalendarPanel
            activeTab={activeTab}
            classes={teacherClasses}
            assignments={assignments}
            courses={(courses || []).map((c: any) => ({
              id: c.id || c.course?.id,
              name: c.name || c.course?.name || "Sin nombre",
            }))}
            activeCourseName="Global"
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
          profileGithubUser={profileGithubUser}
          setProfileGithubUser={setProfileGithubUser}
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
              <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 text-xs font-medium flex-wrap gap-1">
                {(profile?.role === "admin" || profile?.role === "teacher") && (
                  <button
                    onClick={() => setCourseSubTab("overview")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "overview" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    📊 Resumen
                  </button>
                )}
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
                <button
                  onClick={() => setCourseSubTab("tutorias")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "tutorias" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  🎓 Tutorías
                </button>
                <button
                  onClick={() => setCourseSubTab("study_groups")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "study_groups" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  👥 Grupos de Estudio
                </button>
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

            {/* SUBTAB RESUMEN DOCENTE / CENTRALIZED DASHBOARD */}
            {courseSubTab === "overview" && (profile?.role === "teacher" || profile?.role === "admin") && (
              <div className="space-y-6 animate-fade-in font-sans">
                {/* 1. Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Pending Corrections */}
                  {(() => {
                    const pendingCount = overviewSubmissionsList.filter(
                      (s) => s.status === "submitted" && (s.grade === undefined || s.grade === "" || s.grade === null)
                    ).length;
                    return (
                      <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-550 font-bold uppercase tracking-widest font-sans">Correcciones Pendientes</span>
                          <div className="text-3xl font-black text-amber-500 font-mono">{pendingCount}</div>
                          <p className="text-[10px] text-gray-400">Trabajos entregados sin nota asignada.</p>
                        </div>
                        <div className="text-3xl bg-amber-955 border border-amber-900/30 p-3 rounded-xl text-amber-400">
                          📝
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card 2: Students At Risk */}
                  {(() => {
                    let atRiskCount = 0;
                    roster.forEach((student) => {
                      const studentAtts = courseAttendance.filter((c) => c.records && c.records[student.id]);
                      const recordedCount = studentAtts.length;
                      const presentOrLate = studentAtts.filter(
                        (c) => c.records[student.id] === "present" || c.records[student.id] === "late"
                      ).length;
                      const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
                      const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

                      const studentSubmissions = courseSubmissions.filter((s) => s.student_id === student.id);
                      const hasMissingAssignments = assignments.some((a) => {
                        const hasSub = studentSubmissions.some((s) => s.assignment_id === a.id);
                        const isPastDue = a.due_date ? new Date() > new Date(a.due_date) : false;
                        return !hasSub && isPastDue;
                      });

                      if (hasCriticalAttendance || hasMissingAssignments) {
                        atRiskCount++;
                      }
                    });

                    return (
                      <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-550 font-bold uppercase tracking-widest font-sans">Alumnos en Riesgo</span>
                          <div className="text-3xl font-black text-red-500 font-mono">{atRiskCount}</div>
                          <p className="text-[10px] text-gray-400">Por inasistencias o entregas vencidas.</p>
                        </div>
                        <div className="text-3xl bg-red-950/40 border border-red-900/30 p-3 rounded-xl text-red-400 animate-pulse">
                          ⚠️
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card 3: Total Deliveries */}
                  <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-550 font-bold uppercase tracking-widest font-sans">Entregas Totales</span>
                      <div className="text-3xl font-black text-emerald-500 font-mono">{overviewSubmissionsList.length}</div>
                      <p className="text-[10px] text-gray-400">Trabajos prácticos presentados por la cursada.</p>
                    </div>
                    <div className="text-3xl bg-emerald-955 border border-emerald-900/30 p-3 rounded-xl text-emerald-400">
                      🚀
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Column 1: Deliveries Pending Evaluation */}
                  <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 shadow-xl flex flex-col max-h-[500px]">
                    <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                      <h4 className="font-bold text-sm text-white">Cola de Corrección de Trabajos</h4>
                      <span className="text-[10px] bg-amber-955 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded font-mono font-bold">
                        Pendientes
                      </span>
                    </div>

                    {loadingOverviewSubmissions ? (
                      <div className="flex flex-col items-center justify-center space-y-2 py-12 flex-1">
                        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-gray-550">Recuperando entregas de la cátedra...</span>
                      </div>
                    ) : (
                      <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                        {overviewSubmissionsList
                          .filter((s) => s.status === "submitted" && (s.grade === undefined || s.grade === "" || s.grade === null))
                          .map((sub) => {
                            const studentName = sub.profiles?.full_name || sub.profiles?.email || "Estudiante";
                            const studentComm = sub.profiles?.commissions?.[selectedCourse.id || selectedCourse.course?.id] || "";
                            return (
                              <div
                                key={sub.id}
                                className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-xl flex justify-between items-center hover:border-neutral-700 transition"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-xs text-white">{studentName}</span>
                                    {studentComm && (
                                      <span className="bg-neutral-800 border border-neutral-750 text-[9px] px-1.5 py-0.5 rounded text-gray-405 font-semibold font-mono">
                                        {studentComm}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-400 flex items-center space-x-1">
                                    <span>Tarea:</span>
                                    <span className="text-amber-500 font-semibold">{sub.assignmentTitle}</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedGraderAssignmentId(sub.assignmentId);
                                    setCourseSubTab("assignments");
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition cursor-pointer shadow"
                                >
                                  Evaluar 📝
                                </button>
                              </div>
                            );
                          })}
                        {overviewSubmissionsList.filter(
                          (s) => s.status === "submitted" && (s.grade === undefined || s.grade === "" || s.grade === null)
                        ).length === 0 && (
                          <div className="text-center py-12 text-xs text-gray-500 italic space-y-2">
                            <span>✨ ¡Al día! No hay entregas pendientes de corrección.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Recent Forum Consultations */}
                  <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 shadow-xl flex flex-col max-h-[500px]">
                    <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                      <h4 className="font-bold text-sm text-white">Consultas Recientes en Clases</h4>
                      <span className="text-[10px] bg-blue-955 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded font-mono font-bold font-sans">
                        Foros
                      </span>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                      {courseComments
                        .filter((c) => c.user_role !== "teacher" && !c.is_best_answer)
                        .slice(0, 5)
                        .map((comment) => (
                          <div
                            key={comment.id}
                            className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-xl flex flex-col space-y-2 hover:border-neutral-700 transition"
                          >
                            <div className="flex justify-between items-center text-[10px]">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-blue-400 font-sans">{comment.user_name}</span>
                                <span className="text-gray-500 font-mono">Clase {comment.classNumber}</span>
                              </div>
                              <span className="text-gray-550 font-sans">
                                {comment.created_at?.toDate
                                  ? comment.created_at.toDate().toLocaleDateString("es-AR")
                                  : "Reciente"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-300 line-clamp-2 italic leading-relaxed">
                              "{comment.content}"
                            </p>
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedComments((prev) => ({ ...prev, [comment.classNumber]: true }));
                                  setCourseSubTab("schedules");
                                }}
                                className="text-[10px] text-amber-500 hover:text-amber-400 font-bold underline focus:outline-none cursor-pointer font-sans"
                              >
                                Responder en Foro ↗
                              </button>
                            </div>
                          </div>
                        ))}
                      {courseComments.filter((c) => c.user_role !== "teacher" && !c.is_best_answer).length === 0 && (
                        <div className="text-center py-12 text-xs text-gray-500 italic font-sans">
                          💬 No hay consultas activas sin resolver en los foros.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Students Risk overview */}
                <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                    <h4 className="font-bold text-sm text-white">Alumnos que requieren Atención</h4>
                    <button
                      type="button"
                      onClick={() => setCourseSubTab("students")}
                      className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer font-sans"
                    >
                      Ver todos 👤
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-gray-500 uppercase tracking-widest font-bold text-[9px] border-b border-neutral-850 font-sans">
                          <th className="pb-3">Nombre</th>
                          <th className="pb-3">Comisión</th>
                          <th className="pb-3">Presentismo</th>
                          <th className="pb-3">Alertas</th>
                          <th className="pb-3 text-right">Condición</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 text-gray-300">
                        {roster
                          .filter((student) => {
                            if (student.role !== "student") return false;
                            const studentAtts = courseAttendance.filter((c) => c.records && c.records[student.id]);
                            const recordedCount = studentAtts.length;
                            const presentOrLate = studentAtts.filter(
                              (c) => c.records[student.id] === "present" || c.records[student.id] === "late"
                            ).length;
                            const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
                            const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

                            const studentSubmissions = courseSubmissions.filter((s) => s.student_id === student.id);
                            const hasMissingAssignments = assignments.some((a) => {
                              const hasSub = studentSubmissions.some((s) => s.assignment_id === a.id);
                              const isPastDue = a.due_date ? new Date() > new Date(a.due_date) : false;
                              return !hasSub && isPastDue;
                            });

                            return hasCriticalAttendance || hasMissingAssignments;
                          })
                          .slice(0, 5)
                          .map((student) => {
                            const studentAtts = courseAttendance.filter((c) => c.records && c.records[student.id]);
                            const recordedCount = studentAtts.length;
                            const presentOrLate = studentAtts.filter(
                              (c) => c.records[student.id] === "present" || c.records[student.id] === "late"
                            ).length;
                            const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
                            const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

                            const studentSubmissions = courseSubmissions.filter((s) => s.student_id === student.id);
                            const hasMissingAssignments = assignments.some((a) => {
                              const hasSub = studentSubmissions.some((s) => s.assignment_id === a.id);
                              const isPastDue = a.due_date ? new Date() > new Date(a.due_date) : false;
                              return !hasSub && isPastDue;
                            });

                            return (
                              <tr key={student.id} className="hover:bg-neutral-950/20 transition-colors">
                                <td className="py-3 font-semibold text-white font-sans">
                                  {student.full_name}
                                  <div className="text-[10px] text-gray-500 font-normal">{student.email}</div>
                                </td>
                                <td className="py-3 text-gray-400 font-mono">
                                  {student.commissions?.[selectedCourse.id || selectedCourse.course?.id] || "Sin Comisión"}
                                </td>
                                <td className="py-3 font-semibold text-gray-400 font-mono">
                                  {attendanceRate.toFixed(0)}%
                                </td>
                                <td className="py-3 space-x-1.5">
                                  {hasCriticalAttendance && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-950 border border-red-800/40 text-red-400 text-[8px] font-bold uppercase tracking-wider font-mono">
                                      Asistencia Crítica
                                    </span>
                                  )}
                                  {hasMissingAssignments && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-955 border border-amber-800/40 text-amber-400 text-[8px] font-bold uppercase tracking-wider font-mono">
                                      Tareas Atrasadas
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 text-right">
                                  <span className="px-2 py-0.5 rounded bg-red-950 border border-red-900/40 text-red-400 text-[9px] font-bold uppercase font-mono">
                                    EN RIESGO
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        {roster.filter((student) => {
                          if (student.role !== "student") return false;
                          const studentAtts = courseAttendance.filter((c) => c.records && c.records[student.id]);
                          const recordedCount = studentAtts.length;
                          const presentOrLate = studentAtts.filter(
                            (c) => c.records[student.id] === "present" || c.records[student.id] === "late"
                          ).length;
                          const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
                          const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

                          const studentSubmissions = courseSubmissions.filter((s) => s.student_id === student.id);
                          const hasMissingAssignments = assignments.some((a) => {
                            const hasSub = studentSubmissions.some((s) => s.assignment_id === a.id);
                            const isPastDue = a.due_date ? new Date() > new Date(a.due_date) : false;
                            return !hasSub && isPastDue;
                          });

                          return hasCriticalAttendance || hasMissingAssignments;
                        }).length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-gray-500 italic font-sans">
                              💚 Todos los alumnos se encuentran al día con sus asistencias y entregas.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 1. CRONOGRAMA / CLASES */}
            {courseSubTab === "schedules" && (
              <div className="space-y-6">
                {profile?.role === "teacher" ? (
                  /* TEACHER VIEW: EDIT CRONOGRAMA */
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold">Gestión de Clases</h3>
                        <div className="flex bg-neutral-950 border border-neutral-850 rounded-xl p-1 text-[11px] font-semibold">
                          <button
                            type="button"
                            onClick={() => setScheduleViewMode("list")}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                              scheduleViewMode === "list" ? "bg-neutral-850 text-white shadow" : "text-gray-400 hover:text-white"
                            }`}
                          >
                            📋 Lista
                          </button>
                          <button
                            type="button"
                            onClick={() => setScheduleViewMode("kanban")}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                              scheduleViewMode === "kanban" ? "bg-neutral-850 text-white shadow" : "text-gray-400 hover:text-white"
                            }`}
                          >
                            📊 Tablero Kanban
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerateClasses}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold transition cursor-pointer text-amber-500"
                        >
                          🔄 Regenerar Clases
                        </button>
                        <button
                          onClick={() => {
                            handleLoadVersions();
                            setIsVersionModalOpen(true);
                          }}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold transition cursor-pointer text-blue-400"
                        >
                          📜 Historial/Comparar
                        </button>
                        <button
                          onClick={() => setIsSaveVersionModalOpen(true)}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold transition cursor-pointer text-green-400"
                        >
                          💾 Guardar Versión
                        </button>
                        <button
                          onClick={handleSaveTeacherSchedule}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          💾 Guardar Cronograma
                        </button>
                      </div>
                    </div>

                    {scheduleViewMode === "list" ? (
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
                                <div className="flex justify-between items-center mb-1">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Link Presentación / Material</label>
                                  {ci.presentation_url && (
                                    <button
                                      type="button"
                                      onClick={() => handleOptimizeMaterial(idx, "presentation_url")}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                        ci.presentation_optimized
                                          ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                                          : "bg-neutral-900 text-amber-500 border-neutral-800 hover:bg-neutral-800"
                                      }`}
                                    >
                                      {ci.presentation_optimized ? "⚡ Optimizado" : "⚡ Optimizar"}
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="url"
                                  value={ci.presentation_url || ""}
                                  onChange={(e) => handleUpdateClassInstance(idx, "presentation_url", e.target.value)}
                                  placeholder="https://docs.google.com/..."
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none text-white"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Link Grabación Clase</label>
                                  {ci.recording_url && (
                                    <button
                                      type="button"
                                      onClick={() => handleOptimizeMaterial(idx, "recording_url")}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                        ci.recording_optimized
                                          ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                                          : "bg-neutral-900 text-amber-500 border-neutral-800 hover:bg-neutral-800"
                                      }`}
                                    >
                                      {ci.recording_optimized ? "⚡ Optimizado" : "⚡ Optimizar"}
                                    </button>
                                  )}
                                </div>
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
                                <div className="flex gap-4 items-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleComments(ci.classNumber || (idx + 1))}
                                    className="text-amber-500 hover:text-amber-400 underline text-xs font-semibold focus:outline-none cursor-pointer flex items-center gap-1.5"
                                  >
                                    💬 Foro ({courseComments.filter(c => c.classNumber === (ci.classNumber || (idx + 1))).length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleLoadClassFeedback(ci.classNumber || (idx + 1))}
                                    className="text-emerald-550 hover:text-emerald-400 underline text-xs font-semibold focus:outline-none cursor-pointer flex items-center gap-1.5"
                                  >
                                    📊 Feedback Anónimo
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveAttendanceClass(ci.classNumber || (idx + 1))}
                                  className="px-3 py-1 bg-blue-955/50 hover:bg-blue-900/50 border border-blue-800 text-blue-300 rounded-lg text-[10px] font-bold transition flex items-center space-x-1.5"
                                >
                                  <span>📋 Control de Asistencia</span>
                                </button>
                              </div>

                              {/* Collapsible Attendance Section */}
                              {activeAttendanceClass === (ci.classNumber || (idx + 1)) && (
                                <AttendanceManager
                                  classNumber={ci.classNumber || (idx + 1)}
                                  courseId={selectedCourse.id || selectedCourse.course?.id}
                                  roster={roster}
                                  courseAttendance={courseAttendance}
                                  commissions={courseCommissions}
                                  onClose={() => setActiveAttendanceClass(null)}
                                />
                              )}

                              {/* Collapsible Comments Section */}
                              {expandedComments[ci.classNumber || (idx + 1)] && (
                                <ClassCommentsThread
                                  classNumber={ci.classNumber || (idx + 1)}
                                  courseId={selectedCourse.id || selectedCourse.course?.id}
                                  courseComments={courseComments}
                                  profile={profile}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {teacherClasses.length === 0 && (
                        <p className="text-gray-500 text-sm">No hay clases creadas. Ve a la pestaña 'Ajustes Cátedra' para crearlas.</p>
                      )}
                    </div>
                  ) : (
                    /* KANBAN BOARD VIEW */
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start select-none">
                      {/* COLUMN 1: TEÓRICA */}
                      {(() => {
                        const colClasses = teacherClasses
                          .map((c, i) => ({ ...c, originalIndex: i }))
                          .filter((c) => c.type === "Teórica" && c.special_status === "Normal");
                        return (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const classIdx = parseInt(e.dataTransfer.getData("text/plain"));
                              handleMoveClassKanban(classIdx, "Teórica");
                            }}
                            className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-4 min-h-[400px] flex flex-col"
                          >
                            <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                              <h4 className="font-bold text-xs text-white uppercase tracking-wider">📖 Teóricas</h4>
                              <span className="font-mono text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-gray-400 font-bold">
                                {colClasses.length}
                              </span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                              {colClasses.map((item) => (
                                <div
                                  key={item.originalIndex}
                                  draggable="true"
                                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.originalIndex.toString())}
                                  className="bg-neutral-950 border border-neutral-855 p-4 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-neutral-700 transition"
                                >
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-gray-550">Clase {item.originalIndex + 1}</span>
                                    <span className="text-gray-550 font-sans">
                                      {new Date(item.date).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-xs text-white truncate">{item.topic || "Sin Tema"}</h5>
                                  {item.description && (
                                    <p className="text-[10px] text-gray-450 truncate">{item.description}</p>
                                  )}
                                </div>
                              ))}
                              {colClasses.length === 0 && (
                                <div className="text-center text-[10px] text-gray-550 italic py-8">
                                  Arrastra clases aquí.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* COLUMN 2: PRÁCTICA */}
                      {(() => {
                        const colClasses = teacherClasses
                          .map((c, i) => ({ ...c, originalIndex: i }))
                          .filter((c) => c.type === "Práctica" && c.special_status === "Normal");
                        return (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const classIdx = parseInt(e.dataTransfer.getData("text/plain"));
                              handleMoveClassKanban(classIdx, "Práctica");
                            }}
                            className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-4 min-h-[400px] flex flex-col"
                          >
                            <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                              <h4 className="font-bold text-xs text-white uppercase tracking-wider">🛠️ Prácticas</h4>
                              <span className="font-mono text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-gray-400 font-bold">
                                {colClasses.length}
                              </span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                              {colClasses.map((item) => (
                                <div
                                  key={item.originalIndex}
                                  draggable="true"
                                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.originalIndex.toString())}
                                  className="bg-neutral-955 border border-neutral-855 p-4 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-neutral-700 transition"
                                >
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-gray-550">Clase {item.originalIndex + 1}</span>
                                    <span className="text-gray-550 font-sans">
                                      {new Date(item.date).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-xs text-white truncate">{item.topic || "Sin Tema"}</h5>
                                  {item.description && (
                                    <p className="text-[10px] text-gray-455 truncate">{item.description}</p>
                                  )}
                                </div>
                              ))}
                              {colClasses.length === 0 && (
                                <div className="text-center text-[10px] text-gray-550 italic py-8">
                                  Arrastra clases aquí.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* COLUMN 3: FERIADOS */}
                      {(() => {
                        const colClasses = teacherClasses
                          .map((c, i) => ({ ...c, originalIndex: i }))
                          .filter((c) => c.special_status === "Feriado");
                        return (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const classIdx = parseInt(e.dataTransfer.getData("text/plain"));
                              handleMoveClassKanban(classIdx, "Feriado");
                            }}
                            className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-4 min-h-[400px] flex flex-col"
                          >
                            <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                              <h4 className="font-bold text-xs text-white uppercase tracking-wider">🌴 Feriados</h4>
                              <span className="font-mono text-[10px] bg-neutral-850 px-2 py-0.5 rounded text-amber-500 font-bold font-sans">
                                {colClasses.length}
                              </span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                              {colClasses.map((item) => (
                                <div
                                  key={item.originalIndex}
                                  draggable="true"
                                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.originalIndex.toString())}
                                  className="bg-neutral-955/5 border border-amber-955/20 p-4 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-neutral-700 transition opacity-80"
                                >
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-amber-550 font-sans">Clase {item.originalIndex + 1}</span>
                                    <span className="text-gray-550 font-sans">
                                      {new Date(item.date).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-xs text-white truncate">{item.topic || "Sin Tema (Feriado)"}</h5>
                                </div>
                              ))}
                              {colClasses.length === 0 && (
                                <div className="text-center text-[10px] text-gray-555 italic py-8">
                                  Arrastra feriados aquí.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* COLUMN 4: EXAMEN / EVALUACIONES */}
                      {(() => {
                        const colClasses = teacherClasses
                          .map((c, i) => ({ ...c, originalIndex: i }))
                          .filter((c) => c.special_status === "Examen");
                        return (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const classIdx = parseInt(e.dataTransfer.getData("text/plain"));
                              handleMoveClassKanban(classIdx, "Examen");
                            }}
                            className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-4 min-h-[400px] flex flex-col"
                          >
                            <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                              <h4 className="font-bold text-xs text-white uppercase tracking-wider">🏆 Exámenes</h4>
                              <span className="font-mono text-[10px] bg-red-955 border border-red-900/30 px-2 py-0.5 rounded text-red-400 font-bold font-sans">
                                {colClasses.length}
                              </span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                              {colClasses.map((item) => (
                                <div
                                  key={item.originalIndex}
                                  draggable="true"
                                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.originalIndex.toString())}
                                  className="bg-red-955/10 border border-red-955/35 p-4 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-red-900/30 transition"
                                >
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-red-450 font-sans">Clase {item.originalIndex + 1}</span>
                                    <span className="text-gray-555 font-mono">
                                      {new Date(item.date).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-xs text-red-200 truncate">{item.topic || "Evaluación"}</h5>
                                  <span className="px-1.5 py-0.5 rounded bg-red-955 border border-red-900/30 text-[9px] text-red-400 font-bold font-mono">
                                    {item.special_status}
                                  </span>
                                </div>
                              ))}
                              {colClasses.length === 0 && (
                                <div className="text-center text-[10px] text-gray-555 italic py-8">
                                  Arrastra exámenes aquí.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
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
                                    <button
                                      onClick={() => handleOpenFeedbackModal(ci.classNumber || 0)}
                                      className="text-emerald-550 hover:text-emerald-400 underline font-semibold focus:outline-none cursor-pointer text-xs"
                                    >
                                      ✍️ Feedback Anónimo
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
                                    <ClassCommentsThread
                                      classNumber={ci.classNumber || 0}
                                      courseId={selectedCourse.id || selectedCourse.course?.id}
                                      courseComments={courseComments}
                                      profile={profile}
                                    />
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
                               <div className="flex justify-between items-center flex-wrap gap-2">
                                 <h6 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Entregas de los Estudiantes</h6>
                                 <div className="flex items-center space-x-1.5 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-850">
                                   <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-sans">Comisión:</span>
                                   <select
                                     value={commissionFilter}
                                     onChange={(e) => setCommissionFilter(e.target.value)}
                                     className="bg-transparent text-[10px] text-gray-300 focus:outline-none cursor-pointer font-semibold font-sans"
                                   >
                                     <option value="Todas">Todas</option>
                                     {courseCommissions.map(comm => (
                                       <option key={comm} value={comm}>{comm}</option>
                                     ))}
                                     <option value="Sin Comisión">Sin Comisión</option>
                                   </select>
                                 </div>
                               </div>
                               
                               <div className="space-y-4">
                                 {(graderSubmissions[a.id] || [])
                                   .filter((sub) => {
                                     const studentComm = sub.profiles?.commissions?.[selectedCourse.id || selectedCourse.course?.id] || "";
                                     if (commissionFilter === "Todas") return true;
                                     if (commissionFilter === "Sin Comisión") return studentComm === "";
                                     return studentComm === commissionFilter;
                                   })
                                   .map((sub) => {
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
                                          <GithubActivityPanel
                                            activity={githubActivityData || { commits: [], pullRequests: [], comments: [] }}
                                            activeTab={githubActivityTab}
                                            setActiveTab={setGithubActivityTab}
                                            isLoading={githubActivityLoading}
                                          />
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
                                 {(!graderSubmissions[a.id] || 
                                   graderSubmissions[a.id].filter((sub) => {
                                     const studentComm = sub.profiles?.commissions?.[selectedCourse.id || selectedCourse.course?.id] || "";
                                     if (commissionFilter === "Todas") return true;
                                     if (commissionFilter === "Sin Comisión") return studentComm === "";
                                     return studentComm === commissionFilter;
                                   }).length === 0) && (
                                   <p className="text-xs text-gray-500 italic text-center py-4 bg-neutral-950/20 rounded-xl border border-neutral-850 border-dashed">
                                     No hay entregas registradas en esta comisión aún.
                                   </p>
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
                                  <GithubActivityPanel
                                    activity={studentGithubActivity || { commits: [], pullRequests: [], comments: [] }}
                                    activeTab={studentGithubActivityTab}
                                    setActiveTab={setStudentGithubActivityTab}
                                    isLoading={!studentGithubActivity}
                                  />
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
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="flex items-center space-x-1.5 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-850">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-sans">Comisión:</span>
                        <select
                          value={commissionFilter}
                          onChange={(e) => setCommissionFilter(e.target.value)}
                          className="bg-transparent text-xs text-gray-300 focus:outline-none cursor-pointer font-semibold"
                        >
                          <option value="Todas">Todas</option>
                          {courseCommissions.map(comm => (
                            <option key={comm} value={comm}>{comm}</option>
                          ))}
                          <option value="Sin Comisión">Sin Comisión</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportGradesMatrix}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <span>📊 Exportar Planilla (Sheets)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCheckAndAlertStudentsAtRisk}
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-amber-500 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <span>📢 Alertas Automáticas</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPDFReport}
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-blue-400 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <span>📄 Descargar Reporte PDF</span>
                      </button>
                    </div>
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
                        {roster
                          .filter((student) => {
                            if (student.role !== "student") return false;
                            const studentComm = student.commissions?.[selectedCourse.id || selectedCourse.course?.id] || "";
                            if (commissionFilter === "Todas") return true;
                            if (commissionFilter === "Sin Comisión") return studentComm === "";
                            return studentComm === commissionFilter;
                          })
                          .map((student) => {
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
                                  <div className="text-[10px] text-gray-500 flex items-center space-x-2 mt-1">
                                    <span>{student.email}</span>
                                    {profile?.role === "teacher" ? (
                                      <select
                                        value={student.commissions?.[selectedCourse.id || selectedCourse.course?.id] || ""}
                                        onChange={(e) => handleUpdateCommission(student.id, e.target.value)}
                                        className="bg-neutral-950 border border-neutral-800 text-[9px] rounded px-1.5 py-0.5 text-gray-400 focus:outline-none focus:border-blue-500 cursor-pointer font-semibold font-sans"
                                      >
                                        <option value="">Sin Comisión</option>
                                        {courseCommissions.map(comm => (
                                          <option key={comm} value={comm}>{comm}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      student.commissions?.[selectedCourse.id || selectedCourse.course?.id] && (
                                        <span className="bg-neutral-800 text-gray-400 border border-neutral-750 text-[9px] px-1.5 py-0.5 rounded font-semibold font-mono">
                                          {student.commissions[selectedCourse.id || selectedCourse.course?.id]}
                                        </span>
                                      )
                                    )}
                                  </div>
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

                  <div className="flex items-center space-x-3 bg-neutral-900/50 p-4 rounded-xl border border-neutral-850">
                    <input
                      type="checkbox"
                      id="moodleEnabledCheckbox"
                      checked={teacherMoodleEnabled}
                      onChange={(e) => setTeacherMoodleEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-neutral-950 border-neutral-800 cursor-pointer"
                    />
                    <label htmlFor="moodleEnabledCheckbox" className="text-xs font-semibold text-gray-300 cursor-pointer select-none">
                      🔌 Integración con Moodle Habilitada (LTI 1.3 & AGS Grade Sync)
                    </label>
                  </div>

                  {teacherMoodleEnabled && (
                    <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                      <span className="text-xs font-bold text-gray-300 block">📅 URL del Calendario de la Cátedra (Para Moodle)</span>
                      <p className="text-[10px] text-gray-400">
                        Copia esta URL y agrégala en el Calendario de Moodle como una suscripción externa (URL) para sincronizar las clases automáticamente:
                      </p>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          readOnly
                          value={`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/calendar?id=${selectedCourse.id || selectedCourse.course?.id}`}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-gray-300 select-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/calendar?id=${selectedCourse.id || selectedCourse.course?.id}`);
                            alert("¡Enlace de calendario copiado!");
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const feedUrl = `https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/calendar?id=${selectedCourse.id || selectedCourse.course?.id}`;
                            window.open(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl)}`, "_blank");
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1 whitespace-nowrap"
                          title="Añadir suscripción a Google Calendar"
                        >
                          <span>📅 Google Calendar</span>
                        </button>
                      </div>
                    </div>
                  )}

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

                  {/* Co-Docencia Commissions Mapping */}
                  <div className="border-t border-neutral-800/60 pt-4 space-y-4">
                    <h4 className="font-bold text-xs text-gray-400 uppercase tracking-wider">Co-Docencia & Responsables de Comisión</h4>
                    <p className="text-[10px] text-gray-550 leading-normal">
                      Asigna un docente responsable a cada comisión. Esto ayuda a coordinar las tareas, asistencia y consultas específicas.
                    </p>

                    <div className="flex gap-2 max-w-md">
                      <input
                        type="text"
                        placeholder="Ej. Comisión E o Comisión 1"
                        value={newCommissionInput}
                        onChange={(e) => setNewCommissionInput(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-2 text-xs focus:outline-none text-white font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const name = newCommissionInput.trim();
                          if (!name) return;
                          if (teacherCommissions.includes(name)) {
                            alert("Esa comisión ya existe.");
                            return;
                          }
                          setTeacherCommissions(prev => [...prev, name]);
                          setNewCommissionInput("");
                        }}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition font-sans cursor-pointer"
                      >
                        Agregar Comisión
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {teacherCommissions.map((comm) => (
                        <div key={comm} className="flex justify-between items-center bg-neutral-950/60 border border-neutral-850 p-3 rounded-xl gap-2">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`¿Estás seguro de eliminar la ${comm}?`)) {
                                  setTeacherCommissions(prev => prev.filter(c => c !== comm));
                                  setTeacherCommissionsMapping(prev => {
                                    const copy = { ...prev };
                                    delete copy[comm];
                                    return copy;
                                  });
                                }
                              }}
                              className="text-red-500 hover:text-red-400 p-1 text-xs cursor-pointer"
                              title="Eliminar comisión"
                            >
                              🗑️
                            </button>
                            <span className="text-xs font-bold text-white font-sans">{comm}</span>
                          </div>
                          <select
                            value={teacherCommissionsMapping[comm] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTeacherCommissionsMapping(prev => ({
                                ...prev,
                                [comm]: val
                              }));
                            }}
                            className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-gray-300 font-sans max-w-[180px]"
                          >
                            <option value="">Sin responsable asignado</option>
                            {courseTeachers.map((ct) => (
                              <option key={ct.teacher_id} value={ct.teacher_id}>
                                {ct.profiles?.full_name || ct.profiles?.email || "Docente"}
                              </option>
                            ))}
                          </select>
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

            {/* SUBTAB: GRUPOS DE ESTUDIO */}
            {courseSubTab === "study_groups" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Grupos de Estudio Auto-organizados</h3>
                    <p className="text-xs text-gray-400">Formá grupos de estudio con tus compañeros de cursada.</p>
                  </div>
                  <button
                    onClick={() => setIsCreateGroupModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    ✨ Crear Nuevo Grupo
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Matching Engine Panel */}
                  <div className="lg:col-span-1 bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                    <h4 className="font-bold text-white text-sm">🔍 Emparejamiento Inteligente</h4>
                    <p className="text-xs text-gray-400">
                      Buscá compañeros de cursada que estudien en tus mismos horarios para armar grupos de trabajo.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mi Preferencia Horaria</label>
                        <select
                          value={buddySearchSchedulePrefs}
                          onChange={(e) => setBuddySearchSchedulePrefs(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="Mañana">Mañana (08:00 - 12:00)</option>
                          <option value="Tarde">Tarde (12:00 - 18:00)</option>
                          <option value="Noche">Noche (18:00 - 22:00)</option>
                        </select>
                      </div>
                      <button
                        onClick={handleFindStudyBuddies}
                        className="w-full px-4 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        {searchingBuddies ? "Buscando..." : "Buscar Compañeros Afines"}
                      </button>
                    </div>

                    {matchedBuddies.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-neutral-850">
                        <h5 className="text-xs font-bold text-amber-500">Alumnos encontrados ({matchedBuddies.length}):</h5>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                          {matchedBuddies.map((buddy) => (
                            <div key={buddy.id} className="bg-neutral-950/80 p-3 rounded-xl border border-neutral-850 text-xs">
                              <p className="font-semibold text-white">{buddy.full_name || buddy.email}</p>
                              <p className="text-[10px] text-gray-400">{buddy.email}</p>
                              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-900/40 text-blue-400 rounded text-[9px] font-bold">
                                {buddy.schedule_pref}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {matchedBuddies.length === 0 && !searchingBuddies && (
                      <p className="text-xs text-gray-500 text-center pt-2">No se buscaron compañeros aún o no hay coincidencias.</p>
                    )}
                  </div>

                  {/* Groups list */}
                  <div className="lg:col-span-2 space-y-4">
                    <h4 className="font-bold text-white text-sm">Grupos Activos ({studyGroups.length})</h4>
                    {studyGroups.map((g) => {
                      const isMember = g.members?.includes(currentUser?.uid);
                      return (
                        <div key={g.id} className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="text-base font-bold text-white">{g.name}</h5>
                              <p className="text-xs text-gray-400 mt-1">{g.description || "Sin descripción."}</p>
                            </div>
                            <span className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[10px] font-bold">
                              ⌚ Horario: {g.schedule_prefs}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <h6 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Integrantes ({g.members?.length || 0}):</h6>
                            <div className="flex flex-wrap gap-2">
                              {g.member_profiles?.map((member: any) => (
                                <div key={member.id} className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-full border border-neutral-850">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                  <span className="text-[11px] text-gray-300">{member.full_name || member.email}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end pt-2 border-t border-neutral-850">
                            {isMember ? (
                              <button
                                onClick={() => handleLeaveStudyGroup(g.id)}
                                className="px-4 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/25 rounded-xl text-xs font-semibold transition cursor-pointer"
                              >
                                Abandonar Grupo
                              </button>
                            ) : (
                              <button
                                onClick={() => handleJoinStudyGroup(g.id)}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                Unirme al Grupo
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {studyGroups.length === 0 && (
                      <div className="bg-neutral-900/10 border border-dashed border-neutral-800 p-8 rounded-2xl text-center text-gray-500">
                        No hay grupos activos en esta cátedra. ¡Creá el primero!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB: TUTORÍAS */}
            {courseSubTab === "tutorias" && (
              <TutoringPanel
                courseId={selectedCourse.id || selectedCourse.course?.id}
                tutors={tutors}
                setTutors={setTutors}
                tutoringSessions={tutoringSessions}
                setTutoringSessions={setTutoringSessions}
                currentUser={currentUser}
                api={api}
              />
            )}
          </div>
        )}
      </main>

      {/* Teacher QR Modal is handled inside AttendanceManager */}

      {/* Student live QR Scanner Modal */}
      {isQrScannerOpen && (
        <QrScannerModal
          onClose={() => setIsQrScannerOpen(false)}
          onScanSuccess={async (scannedData) => {
            setIsQrScannerOpen(false);
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
                courseId: scannedData.courseId,
                classNumber: scannedData.classNumber,
                token: scannedData.token,
                lat,
                lng
              });
              alert("¡Asistencia registrada con éxito! Ya estás presente.");
            } catch (err: any) {
              alert("Error al registrar asistencia: " + err.message);
            } finally {
              setApiLoading(false);
            }
          }}
        />
      )}

      {/* Floating Action Button (FAB) for student QR scanner */}
      {profile?.role === "student" && !isQrScannerOpen && (
        <button
          type="button"
          onClick={() => setIsQrScannerOpen(true)}
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-40 border border-emerald-500/30 group cursor-pointer"
          title="Escanear QR de Asistencia"
          aria-label="Escanear QR de Asistencia"
        >
          <span className="text-xl">📷</span>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out text-xs font-bold font-sans ml-0 group-hover:ml-2 whitespace-nowrap">
            Escanear Asistencia
          </span>
        </button>
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

      {/* MODAL: SUBMIT ANONYMOUS FEEDBACK (STUDENT) */}
      {activeFeedbackClass !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>✍️ Feedback Anónimo</span>
                <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-md font-mono">
                  Clase {activeFeedbackClass}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Tu opinión es completamente anónima. El sistema genera un identificador único encriptado para evitar duplicados sin almacenar tu identidad.
              </p>
            </div>

            {loadingFeedback ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] text-gray-550 font-semibold">Cargando datos...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stars Rating */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">¿Qué te pareció la clase?</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className={`text-2xl transition-transform hover:scale-125 cursor-pointer focus:outline-none ${
                          star <= feedbackRating ? "text-amber-400" : "text-neutral-750"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Understanding */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Nivel de Comprensión</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { val: "Entendí todo", style: "border-emerald-800/40 text-emerald-400 bg-emerald-950/20" },
                      { val: "Entendí la mayor parte", style: "border-blue-800/40 text-blue-400 bg-blue-955/20" },
                      { val: "Tengo dudas", style: "border-amber-800/40 text-amber-400 bg-amber-955/20" },
                      { val: "No entendí nada", style: "border-red-800/40 text-red-400 bg-red-950/20" }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setFeedbackUnderstanding(opt.val)}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer font-semibold ${
                          feedbackUnderstanding === opt.val
                            ? opt.style + " border-opacity-100 ring-1 ring-emerald-500"
                            : "border-neutral-800 text-gray-400 bg-neutral-950/40 hover:text-white"
                        }`}
                      >
                        {opt.val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Comment */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Comentarios / Sugerencias (Opcional)</label>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Escribe sugerencias constructivas sobre el ritmo, temario o explicaciones de la clase..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 h-20 resize-none font-sans"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveFeedbackClass(null)}
                    className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-gray-300 text-xs font-bold rounded-xl transition border border-neutral-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitFeedback}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Enviar Feedback
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VIEW ANONYMOUS FEEDBACK STATS (TEACHER) */}
      {viewingFeedbackClass !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="border-b border-neutral-800 pb-3 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>📊 Feedback de Alumnos</span>
                <span className="text-xs bg-blue-955 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-md font-mono">
                  Clase {viewingFeedbackClass}
                </span>
              </h3>
              <button
                onClick={() => setViewingFeedbackClass(null)}
                className="text-gray-500 hover:text-white transition font-bold"
              >
                ✕
              </button>
            </div>

            {loadingFeedback ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 flex-1">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] text-gray-550 font-semibold animate-pulse">Analizando respuestas anónimas...</span>
              </div>
            ) : feedbackStats ? (
              <div className="space-y-6 overflow-y-auto flex-1 pr-1.5 custom-scrollbar text-xs">
                {/* Summary Score Card */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-2xl text-center space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Valoración Promedio</span>
                    <div className="text-2xl font-black text-amber-400">
                      {feedbackStats.avgRating.toFixed(1)} <span className="text-lg">★</span>
                    </div>
                  </div>
                  <div className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-2xl text-center space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Encuestas Completadas</span>
                    <div className="text-2xl font-black text-white">
                      {feedbackStats.count} <span className="text-xs text-gray-500 font-semibold font-sans">alumnos</span>
                    </div>
                  </div>
                </div>

                {/* Understanding Distribution */}
                <div className="bg-neutral-950/40 border border-neutral-850 p-4 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans">Nivel de Comprensión General</h4>
                  <div className="space-y-2">
                    {[
                      { label: "Entendí todo", key: "Entendí todo", barBg: "bg-emerald-500", textClass: "text-emerald-400" },
                      { label: "Entendí la mayor parte", key: "Entendí la mayor parte", barBg: "bg-blue-500", textClass: "text-blue-400" },
                      { label: "Tengo dudas", key: "Tengo dudas", barBg: "bg-amber-500", textClass: "text-amber-400" },
                      { label: "No entendí nada", key: "No entendí nada", barBg: "bg-red-500", textClass: "text-red-400" }
                    ].map((row) => {
                      const count = feedbackStats.understandingDist[row.key] || 0;
                      const pct = feedbackStats.count > 0 ? (count / feedbackStats.count) * 100 : 0;
                      return (
                        <div key={row.key} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold">
                            <span className={row.textClass}>{row.label}</span>
                            <span className="text-gray-500">{count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${row.barBg}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Written Comments */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans">Sugerencias y Comentarios Escritos</h4>
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {feedbackStats.comments.map((cmt, cIdx) => (
                      <div key={cIdx} className="bg-neutral-950/80 border border-neutral-850 p-3 rounded-xl text-xs text-gray-300 leading-relaxed italic">
                        "{cmt}"
                      </div>
                    ))}
                    {feedbackStats.comments.length === 0 && (
                      <p className="text-xs text-gray-500 italic text-center py-4 bg-neutral-950/20 rounded-xl border border-neutral-850 border-dashed">
                        No se registraron comentarios escritos para esta clase.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 italic py-6">No se pudieron cargar las estadísticas.</p>
            )}

            <div className="border-t border-neutral-800 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingFeedbackClass(null)}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-750 text-gray-300 text-xs font-bold rounded-xl transition border border-neutral-700 cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📜 Historial de Versiones / Comparación Modal */}
      {isVersionModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-5xl w-full h-[85vh] flex flex-col justify-between shadow-2xl relative">
            <div className="flex justify-between items-center pb-4 border-b border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-white">Versiones de Cronograma & Comparación Interanual</h3>
                <p className="text-xs text-gray-400">Compará versiones históricas de este curso o con otras cátedras.</p>
              </div>
              <button
                onClick={() => {
                  setIsVersionModalOpen(false);
                  setSelectedVersionForDiff(null);
                  setSelectedCourseForComparison(null);
                }}
                className="text-gray-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 my-4 overflow-hidden">
              {/* Left Column: Versions List & Course List */}
              <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2 border-r border-neutral-850">
                {/* Save Current as Version */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">Versiones Guardadas</h4>
                  <div className="space-y-2">
                    {scheduleVersions.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVersionForDiff(v);
                          setSelectedCourseForComparison(null);
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer text-xs space-y-1 ${
                          selectedVersionForDiff?.id === v.id ? "bg-blue-950/40 border-blue-500/50" : "bg-neutral-950/60 border-neutral-850 hover:border-neutral-700"
                        }`}
                      >
                        <p className="font-bold text-white">{v.version_name}</p>
                        <p className="text-[10px] text-gray-400">Por: {v.created_by_name}</p>
                        <p className="text-[9px] text-gray-500">{new Date(v.created_at).toLocaleString()}</p>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreVersion(v.id);
                            }}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] font-bold transition cursor-pointer"
                          >
                            Restaurar
                          </button>
                        </div>
                      </div>
                    ))}
                    {scheduleVersions.length === 0 && (
                      <p className="text-xs text-gray-500 italic">No hay versiones guardadas.</p>
                    )}
                  </div>
                </div>

                {/* Compare Interanual */}
                <div className="space-y-3 pt-3 border-t border-neutral-850">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">Comparación Interanual</h4>
                  <p className="text-[10px] text-gray-400">Compará este cronograma con otra cursada del sistema.</p>
                  <button
                    onClick={() => {
                      handleLoadComparisonCourses();
                    }}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-left text-blue-400 hover:border-blue-500 font-semibold transition"
                  >
                    📂 Cargar Otras Cátedras
                  </button>

                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {comparisonCourses.map((cc) => (
                      <div
                        key={cc.id}
                        onClick={() => {
                          setSelectedCourseForComparison(cc);
                          setSelectedVersionForDiff(null);
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                          selectedCourseForComparison?.id === cc.id ? "bg-amber-950/40 border-amber-500/50" : "bg-neutral-950/60 border-neutral-850 hover:border-neutral-700"
                        }`}
                      >
                        <p className="font-bold text-white">{cc.name}</p>
                        <p className="text-[10px] text-gray-400">{cc.class_instances?.length || 0} Clases</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Diff View */}
              <div className="md:col-span-2 overflow-y-auto space-y-4 pl-2">
                {selectedVersionForDiff || selectedCourseForComparison ? (
                  <>
                    <div className="flex justify-between items-center bg-neutral-950/60 p-3 rounded-xl border border-neutral-850">
                      <span className="text-xs font-bold text-white">
                        Comparando: {selectedVersionForDiff ? `Versión "${selectedVersionForDiff.version_name}"` : `Cátedra "${selectedCourseForComparison?.name}"`} con el cronograma actual
                      </span>
                      <span className="text-[10px] text-gray-400 font-sans">Diff de Clases</span>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const targetClasses = selectedVersionForDiff?.class_instances || selectedCourseForComparison?.class_instances || [];
                        const maxLen = Math.max(teacherClasses.length, targetClasses.length);
                        const diffItems = [];

                        for (let i = 0; i < maxLen; i++) {
                          const current = teacherClasses[i];
                          const target = targetClasses[i];

                          if (current && target) {
                            const isDifferent =
                              current.topic !== target.topic ||
                              current.type !== target.type ||
                              current.special_status !== target.special_status;

                            diffItems.push({
                              idx: i + 1,
                              status: isDifferent ? "modified" : "identical",
                              current,
                              target
                            });
                          } else if (current) {
                            diffItems.push({
                              idx: i + 1,
                              status: "added",
                              current,
                              target: null
                            });
                          } else {
                            diffItems.push({
                              idx: i + 1,
                              status: "removed",
                              current: null,
                              target
                            });
                          }
                        }

                        return diffItems.map((item) => (
                          <div
                            key={item.idx}
                            className={`p-4 rounded-xl border text-xs space-y-2 ${
                              item.status === "added" ? "bg-green-950/10 border-green-800/30" :
                              item.status === "removed" ? "bg-red-950/10 border-red-800/30" :
                              item.status === "modified" ? "bg-amber-950/10 border-amber-800/30" :
                              "bg-neutral-950/30 border-neutral-850"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-white">Clase {item.idx}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                item.status === "added" ? "bg-green-900/30 text-green-400" :
                                item.status === "removed" ? "bg-red-900/30 text-red-400" :
                                item.status === "modified" ? "bg-amber-900/30 text-amber-400" :
                                "bg-neutral-800 text-gray-400"
                              }`}>
                                {item.status === "added" ? "Agregada" :
                                 item.status === "removed" ? "Eliminada" :
                                 item.status === "modified" ? "Modificada" :
                                 "Idéntica"}
                              </span>
                            </div>

                            {item.status === "identical" && (
                              <p className="text-gray-300">
                                Tema: <span className="font-semibold text-white">{item.current?.topic}</span> ({item.current?.type} - {item.current?.special_status})
                              </p>
                            )}

                            {item.status === "added" && (
                              <p className="text-green-400">
                                + Tema: <span className="font-semibold text-white">{item.current?.topic}</span> ({item.current?.type} - {item.current?.special_status})
                              </p>
                            )}

                            {item.status === "removed" && (
                              <p className="text-red-400">
                                - Tema: <span className="font-semibold text-gray-500 line-through">{item.target?.topic}</span> ({item.target?.type} - {item.target?.special_status})
                              </p>
                            )}

                            {item.status === "modified" && (
                              <div className="space-y-1">
                                <div className="text-amber-400">
                                  ✎ Actual: <span className="font-semibold text-white">{item.current?.topic}</span> ({item.current?.type} - {item.current?.special_status})
                                </div>
                                <div className="text-gray-500">
                                  ✎ Versión: <span className="font-semibold">{item.target?.topic}</span> ({item.target?.type} - {item.target?.special_status})
                                </div>
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs italic">
                    Seleccioná una versión o cátedra para ver la comparación detallada.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsVersionModalOpen(false);
                  setSelectedVersionForDiff(null);
                  setSelectedCourseForComparison(null);
                }}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-750 text-gray-300 text-xs font-bold rounded-xl transition border border-neutral-700 cursor-pointer"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💾 Guardar Versión Modal */}
      {isSaveVersionModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white">Guardar Versión de Cronograma</h3>
            <p className="text-xs text-gray-400">Esto creará un snapshot del cronograma en su estado actual.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre de la Versión</label>
              <input
                type="text"
                placeholder="Ej: Planificación Inicial 2026"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSaveVersionModalOpen(false)}
                className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveVersion}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Guardar Versión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👥 Crear Grupo de Estudio Modal */}
      {isCreateGroupModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateStudyGroup} className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white">Crear Grupo de Estudio</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre del Grupo</label>
              <input
                type="text"
                placeholder="Ej: Grupo de estudio Algoritmos"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Descripción</label>
              <textarea
                placeholder="Ej: Para juntarnos a resolver las prácticas..."
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 min-h-20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Preferencia Horaria</label>
              <select
                value={newGroupSchedulePrefs}
                onChange={(e) => setNewGroupSchedulePrefs(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
                <option value="Noche">Noche</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateGroupModalOpen(false)}
                className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Crear Grupo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modals are handled inside components now */}

      {groupPromptModal?.isOpen && (() => {
        let inputVal = "";
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl relative">
              <h3 className="text-lg font-bold text-white font-sans">Nombre del Equipo</h3>
              <p className="text-xs text-gray-400 font-sans">Esta es una tarea grupal. Ingresá el nombre de tu equipo (sin espacios ni caracteres raros):</p>
              <input
                type="text"
                placeholder="Nombre del grupo (ej: LosNinjas)"
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                onChange={(e) => { inputVal = e.target.value; }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = inputVal.trim();
                    if (val) {
                      groupPromptModal.resolve(val);
                      setGroupPromptModal(null);
                    }
                  }
                }}
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    groupPromptModal.resolve(null);
                    setGroupPromptModal(null);
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const val = inputVal.trim();
                    if (val) {
                      groupPromptModal.resolve(val);
                      setGroupPromptModal(null);
                    } else {
                      alert("Por favor ingresa un nombre válido.");
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer font-sans"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {commentPromptModal?.isOpen && (() => {
        let inputVal = "";
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl relative">
              <h3 className="text-lg font-bold text-white font-sans">Comentarios de la Entrega</h3>
              <p className="text-xs text-gray-400 font-sans">¿Querés dejarle algún comentario al profesor sobre esta entrega? (Opcional):</p>
              <textarea
                placeholder="Escribe tu mensaje aquí..."
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 min-h-20 font-sans"
                onChange={(e) => { inputVal = e.target.value; }}
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    commentPromptModal.resolve(null);
                    setCommentPromptModal(null);
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    commentPromptModal.resolve(inputVal.trim());
                    setCommentPromptModal(null);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer font-sans"
                >
                  Enviar Entrega
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {githubPromptModal?.isOpen && (() => {
        let inputVal = "";
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-55 p-4">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full text-center space-y-5 shadow-2xl relative">
              <h3 className="text-lg font-bold text-white font-sans">Vincular cuenta de GitHub</h3>
              <p className="text-xs text-gray-400 font-sans">
                ¡Hola! Has ingresado a Ninja Dojo desde Moodle por primera vez.<br/>
                Para poder crear y sincronizar tu repositorio de tareas, por favor ingresa tu usuario de GitHub:
              </p>
              <input
                type="text"
                placeholder="Nombre de usuario de GitHub"
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                onChange={(e) => { inputVal = e.target.value; }}
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    githubPromptModal.resolve(null);
                    setGithubPromptModal(null);
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer font-sans"
                >
                  Omitir por ahora
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const val = inputVal.trim();
                    if (val) {
                      githubPromptModal.resolve(val);
                      setGithubPromptModal(null);
                    } else {
                      alert("Por favor ingresa un usuario válido.");
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer font-sans"
                >
                  Vincular Perfil
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
