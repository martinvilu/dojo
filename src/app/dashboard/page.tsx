"use client";

import { CourseStudentsPanel } from "@/modules/course/components/CourseStudentsPanel";

import { CourseSettingsPanel } from "@/modules/course/components/CourseSettingsPanel";
import { CourseTeachersPanel } from "@/modules/course/components/CourseTeachersPanel";
import { CourseAnnouncementsPanel } from "@/modules/course/components/CourseAnnouncementsPanel";

import { CourseOverviewPanel } from "@/modules/course/components/CourseOverviewPanel";
import { CourseSchedulesPanel } from "@/modules/course/components/CourseSchedulesPanel";
import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import AdminPanel from "@/modules/course/components/AdminPanel";
import StudentPanel from "@/modules/course/components/StudentPanel";
import ProfilePanel from "@/modules/auth/components/ProfilePanel";
import TeacherPanel from "@/modules/course/components/TeacherPanel";
import StudyGroupsPanel from "@/modules/study_groups/components/StudyGroupsPanel";
import AssignmentsPanel from "@/modules/github/components/AssignmentsPanel";
import { GithubPromptModal } from "@/modules/github/components/GithubPromptModal";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import TutoringPanel from "@/modules/tutoring/components/TutoringPanel";
import { FeedbackModals } from "@/modules/course/components/FeedbackModals";
import { StudentAttendanceModals } from "@/modules/attendance/components/StudentAttendanceModals";
import { useGmailAuth } from "@/modules/mail/hooks/useGmailAuth";

import { api } from "@/lib/api";
import { useTheme } from "./hooks/useTheme";
import { useGithubPromptModal } from "./hooks/useGithubPromptModal";
import { useClassFeedback } from "./hooks/useClassFeedback";
import { useStudentQrAttendance } from "./hooks/useStudentQrAttendance";
import CommandPalette from "@/components/dashboard/ui/CommandPalette";
import { useAnnouncements } from "./hooks/useAnnouncements";
import { useTeacherCourseSettings } from "./hooks/useTeacherCourseSettings";
import { useBackups } from "./hooks/useBackups";
import { useAuthProfile } from "./hooks/useAuthProfile";
import { useDeepLinks } from "./hooks/useDeepLinks";
import { useAdminPanel } from "./hooks/useAdminPanel";

// Heavy panels rendered conditionally; keep them out of the initial bundle
const PanelFallback = () => (
  <div className="p-6 text-center text-sm text-gray-400" role="status">Cargando módulo…</div>
);
const CalendarPanel = dynamic(() => import("@/modules/calendar/components/CalendarPanel"), { loading: () => <PanelFallback /> });
const EmailManagementPanel = dynamic(() => import("@/modules/mail/components/EmailManagementPanel"), { loading: () => <PanelFallback /> });
const DirectEmailModal = dynamic(() => import("@/modules/mail/components/DirectEmailModal"), { loading: () => <PanelFallback /> });

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


