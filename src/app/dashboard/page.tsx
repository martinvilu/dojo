"use client";

import { CourseStudentsPanel } from "@/modules/course/components/CourseStudentsPanel";
import { CourseOverviewPanel } from "@/modules/course/components/CourseOverviewPanel";
import { CourseSchedulesPanel } from "@/modules/course/components/CourseSchedulesPanel";
import { useState, useEffect, useRef, useMemo } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db, functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import { marked } from "marked";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, updateDoc, getDoc, getDocs, writeBatch, arrayUnion, arrayRemove } from "firebase/firestore";
import AdminPanel from "@/modules/course/components/AdminPanel";
import StudentPanel from "@/modules/course/components/StudentPanel";
import ProfilePanel from "@/modules/auth/components/ProfilePanel";
import TeacherPanel from "@/modules/course/components/TeacherPanel";
import StudyGroupsPanel from "@/modules/study_groups/components/StudyGroupsPanel";
import AssignmentsPanel from "@/modules/github/components/AssignmentsPanel";
import GithubActivityPanel from "@/modules/github/components/GithubActivityPanel";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import TutoringPanel from "@/modules/tutoring/components/TutoringPanel";
import AttendanceManager from "@/modules/attendance/components/AttendanceManager";
import ClassCommentsThread from "@/modules/course/components/comments/ClassCommentsThread";
import QrScannerModal from "@/modules/attendance/components/QrScannerModal";
import CalendarPanel from "@/modules/calendar/components/CalendarPanel";
import { useGmailAuth } from "@/modules/mail/hooks/useGmailAuth";
import GmailIntegrationCard from "@/modules/mail/components/GmailIntegrationCard";
import EmailManagementPanel from "@/modules/mail/components/EmailManagementPanel";
import DirectEmailModal from "@/modules/mail/components/DirectEmailModal";
import MoodleIntegrationPanel from "@/modules/moodle/components/MoodleIntegrationPanel";
import { copyToClipboard } from "@/lib/clipboard";

