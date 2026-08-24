"use client";

import { useState, useMemo } from "react";
import { useGmailAuth } from "@/modules/mail/hooks/useGmailAuth";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

import { api } from "@/lib/api";
import { useTheme } from "./hooks/useTheme";
import { useGithubPromptModal } from "./hooks/useGithubPromptModal";
import { useClassFeedback } from "./hooks/useClassFeedback";
import { useStudentQrAttendance } from "./hooks/useStudentQrAttendance";
import { useAnnouncements } from "./hooks/useAnnouncements";
import { useTeacherCourseSettings } from "./hooks/useTeacherCourseSettings";
import { useBackups } from "./hooks/useBackups";
import { useAuthProfile } from "./hooks/useAuthProfile";
import { useDeepLinks } from "./hooks/useDeepLinks";
import { useAdminPanel } from "./hooks/useAdminPanel";
import { useCourseDetail } from "./hooks/useCourseDetail";
import { useCourseRealtime } from "./hooks/useCourseRealtime";
import { useCourseSubtabData } from "./hooks/useCourseSubtabData";
import { useTabDataLoader } from "./hooks/useTabDataLoader";
import { DashboardOverlays } from "./components/DashboardOverlays";
import { TabPanelsSection } from "./components/TabPanelsSection";
import { getWeeklyClasses } from "./utils/weeklyClasses";
import type { ClassInstance } from "./types";
import { Sidebar } from "./components/Sidebar";
import { CourseDetailSection } from "./components/CourseDetailSection";
import { LoadingScreen, PendingApprovalView } from "./components/GateScreens";

