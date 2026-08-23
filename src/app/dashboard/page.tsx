"use client";

import { CourseStudentsPanel } from "@/modules/course/components/CourseStudentsPanel";

import { CourseSettingsPanel } from "@/modules/course/components/CourseSettingsPanel";
import { CourseTeachersPanel } from "@/modules/course/components/CourseTeachersPanel";
import { CourseAnnouncementsPanel } from "@/modules/course/components/CourseAnnouncementsPanel";

import { CourseOverviewPanel } from "@/modules/course/components/CourseOverviewPanel";
import { CourseSchedulesPanel } from "@/modules/course/components/CourseSchedulesPanel";
import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
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
import { useCourseDetail } from "./hooks/useCourseDetail";
import { useCourseRealtime } from "./hooks/useCourseRealtime";
import { useCourseSubtabData } from "./hooks/useCourseSubtabData";
import { Sidebar } from "./components/Sidebar";
import { AdminBackupsSection } from "./components/AdminBackupsSection";
import { StudentNinjaRankCard } from "./components/StudentNinjaRankCard";

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

  // Course detail & navigation domain
  const {
    selectedCourse, setSelectedCourse,
    courseSubTab, setCourseSubTab,
    handleSetCourseSubTab,
    handleOpenCourseCalendar,
    viewCourseDetails,
    handleCommandNavigate
  } = useCourseDetail({
    profile, activeTab, setActiveTab, courses, setTeacherClasses, setApiLoading
  });

  // Course-scoped live data (roster, teachers, attendance, Q&A comments)
  const {
    roster, setRoster,
    courseAttendance,
    courseTeachers, setCourseTeachers,
    courseComments,
    expandedComments, toggleComments
  } = useCourseRealtime({ selectedCourse });

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


  // Teacher Central Dashboard states → useCourseSubtabData

  // Study Groups states
  const [studyGroups, setStudyGroups] = useState<any[]>([]);
  const [tutors, setTutors] = useState<any[]>([]);
  const [tutoringSessions, setTutoringSessions] = useState<any[]>([]);

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

  // Per-subtab course data loading (role-aware)
  const {
    overviewSubmissionsList, loadingOverviewSubmissions
  } = useCourseSubtabData({
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
  });

  // Class Q&A Comments / Attendance states → useCourseRealtime

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

  const courseCommissions = (selectedCourse?.commissions || selectedCourse?.course?.commissions || ["Comisión A", "Comisión B", "Comisión C", "Comisión D"]) as string[];

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
      <Sidebar
        profile={profile}
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
        onOpenQrScanner={() => setIsQrScannerOpen(true)}
      />

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
          <AdminBackupsSection
            systemBackups={systemBackups}
            courses={courses}
            assignments={assignments}
            users={users}
            onCreateBackup={handleCreateBackup}
            onDownloadBackup={handleDownloadBackup}
            onRestoreBackupDocument={handleRestoreBackupDocument}
          />
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

            {profile?.role === "student" && (
              <StudentNinjaRankCard
                profile={profile}
                submissions={submissions}
                courseComments={courseComments}
                courseAttendance={courseAttendance}
                onOpenProfile={() => setActiveTab("profile")}
              />
            )}

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