import { api } from "@/lib/api";

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

  
  // Pending Matricula inputs
  const [matriculaInput, setMatriculaInput] = useState("");
  const [matriculaError, setMatriculaError] = useState("");

  // Profile Edit state
  const [profileName, setProfileName] = useState("");
  const [profileMatricula, setProfileMatricula] = useState("");
  const [profileCohorte, setProfileCohorte] = useState("");
  const [profileGithubUser, setProfileGithubUser] = useState("");
  const [xpLogs, setXpLogs] = useState<any[]>([]);
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});

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
  const pastDueAssignments = useMemo(() => {
    const now = new Date();
    return new Set(
      assignments
        .filter((a) => a.due_date && now > new Date(a.due_date))
        .map((a) => a.id)
    );
  }, [assignments]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Grader & GitHub activity states
  const [courseSubmissions, setCourseSubmissions] = useState<any[]>([]);

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

  // Gmail OAuth Integration
  const {
    gmailStatus,
    handleStartAuth: handleStartGmailAuth,
    handleDisconnect: handleDisconnectGmail,
    handleSendTest: handleSendTestGmail,
    refreshStatus: getGmailAuthStatus
  } = useGmailAuth(api);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [selectedDirectEmailStudent, setSelectedDirectEmailStudent] = useState<any | null>(null);

  // Expanded Moodle Integration states
  const [moodleApiUrl, setMoodleApiUrl] = useState<string>("");
  const [moodleWsToken, setMoodleWsToken] = useState<string>("");
  const [moodleCourseId, setMoodleCourseId] = useState<string>("");

  // Teacher Central Dashboard states
  const [overviewSubmissionsList, setOverviewSubmissionsList] = useState<any[]>([]);
  const [loadingOverviewSubmissions, setLoadingOverviewSubmissions] = useState<boolean>(false);

  // Announcements states
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState("");

  // CSV Endpoint collapsible state (normally hidden)
  const [showCsvEndpoint, setShowCsvEndpoint] = useState(false);
  const [showCsvGradingEndpoint, setShowCsvGradingEndpoint] = useState(false);

  // Calendar render state
  const [calendarViewMode, setCalendarViewMode] = useState<"list" | "grid">("list");


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

  // Backups states
  const [systemBackups, setSystemBackups] = useState<any[]>([]);

  // Custom Prompts states (non-blocking alternative to native prompt)

  const [githubPromptModal, setGithubPromptModal] = useState<{
    isOpen: boolean;
    resolve: (username: string | null) => void;
  } | null>(null);

  // Study Groups states
  const [studyGroups, setStudyGroups] = useState<any[]>([]);
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
      showToast("¡Asistencia registrada con éxito! Ya estás presente.", "success");
      setStudentActiveAttendanceClass(null);
      setStudentQrToken("");
    } catch (err: any) {
      showToast("Error al registrar asistencia: " + err.message, "error");
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
            await Promise.all(
              courseIds.map(async (cid: string) => {
                try {
                  const detail = await api("getCourseDetails", { courseId: cid });
                  const cName = detail?.name || safeCourses.find((x: any) => (x.id || x.course?.id) === cid)?.name || "Cátedra";
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
            const data = (res && (res.start_date !== undefined || res.invite_code !== undefined)) ? res : (res?.data || selectedCourse || {});
            setTeacherStartDate(data.start_date || selectedCourse?.start_date || "");
            setTeacherDuration(data.duration_weeks ? data.duration_weeks.toString() : (selectedCourse?.duration_weeks ? selectedCourse.duration_weeks.toString() : ""));
            setTeacherCoverText(data.cover_text || selectedCourse?.cover_text || "");
            setTeacherGithubToken(data.github_token || selectedCourse?.github_token || "");
            setTeacherMoodleEnabled(data.moodle_enabled || selectedCourse?.moodle_enabled || false);
            setTeacherExternalCalendars(Array.isArray(data.external_calendars) ? data.external_calendars.join(", ") : (data.external_calendars || ""));
            setTeacherSchedules(data.schedules || selectedCourse?.schedules || []);
            const comms = Array.isArray(data.commissions) ? data.commissions : (Array.isArray(selectedCourse?.commissions) ? selectedCourse.commissions : ["Comisión A", "Comisión B"]);
            setTeacherCommissions(comms);
            
            

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
            setTeacherStartDate(data.start_date || selectedCourse?.start_date || "");
            setTeacherDuration(data.duration_weeks ? data.duration_weeks.toString() : (selectedCourse?.duration_weeks ? selectedCourse.duration_weeks.toString() : ""));
            setTeacherCoverText(data.cover_text || selectedCourse?.cover_text || "");
            setTeacherGithubToken(data.github_token || selectedCourse?.github_token || "");
            setTeacherMoodleEnabled(data.moodle_enabled || selectedCourse?.moodle_enabled || false);
            setTeacherExternalCalendars(Array.isArray(data.external_calendars) ? data.external_calendars.join(", ") : (data.external_calendars || ""));
            setTeacherSchedules(data.schedules || selectedCourse?.schedules || []);
            const comms = Array.isArray(data.commissions) ? data.commissions : (Array.isArray(selectedCourse?.commissions) ? selectedCourse.commissions : ["Comisión A", "Comisión B"]);
            setTeacherCommissions(comms);
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

  const handleUpdateUserProfile = async (uid: string, data: any) => {
    setApiLoading(true);
    try {
      await api("updateUserProfile", { userId: uid, data });
      const res = await api("getAdminUsers");
      setUsers(res || []);
    } catch (err: any) {
      setError("Error al actualizar perfil de usuario: " + err.message);
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
      showToast("Configuración guardada.", "success");
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
      showToast("¡Te has enrolado con éxito!", "success");
    } catch (err: any) {
      showToast("Error al enrolarse: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };




  // Teacher Schedule settings manipulation
  const handleAddSchedule = () => {
    if (!scheduleTime) return showToast("Poné una hora válida.", "success");
    setTeacherSchedules([...teacherSchedules, { day: scheduleDay, time: scheduleTime, type: scheduleType }]);
    setScheduleTime("");
  };

  const handleRemoveSchedule = (idx: number) => {
    setTeacherSchedules(teacherSchedules.filter((_, i) => i !== idx));
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

      showToast("Configuración de cátedra guardada.", "success");
    } catch (err: any) {
      showToast("Error al guardar configuración: " + err.message, "error");
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
      showToast("Configuración clonada exitosamente.", "success");
    } catch (err: any) {
      showToast("Error al clonar configuración: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };






  const handleExportMoodleXml = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const res = await api("exportCourseToMoodleXml", { courseId: cid });
      if (res?.mbzBase64) {
        const binaryStr = atob(res.mbzBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/x-gzip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "moodle_backup.mbz";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("¡Archivo de Respaldo MBZ (Moodle 4.2) generado y descargado exitosamente!", "success");
      } else if (res?.xmlContent) {
        const blob = new Blob([res.xmlContent], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "moodle_backup.xml";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("¡Respaldo XML de Moodle generado y descargado exitosamente!", "success");
      }
    } catch (err: any) {
      showToast("Error al exportar curso a Moodle: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleSyncMoodleRoster = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    if (!moodleApiUrl || !moodleWsToken || !moodleCourseId) {
      showToast("Por favor completá la URL de Moodle, el Token de Web Service y el ID del curso de Moodle.", "success");
      return;
    }
    setApiLoading(true);
    try {
      const res = await api("syncMoodleCourseRoster", {
        courseId: cid,
        moodleUrl: moodleApiUrl,
        moodleToken: moodleWsToken,
        moodleCourseId: moodleCourseId
      });
      showToast(`¡Sincronización completada! ${res.syncedCount} estudiantes sincronizados desde un total de ${res.totalMoodleUsers} usuarios en Moodle.`, "success");
    } catch (err: any) {
      showToast("Error al sincronizar roster desde Moodle: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };




  // Schedule Versioning & History actions






  // Backups and Alerts actions
  const handleCreateBackup = async () => {
    setApiLoading(true);
    try {
      const res = await api("createSystemBackup");
      showToast("Respaldo creado correctamente con ID: " + res.backupId, "success");
      const backupsRes = await api("getSystemBackups");
      setSystemBackups(backupsRes || []);
    } catch (err: any) {
      showToast("Error al crear respaldo: " + err.message, "error");
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
      showToast("Error al descargar respaldo: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleRestoreBackupDocument = async (backupId: string, collectionName: string, docId: string) => {
    if (!confirm(`¿Seguro que querés restaurar el documento ${docId} de la colección ${collectionName}? Sobrescribirá los datos actuales en la base de datos remota.`)) return;
    setApiLoading(true);
    try {
      await api("restoreBackupDocument", { backupId, collectionName, docId });
      showToast("Documento restaurado con éxito.", "success");
    } catch (err: any) {
      showToast("Error al restaurar documento: " + err.message, "error");
    } finally {
      setApiLoading(false);
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
      showToast("¡Feedback enviado de forma anónima! Muchas gracias.", "success");
      setActiveFeedbackClass(null);
    } catch (err: any) {
      showToast("Error al enviar feedback: " + err.message, "error");
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
      showToast("Error al cargar feedback: " + err.message, "error");
    } finally {
      setLoadingFeedback(false);
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
      showToast("Aviso enviado a la cátedra.", "success");
    } catch (err: any) {
      showToast("Error al enviar aviso: " + err.message, "error");
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
        full_name: profileName,
        matricula_unrn: profileMatricula, 
        cohorte: profileCohorte,
        github_user: profileGithubUser 
      });
      const profileRes = await api("getProfile");
      setProfile(profileRes);
      showToast("Perfil actualizado correctamente.", "success");
    } catch (err: any) {
      setError("Error al actualizar perfil: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleAddSecondaryEmail = async (email: string) => {
    setApiLoading(true);
    try {
      await api("addSecondaryEmail", { email });
      const profileRes = await api("getProfile");
      setProfile(profileRes);
      showToast("Correo secundario vinculado exitosamente.", "success");
    } catch (err: any) {
      showToast("Error al vincular correo secundario: " + err.message, "error");
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
      showToast("Error al cargar detalles de la cátedra: " + err.message, "error");
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
            handleUpdateUserProfile={handleUpdateUserProfile}
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
          profileName={profileName}
          setProfileName={setProfileName}
          profileMatricula={profileMatricula}
          setProfileMatricula={setProfileMatricula}
          profileCohorte={profileCohorte}
          setProfileCohorte={setProfileCohorte}
          profileGithubUser={profileGithubUser}
          setProfileGithubUser={setProfileGithubUser}
          handleUpdateProfile={handleUpdateProfile}
          handleAddSecondaryEmail={handleAddSecondaryEmail}
          xpLogs={xpLogs}
          gmailStatus={gmailStatus}
          handleStartGmailAuth={handleStartGmailAuth}
          handleDisconnectGmail={handleDisconnectGmail}
          handleSendTestGmail={handleSendTestGmail}
          testEmailAddress={testEmailAddress}
          setTestEmailAddress={setTestEmailAddress}
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
                    onClick={() => setCourseSubTab("emails")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "emails" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    📧 Gestión Correos
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
                <div 
                  onClick={() => setActiveTab("profile")}
                  className="bg-gradient-to-r from-blue-955/20 via-neutral-900/60 to-purple-955/20 border border-neutral-800 hover:border-blue-500/50 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-lg animate-fade-in cursor-pointer transition group"
                  title="Haz clic para ver tu bitácora de puntos de experiencia (XP) en Mi Perfil"
                >
                  <div className="space-y-2.5 flex-1">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl animate-bounce">🥷</span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest font-sans">Rango Ninja de Cursada</h4>
                          <span className="text-[10px] text-blue-400 group-hover:underline font-semibold">📜 Ver bitácora XP ↗</span>
                        </div>
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
              <CourseOverviewPanel
                profile={profile}
                selectedCourse={selectedCourse}
                assignments={assignments}
                setAssignments={setAssignments}
                showToast={showToast}
                setApiLoading={setApiLoading}
                overviewSubmissionsList={overviewSubmissionsList}
                loadingOverviewSubmissions={loadingOverviewSubmissions}
                roster={roster}
                courseAttendance={courseAttendance}
                courseSubmissions={courseSubmissions}
                pastDueAssignments={pastDueAssignments}
                setCourseSubTab={setCourseSubTab}
              />
            )}


            {/* SUBTAB 1. CRONOGRAMA / CLASES */}

            {courseSubTab === "schedules" && (
              <CourseSchedulesPanel
                profile={profile}
                selectedCourse={selectedCourse}
                teacherClasses={teacherClasses}
                setTeacherClasses={setTeacherClasses}
                teacherSchedules={teacherSchedules}
                teacherStartDate={teacherStartDate}
                teacherDuration={teacherDuration}
                showToast={showToast}
                setApiLoading={setApiLoading}
                collapsedClasses={collapsedClasses}
                setCollapsedClasses={setCollapsedClasses}
                handleOpenFeedbackModal={handleOpenFeedbackModal}
                weeklyClassesGrouped={weeklyClassesGrouped}
                expandedComments={expandedComments}
                courseCommissions={courseCommissions}
                courseAttendance={courseAttendance}
                roster={roster}
                setActiveAttendanceClass={setActiveAttendanceClass}
                activeAttendanceClass={activeAttendanceClass}
                handleLoadClassFeedback={handleLoadClassFeedback}
                toggleComments={toggleComments}
                courseComments={courseComments}
              />
            )}


            {/* SUBTAB 2. TAREAS (ASSIGNMENTS) */}
            {courseSubTab === "assignments" && (
              <AssignmentsPanel
                selectedCourse={selectedCourse}
                profile={profile}
                courseCommissions={courseCommissions}
                showToast={showToast}
                setApiLoading={setApiLoading}
                api={api}
                assignments={assignments}
                setAssignments={setAssignments}
                submissions={submissions}
                setSubmissions={setSubmissions}
                commissionFilter={commissionFilter}
                setCommissionFilter={setCommissionFilter}
                setSelectedDirectEmailStudent={setSelectedDirectEmailStudent}
                moodleLtiParams={moodleLtiParams}
                moodleApiUrl={moodleApiUrl}
                moodleWsToken={moodleWsToken}
                moodleCourseId={moodleCourseId}
              />
            )}

            {/* SUBTAB ALUMNOS Y ALERTAS */}

            {courseSubTab === "students" && (
              <CourseStudentsPanel
                profile={profile}
                selectedCourse={selectedCourse}
                roster={roster}
                setRoster={setRoster}
                courseAttendance={courseAttendance}
                courseSubmissions={courseSubmissions}
                assignments={assignments}
                pastDueAssignments={pastDueAssignments}
                showToast={showToast}
                setApiLoading={setApiLoading}
                commissionFilter={commissionFilter}
                setCommissionFilter={setCommissionFilter}
              />
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

            {/* SUBTAB 4. AJUSTES CÁTEDRA */}
            {courseSubTab === "settings" && (profile?.role === "teacher" || profile?.role === "admin") && (
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
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-gray-400">GitHub Personal Access Token (PAT)</label>
                      {teacherGithubToken && (
                        <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-mono font-bold">
                          ✓ Token Cargado (••••••••)
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={teacherGithubToken}
                      onChange={(e) => setTeacherGithubToken(e.target.value)}
                      placeholder={teacherGithubToken ? "••••••••••••••••" : "ghp_..."}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                    />
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">¿Necesitás generar un token?</span>
                      <a
                        href="https://github.com/settings/tokens/new?description=NinjaDojo_PAT&scopes=repo,admin:org,read:user"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1 underline"
                      >
                        <span>🔑 Generar PAT en GitHub con permisos necesarios (repo, admin:org) ↗</span>
                      </a>
                    </div>
                  </div>

                  <GmailIntegrationCard 
                    gmailStatus={gmailStatus}
                    handleStartAuth={handleStartGmailAuth}
                    handleDisconnect={handleDisconnectGmail}
                    handleSendTest={handleSendTestGmail}
                  />

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
                    <MoodleIntegrationPanel
                      courseId={selectedCourse.id || selectedCourse.course?.id}
                      courseName={selectedCourse.name || "Cátedra"}
                      api={api}
                      onExportXml={handleExportMoodleXml}
                      onSyncRoster={handleSyncMoodleRoster}
                      moodleApiUrl={moodleApiUrl}
                      setMoodleApiUrl={setMoodleApiUrl}
                      moodleWsToken={moodleWsToken}
                      setMoodleWsToken={setMoodleWsToken}
                      moodleCourseId={moodleCourseId}
                      setMoodleCourseId={setMoodleCourseId}
                    />
                  )}

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
                          value={typeof window !== "undefined" ? `${window.location.origin}/api/calendar?id=${selectedCourse.id || selectedCourse.course?.id}` : `https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app/api/calendar?id=${selectedCourse.id || selectedCourse.course?.id}`}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-gray-300 select-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const cid = selectedCourse.id || selectedCourse.course?.id || "";
                            const url = typeof window !== "undefined" ? `${window.location.origin}/api/calendar?id=${cid}` : `https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app/api/calendar?id=${cid}`;
                            const ok = await copyToClipboard(url);
                            showToast(ok ? "¡Enlace de calendario copiado con éxito al portapapeles!" : "No se pudo copiar automáticamente.", "success");
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cid = selectedCourse.id || selectedCourse.course?.id || "";
                            const feedUrl = typeof window !== "undefined" ? `${window.location.origin}/api/calendar?id=${cid}` : `https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app/api/calendar?id=${cid}`;
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
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-gray-400">Texto de Portada</label>
                      {teacherCoverText && (
                        <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-mono font-bold">
                          ✓ Portada Cargada ({teacherCoverText.length} caracteres)
                        </span>
                      )}
                    </div>
                    <textarea
                      value={teacherCoverText}
                      onChange={(e) => setTeacherCoverText(e.target.value)}
                      placeholder="Detalles sobre la cátedra..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white h-20"
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
                            showToast("Esa comisión ya existe.", "success");
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

                {/* CSV grading synchronization (NORMALLY COLLAPSED/HIDDEN) */}
                <div className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowCsvGradingEndpoint(!showCsvGradingEndpoint)}
                    className="w-full flex justify-between items-center text-sm font-bold text-gray-200 hover:text-white transition cursor-pointer select-none"
                  >
                    <span>📊 Sincronización de Planilla de Notas (CSV / Google Sheets)</span>
                    <span className="text-[10px] bg-neutral-950 px-3 py-1 rounded-lg border border-neutral-800 text-gray-400 font-semibold">
                      {showCsvGradingEndpoint ? "▲ Ocultar URL" : "▼ Mostrar URL"}
                    </span>
                  </button>

                  {showCsvGradingEndpoint && (
                    <div className="pt-3 space-y-3 border-t border-neutral-800/80 animate-in fade-in duration-200">
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Usa esta URL para sincronizar las notas de tus alumnos de esta cátedra directamente en tu planilla externa:
                      </p>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          readOnly
                          value={`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/exportGradesCsv?courseId=${selectedCourse.id || selectedCourse.course?.id}&token=${selectedCourse.sync_secret || "TOKEN"}`}
                          className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-amber-400 font-mono select-all"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const url = `https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/exportGradesCsv?courseId=${selectedCourse.id || selectedCourse.course?.id}&token=${selectedCourse.sync_secret || "TOKEN"}`;
                            const ok = await copyToClipboard(url);
                            showToast(ok ? "¡URL del Endpoint CSV de Notas copiada al portapapeles con éxito!" : "No se pudo copiar la URL.", "success");
                          }}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
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

            {/* SUBTAB GESTIÓN DE CORREOS */}
            {courseSubTab === "emails" && (profile?.role === "teacher" || profile?.role === "admin") && (
              <EmailManagementPanel
                courseId={selectedCourse.id || selectedCourse.course?.id}
                courseName={selectedCourse.name || "Cátedra"}
                api={api}
                gmailStatus={gmailStatus}
                onStartGmailAuth={handleStartGmailAuth}
              />
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
              <StudyGroupsPanel
                courseId={selectedCourse.id || selectedCourse.course?.id}
                studyGroups={studyGroups}
                setStudyGroups={setStudyGroups}
                currentUser={currentUser}
                api={api}
              />
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
              showToast("¡Asistencia registrada con éxito! Ya estás presente.", "success");
            } catch (err: any) {
              showToast("Error al registrar asistencia: " + err.message, "error");
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full min-w-[280px] sm:min-w-[380px] shrink-0 mx-auto text-center space-y-5 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full min-w-[280px] sm:min-w-[420px] shrink-0 mx-auto p-6 space-y-6 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full min-w-[280px] sm:min-w-[480px] shrink-0 mx-auto p-6 space-y-6 shadow-2xl relative z-10 max-h-[90vh] flex flex-col">
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

      {/* 💾 Guardar Versión Modal */}


      {/* Modals are handled inside components now */}


      {githubPromptModal?.isOpen && (() => {
        let inputVal = "";
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full min-w-[280px] sm:min-w-[380px] shrink-0 mx-auto text-center space-y-5 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
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
                      showToast("Por favor ingresa un usuario válido.", "success");
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
      
      {selectedDirectEmailStudent && (
        <DirectEmailModal
          student={selectedDirectEmailStudent}
          courseName={selectedCourse?.name || "Cátedra"}
          courseId={selectedCourse?.id || selectedCourse?.course?.id}
          onClose={() => setSelectedDirectEmailStudent(null)}
          api={api}
        />
      )}

    </div>
  );
}