export default function DashboardPage() {
  const [apiLoading, setApiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const [error, setError] = useState("");

  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});

  // Data states
  const [courses, setCourses] = useState<any[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassInstance[]>([]);

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
    expandedComments, setExpandedComments, toggleComments
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

  // Top-level tab data loading
  useTabDataLoader({
    activeTab, profile,
    setSelectedCourse, setCourses, setUsers,
    setGlobalCalendarUrl,
    setSystemBackups,
    setAssignments, setTeacherClasses,
    setProfileName, setProfileMatricula, setProfileCohorte, setProfileGithubUser,
    setXpLogs,
    setApiLoading, setError
  });

  // Custom Prompts states (non-blocking alternative to native prompt)

  const { githubPromptModal, setGithubPromptModal, promptGithubUsername } = useGithubPromptModal();

  const courseCommissions = (selectedCourse?.commissions || selectedCourse?.course?.commissions || ["Comisión A", "Comisión B", "Comisión C", "Comisión D"]) as string[];


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
    return <LoadingScreen />;
  }

  // PENDING APPROVAL VIEW
  if (profile && profile.account_status === "pending") {
    return (
      <PendingApprovalView
        matriculaInput={matriculaInput}
        setMatriculaInput={setMatriculaInput}
        matriculaError={matriculaError}
        apiLoading={apiLoading}
        onSubmit={handleSubmitMatricula}
        onLogout={handleLogout}
      />
    );
  }


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

        {/* TOP-LEVEL TAB PANELS (admin / teacher / student / calendar / profile) */}
        <TabPanelsSection {...{
          profile, activeTab, courses, users, assignments, teacherClasses, selectedCourse,
          globalCalendarUrl, setGlobalCalendarUrl,
          newCourseName, setNewCourseName, newCourseOrg, setNewCourseOrg,
          handleCreateCourse, handleUpdateUserRole, handleUpdateUserProfile,
          handleApproveUser, handleDeleteUser, handleSaveSettings,
          systemBackups,
          onCreateBackup: handleCreateBackup,
          onDownloadBackup: handleDownloadBackup,
          onRestoreBackupDocument: handleRestoreBackupDocument,
          viewCourseDetails, onOpenCourseCalendar: handleOpenCourseCalendar,
          onOpenQrScanner: () => setIsQrScannerOpen(true),
          enrollCode, setEnrollCode, handleEnrollCourse,
          profileName, setProfileName, profileMatricula, setProfileMatricula,
          profileCohorte, setProfileCohorte, profileGithubUser, setProfileGithubUser,
          handleUpdateProfile, handleAddSecondaryEmail, xpLogs,
          gmailStatus, handleStartGmailAuth, handleDisconnectGmail, handleSendTestGmail,
          testEmailAddress, setTestEmailAddress
        }} />

        {/* DETALLADA VISTA DE CÁTEDRA */}
        {selectedCourse && ["admin-courses", "teacher-courses", "student-courses"].includes(activeTab) && (
          <CourseDetailSection {...{
            profile, currentUser, activeTab, setActiveTab,
            selectedCourse, setSelectedCourse,
            courseSubTab, setCourseSubTab, handleSetCourseSubTab,
            courses, teacherClasses, setTeacherClasses,
            assignments, setAssignments, submissions, setSubmissions,
            courseSubmissions, pastDueAssignments,
            roster, setRoster, courseAttendance, courseComments,
            expandedComments, setExpandedComments, toggleComments, weeklyClassesGrouped,
            collapsedClasses, setCollapsedClasses, courseCommissions,
            commissionFilter, setCommissionFilter,
            overviewSubmissionsList, loadingOverviewSubmissions,
            activeAttendanceClass, setActiveAttendanceClass,
            handleOpenFeedbackModal, handleLoadClassFeedback,
            moodleLtiParams,
            announcements, newAnnouncementMessage, setNewAnnouncementMessage,
            handleCreateAnnouncement, handleAcknowledgeAnnouncement,
            handleToggleAcks, visibleAcksId, announcementAcks,
            setSelectedDirectEmailStudent, showCsvEndpoint, setShowCsvEndpoint,
            showCsvGradingEndpoint, setShowCsvGradingEndpoint,
            teacherGithubToken, setTeacherGithubToken,
            teacherMoodleEnabled, setTeacherMoodleEnabled,
            teacherExternalCalendars, setTeacherExternalCalendars,
            teacherSchedules, setTeacherSchedules,
            teacherStartDate, setTeacherStartDate, teacherDuration, setTeacherDuration,
            teacherCoverText, setTeacherCoverText,
            teacherCommissions, setTeacherCommissions,
            teacherCommissionsMapping, setTeacherCommissionsMapping,
            cloneSourceId, setCloneSourceId,
            moodleApiUrl, setMoodleApiUrl, moodleWsToken, setMoodleWsToken,
            moodleCourseId, setMoodleCourseId,
            otherTeacherCourses, newCommissionInput, setNewCommissionInput,
            scheduleDay, setScheduleDay, scheduleTime, setScheduleTime,
            scheduleType, setScheduleType,
            gmailStatus, handleStartGmailAuth, handleDisconnectGmail, handleSendTestGmail,
            courseTeachers, allTeachersList,
            selectedNewTeacherId, setSelectedNewTeacherId,
            handleAssignTeacher, handleRemoveTeacher,
            studyGroups, setStudyGroups, tutors, setTutors,
            tutoringSessions, setTutoringSessions,
            setApiLoading,
            handleAddSchedule, handleRemoveSchedule, handleSaveTeacherSettings,
            handleExportMoodleXml, handleSyncMoodleRoster, handleCloneCourseConfig
          }} />
        )}
      </main>

      {/* Global modals & overlays */}
      <DashboardOverlays
        profile={profile}
        selectedCourse={selectedCourse}
        courses={courses}
        teacherClasses={teacherClasses}
        assignments={assignments}
        isQrScannerOpen={isQrScannerOpen}
        setIsQrScannerOpen={setIsQrScannerOpen}
        setStudentAttendanceGeoLoading={setStudentAttendanceGeoLoading}
        studentActiveAttendanceClass={studentActiveAttendanceClass}
        setStudentActiveAttendanceClass={setStudentActiveAttendanceClass}
        studentQrToken={studentQrToken}
        setStudentQrToken={setStudentQrToken}
        studentAttendanceGeoLoading={studentAttendanceGeoLoading}
        handleSubmitStudentAttendanceQr={handleSubmitStudentAttendanceQr}
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
        githubPromptModal={githubPromptModal}
        setGithubPromptModal={setGithubPromptModal}
        onCommandNavigate={handleCommandNavigate}
        selectedDirectEmailStudent={selectedDirectEmailStudent}
        setSelectedDirectEmailStudent={setSelectedDirectEmailStudent}
        setApiLoading={setApiLoading}
      />
    </div>
  );
}