export default function DashboardPage() {
  const [apiLoading, setApiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const [error, setError] = useState("");

  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});

  // Data states
  const [courses, setCourses] = useState<any[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassInstance[]>([]);
  const [, setGlobalSettings] = useState<any>({});
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [courseSubTab, setCourseSubTab] = useState("schedules");
  const [courseTeachers, setCourseTeachers] = useState<any[]>([]);

  const handleSetCourseSubTab = (tab: string) => {
    setCourseSubTab(tab);
    if (selectedCourse?.id || selectedCourse?.course?.id) {
      const cid = selectedCourse.id || selectedCourse.course.id;
      window.history.pushState(null, "", `/dashboard/courses/${cid}/${tab}`);
    }
  };

  // Admin management domain
  const {
    users, setUsers,
    allTeachersList, setAllTeachersList,
    selectedNewTeacherId, setSelectedNewTeacherId,
    newCourseName, setNewCourseName,
    newCourseOrg, setNewCourseOrg,
    globalCalendarUrl, setGlobalCalendarUrl,
    handleApproveUser, handleDeleteUser, handleUpdateUserRole, handleUpdateUserProfile,
    handleAssignTeacher, handleRemoveTeacher,
    handleCreateCourse, handleSaveSettings
  } = useAdminPanel({
    getSelectedCourseId: () => selectedCourse?.id || selectedCourse?.course?.id,
    setCourses, setCourseTeachers, setApiLoading, setError
  });


  // Form states
  const { theme, toggleTheme } = useTheme();

  const [enrollCode, setEnrollCode] = useState("");

  // Session & profile domain
  const {
    currentUser, profile, setProfile, loading,
    matriculaInput, setMatriculaInput, matriculaError,
    profileName, setProfileName, profileMatricula, setProfileMatricula,
    profileCohorte, setProfileCohorte, profileGithubUser, setProfileGithubUser,
    xpLogs, setXpLogs,
    handleLogout, handleSubmitMatricula, handleUpdateProfile, handleAddSecondaryEmail
  } = useAuthProfile({ setActiveTab, setApiLoading, setError });

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
  const {
    studentActiveAttendanceClass, setStudentActiveAttendanceClass,
    studentQrToken, setStudentQrToken,
    studentAttendanceGeoLoading, setStudentAttendanceGeoLoading,
    isQrScannerOpen, setIsQrScannerOpen,
    handleSubmitStudentAttendanceQr
  } = useStudentQrAttendance({ selectedCourse, setApiLoading });

  const {
    teacherStartDate, setTeacherStartDate,
    teacherDuration, setTeacherDuration,
    teacherCoverText, setTeacherCoverText,
    teacherGithubToken, setTeacherGithubToken,
    teacherMoodleEnabled, setTeacherMoodleEnabled,
    teacherExternalCalendars, setTeacherExternalCalendars,
    teacherSchedules, setTeacherSchedules,
    scheduleDay, setScheduleDay,
    scheduleTime, setScheduleTime,
    scheduleType, setScheduleType,
    otherTeacherCourses, setOtherTeacherCourses,
    cloneSourceId, setCloneSourceId,
    teacherCommissionsMapping, setTeacherCommissionsMapping,
    teacherCommissions, setTeacherCommissions,
    newCommissionInput, setNewCommissionInput,
    moodleApiUrl, setMoodleApiUrl,
    moodleWsToken, setMoodleWsToken,
    moodleCourseId, setMoodleCourseId,
    showCsvEndpoint, setShowCsvEndpoint,
    showCsvGradingEndpoint, setShowCsvGradingEndpoint,
    applyCourseSettings,
    handleAddSchedule,
    handleRemoveSchedule,
    handleSaveTeacherSettings,
    handleCloneCourseConfig,
    handleExportMoodleXml,
    handleSyncMoodleRoster
  } = useTeacherCourseSettings({ selectedCourse, setSelectedCourse, setCourses, setApiLoading });

  // Sidebar & Profile Menu states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Anonymous Feedback states
  const {
    activeFeedbackClass, setActiveFeedbackClass,
    feedbackRating, setFeedbackRating,
    feedbackUnderstanding, setFeedbackUnderstanding,
    feedbackComment, setFeedbackComment,
    viewingFeedbackClass, feedbackStats,
    setViewingFeedbackClass, loadingFeedback,
    handleOpenFeedbackModal,
    handleSubmitFeedback,
    handleLoadClassFeedback
  } = useClassFeedback({ profile, selectedCourse });

  // Commission & Co-docencia states
  const [commissionFilter, setCommissionFilter] = useState<string>("Todas");

  // Gmail OAuth Integration
  const {
    gmailStatus,
    handleStartAuth: handleStartGmailAuth,
    handleDisconnect: handleDisconnectGmail,
    handleSendTest: handleSendTestGmail
  } = useGmailAuth(api);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [selectedDirectEmailStudent, setSelectedDirectEmailStudent] = useState<any | null>(null);


  // Teacher Central Dashboard states
  const [overviewSubmissionsList, setOverviewSubmissionsList] = useState<any[]>([]);
  const [loadingOverviewSubmissions, setLoadingOverviewSubmissions] = useState<boolean>(false);

  // Announcements states

  // CSV Endpoint collapsible state (normally hidden)

  // Announcement Acknowledgement states
  const {
    announcements, setAnnouncements,
    newAnnouncementMessage, setNewAnnouncementMessage,
    visibleAcksId, announcementAcks,
    handleCreateAnnouncement,
    handleAcknowledgeAnnouncement,
    handleToggleAcks
  } = useAnnouncements({ selectedCourse, setApiLoading, setError });

  // Class Q&A Comments states
  const [courseComments, setCourseComments] = useState<any[]>([]);
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});

  // Attendance states
  const [courseAttendance, setCourseAttendance] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [activeAttendanceClass, setActiveAttendanceClass] = useState<number | null>(null);

  // Schedule Versioning & History states

  // Backups
  const {
    systemBackups, setSystemBackups,
    handleCreateBackup,
    handleDownloadBackup,
    handleRestoreBackupDocument
  } = useBackups({ setApiLoading });

  // Custom Prompts states (non-blocking alternative to native prompt)

  const { githubPromptModal, setGithubPromptModal, promptGithubUsername } = useGithubPromptModal();

  // Study Groups states
  const [studyGroups, setStudyGroups] = useState<any[]>([]);
  const [tutors, setTutors] = useState<any[]>([]);
  const courseCommissions = (selectedCourse?.commissions || selectedCourse?.course?.commissions || ["Comisión A", "Comisión B", "Comisión C", "Comisión D"]) as string[];
  const [tutoringSessions, setTutoringSessions] = useState<any[]>([]);

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
            const rawAssignments = Array.isArray(assignRes) ? assignRes : (assignRes?.assignments || []);
            const courseNameOf = (cid: string) =>
              safeCourses.find((x: any) => (x.id || x.course?.id) === cid)?.name
              || safeCourses.find((x: any) => (x.id || x.course?.id) === cid)?.course?.name
              || "Cátedra";
            const loadedAssignments = rawAssignments.map((a: any) => ({
              ...a,
              course_name: a.course_name || courseNameOf(a.course_id),
            }));
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
  // Schedule Versioning & History actions






  // Backups and Alerts actions





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

  // Deep-link / LTI launch param consumption (needs viewCourseDetails ready)
  const { moodleLtiParams } = useDeepLinks({
    profile, setProfile, courses, setCourses,
    setActiveTab,
    viewCourseDetails,
    handleSetCourseSubTab,
    promptGithubUsername
  });

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
          aria-label={isSidebarCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
          aria-expanded={!isSidebarCollapsed}
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden md:flex absolute top-5 -right-3.5 bg-bg-secondary border border-border-custom text-text-secondary hover:text-text-primary p-1.5 rounded-full z-50 shadow-md cursor-pointer transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <span aria-hidden="true">{isSidebarCollapsed ? "▶" : "◀"}</span>
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
          <button
            type="button"
            aria-label="Menú de perfil de usuario"
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-full flex items-center space-x-3 bg-bg-primary/50 p-3 rounded-xl border border-border-custom cursor-pointer hover:bg-bg-tertiary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 text-left"
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
          </button>

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
              sync_secret: c.sync_secret || c.course?.sync_secret,
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
                    onClick={() => handleSetCourseSubTab("overview")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "overview" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    📊 Resumen
                  </button>
                )}
                <button
                  onClick={() => handleSetCourseSubTab("schedules")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "schedules" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  Cronograma
                </button>
                <button
                  onClick={() => handleSetCourseSubTab("assignments")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "assignments" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  Tareas
                </button>
                <button
                  onClick={() => handleSetCourseSubTab("announcements")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "announcements" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  Avisos
                </button>
                {profile?.role === "teacher" && (
                  <button
                    onClick={() => handleSetCourseSubTab("settings")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "settings" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    Ajustes Cátedra
                  </button>
                )}
                {(profile?.role === "admin" || profile?.role === "teacher") && (
                  <button
                    onClick={() => handleSetCourseSubTab("students")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "students" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    👥 Alumnos y Alertas
                  </button>
                )}
                {(profile?.role === "admin" || profile?.role === "teacher") && (
                  <button
                    onClick={() => handleSetCourseSubTab("emails")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "emails" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    📧 Gestión Correos
                  </button>
                )}
                {(profile?.role === "admin" || profile?.role === "teacher") && (
                  <button
                    onClick={() => handleSetCourseSubTab("teachers")}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "teachers" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    Docentes
                  </button>
                )}
                <button
                  onClick={() => handleSetCourseSubTab("tutorias")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${courseSubTab === "tutorias" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  🎓 Tutorías
                </button>
                <button
                  onClick={() => handleSetCourseSubTab("study_groups")}
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
                teacherClasses={teacherClasses}
                courseCommissions={courseCommissions}
                courseComments={courseComments}
                setSelectedDirectEmailStudent={setSelectedDirectEmailStudent}
                showCsvEndpoint={showCsvEndpoint}
                setShowCsvEndpoint={setShowCsvEndpoint}
              />
            )}


            {/* SUBTAB 3. AVISOS (ANNOUNCEMENTS) */}
<CourseAnnouncementsPanel 
                profile={profile}
                announcements={announcements}
                newAnnouncementMessage={newAnnouncementMessage}
                setNewAnnouncementMessage={setNewAnnouncementMessage}
                handleCreateAnnouncement={handleCreateAnnouncement}
                handleAcknowledgeAnnouncement={handleAcknowledgeAnnouncement}
                courseSubTab={courseSubTab}
                handleToggleAcks={handleToggleAcks}
                visibleAcksId={visibleAcksId}
                announcementAcks={announcementAcks}
              />
<CourseSettingsPanel {...{
    profile, selectedCourse, setSelectedCourse, setApiLoading, showToast, teacherGithubToken, setTeacherGithubToken, teacherMoodleEnabled, setTeacherMoodleEnabled, teacherExternalCalendars, setTeacherExternalCalendars, teacherSchedules, setTeacherSchedules, teacherClasses, teacherCommissions, setTeacherCommissions, teacherCommissionsMapping, setTeacherCommissionsMapping, cloneSourceId, setCloneSourceId, moodleApiUrl, setMoodleApiUrl, moodleWsToken, setMoodleWsToken, moodleCourseId, setMoodleCourseId, showCsvEndpoint, setShowCsvEndpoint, showCsvGradingEndpoint, setShowCsvGradingEndpoint, scheduleDay, setScheduleDay, scheduleTime, setScheduleTime, scheduleType, setScheduleType, otherTeacherCourses, setCourseSubTab: handleSetCourseSubTab, courseSubTab, newCommissionInput, setNewCommissionInput, teacherCoverText, setTeacherCoverText, teacherStartDate, setTeacherStartDate, teacherDuration, setTeacherDuration, gmailStatus, handleStartGmailAuth, handleDisconnectGmail, handleSendTestGmail, courseTeachers,
    handleAddSchedule, handleRemoveSchedule, handleSaveTeacherSettings, handleExportMoodleXml, handleSyncMoodleRoster, handleCloneCourseConfig
  }} />
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
<CourseTeachersPanel 
                courseTeachers={courseTeachers}
                selectedNewTeacherId={selectedNewTeacherId}
                setSelectedNewTeacherId={setSelectedNewTeacherId}
                allTeachersList={allTeachersList}
                handleAssignTeacher={handleAssignTeacher}
                handleRemoveTeacher={handleRemoveTeacher}
                profile={profile}
                courseSubTab={courseSubTab}
              />
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

      <StudentAttendanceModals
        profile={profile}
        isQrScannerOpen={isQrScannerOpen}
        setIsQrScannerOpen={setIsQrScannerOpen}
        setApiLoading={setApiLoading}
        setStudentAttendanceGeoLoading={setStudentAttendanceGeoLoading}
        api={api}
        showToast={showToast}
        studentActiveAttendanceClass={studentActiveAttendanceClass}
        setStudentActiveAttendanceClass={setStudentActiveAttendanceClass}
        studentQrToken={studentQrToken}
        setStudentQrToken={setStudentQrToken}
        selectedCourse={selectedCourse}
        studentAttendanceGeoLoading={studentAttendanceGeoLoading}
        handleSubmitStudentAttendanceQr={handleSubmitStudentAttendanceQr}
      />

            <FeedbackModals
        activeFeedbackClass={activeFeedbackClass}
        setActiveFeedbackClass={setActiveFeedbackClass}
        loadingFeedback={loadingFeedback}
        feedbackRating={feedbackRating}
        setFeedbackRating={setFeedbackRating}
        feedbackUnderstanding={feedbackUnderstanding}
        setFeedbackUnderstanding={setFeedbackUnderstanding}
        feedbackComment={feedbackComment}
        setFeedbackComment={setFeedbackComment}
        handleSubmitFeedback={handleSubmitFeedback}
        viewingFeedbackClass={viewingFeedbackClass}
        setViewingFeedbackClass={setViewingFeedbackClass}
        feedbackStats={feedbackStats}
      />

            {/* 📜 Historial de Versiones / Comparación Modal */}

      {/* 💾 Guardar Versión Modal */}


      {/* Modals are handled inside components now */}


      <GithubPromptModal githubPromptModal={githubPromptModal} setGithubPromptModal={setGithubPromptModal} showToast={showToast} />

      <CommandPalette
        courses={courses}
        classes={teacherClasses}
        assignments={assignments}
        onNavigate={handleCommandNavigate}
      />
      
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
