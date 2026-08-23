"use client";

import dynamic from "next/dynamic";
import { StudentNinjaRankCard } from "./StudentNinjaRankCard";
import { CourseStudentsPanel } from "@/modules/course/components/CourseStudentsPanel";
import { CourseSettingsPanel } from "@/modules/course/components/CourseSettingsPanel";
import { CourseTeachersPanel } from "@/modules/course/components/CourseTeachersPanel";
import { CourseAnnouncementsPanel } from "@/modules/course/components/CourseAnnouncementsPanel";
import { CourseOverviewPanel } from "@/modules/course/components/CourseOverviewPanel";
import { CourseSchedulesPanel } from "@/modules/course/components/CourseSchedulesPanel";
import StudyGroupsPanel from "@/modules/study_groups/components/StudyGroupsPanel";
import AssignmentsPanel from "@/modules/github/components/AssignmentsPanel";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import TutoringPanel from "@/modules/tutoring/components/TutoringPanel";
import { api } from "@/lib/api";

const PanelFallback = () => (
  <div className="p-6 text-center text-sm text-gray-400" role="status">Cargando módulo…</div>
);
const EmailManagementPanel = dynamic(() => import("@/modules/mail/components/EmailManagementPanel"), { loading: () => <PanelFallback /> });

/**
 * Full course detail view: breadcrumb header, sub-tab navigation and the
 * role-aware sub-tab panels. All state lives in dashboard domain hooks;
 * this component is a pure rendering orchestrator.
 */
export function CourseDetailSection(props: {
  profile: any;
  currentUser: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  moodleLtiParams: { current: { outcomeUrl?: string, resultId?: string } };
  selectedCourse: any;
  setSelectedCourse: (c: any) => void;
  courseSubTab: string;
  setCourseSubTab: (t: string) => void;
  handleSetCourseSubTab: (t: string) => void;
  // shared data
  courses: any[];
  teacherClasses: any[];
  setTeacherClasses: (classes: any[]) => void;
  assignments: any[];
  setAssignments: (a: any[]) => void;
  submissions: any[];
  setSubmissions: (s: any[]) => void;
  courseSubmissions: any[];
  pastDueAssignments: Set<any>;
  roster: any[];
  setRoster: (r: any[]) => void;
  courseAttendance: any[];
  courseComments: any[];
  expandedComments: Record<number, boolean>;
  toggleComments: (idx: number) => void;
  weeklyClassesGrouped: Record<number, any[]>;
  collapsedClasses: Record<string, boolean>;
  setCollapsedClasses: (v: Record<string, boolean>) => void;
  courseCommissions: string[];
  commissionFilter: string;
  setCommissionFilter: (f: string) => void;
  // overview
  overviewSubmissionsList: any[];
  loadingOverviewSubmissions: boolean;
  // attendance & feedback
  activeAttendanceClass: number | null;
  setActiveAttendanceClass: (v: number | null) => void;
  handleOpenFeedbackModal: (classNumber: number) => Promise<void> | void;
  handleLoadClassFeedback: (classNumber: number) => void;
  // announcements
  announcements: any[];
  newAnnouncementMessage: string;
  setNewAnnouncementMessage: (m: string) => void;
  handleCreateAnnouncement: (e?: any) => Promise<void> | void;
  handleAcknowledgeAnnouncement: (announcementId: string) => Promise<void> | void;
  handleToggleAcks: (id: string) => void;
  visibleAcksId: string | null;
  announcementAcks: any[];
  // settings (teacher)
  setSelectedDirectEmailStudent: (s: any) => void;
  showCsvEndpoint: boolean;
  setShowCsvEndpoint: (v: boolean) => void;
  showCsvGradingEndpoint: boolean;
  setShowCsvGradingEndpoint: (v: boolean) => void;
  teacherGithubToken: string;
  setTeacherGithubToken: (v: string) => void;
  teacherMoodleEnabled: boolean;
  setTeacherMoodleEnabled: (v: boolean) => void;
  teacherExternalCalendars: any;
  setTeacherExternalCalendars: (v: any) => void;
  teacherSchedules: any[];
  setTeacherSchedules: (v: any[]) => void;
  teacherStartDate: string;
  setTeacherStartDate: (v: string) => void;
  teacherDuration: number | string;
  setTeacherDuration: (v: any) => void;
  teacherCoverText: string;
  setTeacherCoverText: (v: string) => void;
  teacherCommissions: string[];
  setTeacherCommissions: (v: string[]) => void;
  teacherCommissionsMapping: any;
  setTeacherCommissionsMapping: (v: any) => void;
  cloneSourceId: string;
  setCloneSourceId: (v: string) => void;
  moodleApiUrl: string;
  setMoodleApiUrl: (v: string) => void;
  moodleWsToken: string;
  setMoodleWsToken: (v: string) => void;
  moodleCourseId: string;
  setMoodleCourseId: (v: string) => void;
  otherTeacherCourses: any[];
  newCommissionInput: string;
  setNewCommissionInput: (v: string) => void;
  scheduleDay: string;
  setScheduleDay: (v: string) => void;
  scheduleTime: string;
  setScheduleTime: (v: string) => void;
  scheduleType: string;
  setScheduleType: (v: string) => void;
  handleAddSchedule: () => void;
  handleRemoveSchedule: (idx: number) => void;
  handleSaveTeacherSettings: (e?: any) => Promise<void> | void;
  handleExportMoodleXml: () => void;
  handleSyncMoodleRoster: () => Promise<void> | void;
  handleCloneCourseConfig: () => Promise<void> | void;
  // gmail
  gmailStatus: any;
  handleStartGmailAuth: () => void;
  handleDisconnectGmail: () => void;
  handleSendTestGmail: () => void;
  // teachers tab
  courseTeachers: any[];
  allTeachersList: any[];
  selectedNewTeacherId: string;
  setSelectedNewTeacherId: (v: string) => void;
  handleAssignTeacher: () => Promise<void> | void;
  handleRemoveTeacher: (teacherId: string) => Promise<void> | void;
  // study groups & tutoring
  studyGroups: any[];
  setStudyGroups: React.Dispatch<React.SetStateAction<any[]>>;
  tutors: any[];
  setTutors: React.Dispatch<React.SetStateAction<any[]>>;
  tutoringSessions: any[];
  setTutoringSessions: React.Dispatch<React.SetStateAction<any[]>>;
  setApiLoading: (v: boolean) => void;
}) {
  const {
    profile, currentUser, activeTab, selectedCourse, setSelectedCourse,
    courseSubTab, setCourseSubTab, handleSetCourseSubTab,
    teacherClasses, assignments, setAssignments,
    submissions, setSubmissions, courseSubmissions, pastDueAssignments,
    roster, setRoster, courseAttendance, courseComments,
    expandedComments, toggleComments, weeklyClassesGrouped,
    collapsedClasses, setCollapsedClasses, courseCommissions,
    commissionFilter, setCommissionFilter,
    overviewSubmissionsList, loadingOverviewSubmissions,
    activeAttendanceClass, setActiveAttendanceClass,
    handleOpenFeedbackModal, handleLoadClassFeedback,
    announcements, newAnnouncementMessage, setNewAnnouncementMessage,
    handleCreateAnnouncement, handleAcknowledgeAnnouncement,
    handleToggleAcks, visibleAcksId, announcementAcks
  } = props;

  return (
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
          submissions={props.submissions}
          courseComments={courseComments}
          courseAttendance={courseAttendance}
          onOpenProfile={() => props.setActiveTab("profile")}
        />
      )}

      {/* SUBTAB RESUMEN DOCENTE / CENTRALIZED DASHBOARD */}
      {courseSubTab === "overview" && (profile?.role === "teacher" || profile?.role === "admin") && (
        <CourseOverviewPanel
          profile={profile}
          selectedCourse={selectedCourse}
          assignments={assignments}
          setAssignments={setAssignments}
          showToast={showToast}
          setApiLoading={props.setApiLoading}
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
          setTeacherClasses={props.setTeacherClasses}
          teacherSchedules={props.teacherSchedules}
          teacherStartDate={props.teacherStartDate}
          teacherDuration={props.teacherDuration}
          showToast={showToast}
          setApiLoading={props.setApiLoading}
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
          setApiLoading={props.setApiLoading}
          api={api}
          assignments={assignments}
          setAssignments={setAssignments}
          submissions={submissions}
          setSubmissions={setSubmissions}
          commissionFilter={commissionFilter}
          setCommissionFilter={setCommissionFilter}
          setSelectedDirectEmailStudent={props.setSelectedDirectEmailStudent}
          moodleLtiParams={props.moodleLtiParams}
          moodleApiUrl={props.moodleApiUrl}
          moodleWsToken={props.moodleWsToken}
          moodleCourseId={props.moodleCourseId}
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
          setApiLoading={props.setApiLoading}
          commissionFilter={commissionFilter}
          setCommissionFilter={setCommissionFilter}
          teacherClasses={teacherClasses}
          courseCommissions={courseCommissions}
          courseComments={courseComments}
          setSelectedDirectEmailStudent={props.setSelectedDirectEmailStudent}
          showCsvEndpoint={props.showCsvEndpoint}
          setShowCsvEndpoint={props.setShowCsvEndpoint}
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
        profile, selectedCourse, setSelectedCourse, setApiLoading: props.setApiLoading, showToast,
        teacherGithubToken: props.teacherGithubToken, setTeacherGithubToken: props.setTeacherGithubToken,
        teacherMoodleEnabled: props.teacherMoodleEnabled, setTeacherMoodleEnabled: props.setTeacherMoodleEnabled,
        teacherExternalCalendars: props.teacherExternalCalendars, setTeacherExternalCalendars: props.setTeacherExternalCalendars,
        teacherSchedules: props.teacherSchedules, setTeacherSchedules: props.setTeacherSchedules,
        teacherClasses: props.teacherClasses,
        teacherCommissions: props.teacherCommissions, setTeacherCommissions: props.setTeacherCommissions,
        teacherCommissionsMapping: props.teacherCommissionsMapping, setTeacherCommissionsMapping: props.setTeacherCommissionsMapping,
        cloneSourceId: props.cloneSourceId, setCloneSourceId: props.setCloneSourceId,
        moodleApiUrl: props.moodleApiUrl, setMoodleApiUrl: props.setMoodleApiUrl,
        moodleWsToken: props.moodleWsToken, setMoodleWsToken: props.setMoodleWsToken,
        moodleCourseId: props.moodleCourseId, setMoodleCourseId: props.setMoodleCourseId,
        showCsvEndpoint: props.showCsvEndpoint, setShowCsvEndpoint: props.setShowCsvEndpoint,
        showCsvGradingEndpoint: props.showCsvGradingEndpoint, setShowCsvGradingEndpoint: props.setShowCsvGradingEndpoint,
        scheduleDay: props.scheduleDay, setScheduleDay: props.setScheduleDay,
        scheduleTime: props.scheduleTime, setScheduleTime: props.setScheduleTime,
        scheduleType: props.scheduleType, setScheduleType: props.setScheduleType,
        otherTeacherCourses: props.otherTeacherCourses,
        setCourseSubTab: handleSetCourseSubTab, courseSubTab,
        newCommissionInput: props.newCommissionInput, setNewCommissionInput: props.setNewCommissionInput,
        teacherCoverText: props.teacherCoverText, setTeacherCoverText: props.setTeacherCoverText,
        teacherStartDate: props.teacherStartDate, setTeacherStartDate: props.setTeacherStartDate,
        teacherDuration: props.teacherDuration, setTeacherDuration: props.setTeacherDuration,
        gmailStatus: props.gmailStatus, handleStartGmailAuth: props.handleStartGmailAuth,
        handleDisconnectGmail: props.handleDisconnectGmail, handleSendTestGmail: props.handleSendTestGmail,
        courseTeachers: props.courseTeachers,
        handleAddSchedule: props.handleAddSchedule, handleRemoveSchedule: props.handleRemoveSchedule,
        handleSaveTeacherSettings: props.handleSaveTeacherSettings, handleExportMoodleXml: props.handleExportMoodleXml,
        handleSyncMoodleRoster: props.handleSyncMoodleRoster, handleCloneCourseConfig: props.handleCloneCourseConfig
      }} />

      {courseSubTab === "emails" && (profile?.role === "teacher" || profile?.role === "admin") && (
        <EmailManagementPanel
          courseId={selectedCourse.id || selectedCourse.course?.id}
          courseName={selectedCourse.name || "Cátedra"}
          api={api}
          gmailStatus={props.gmailStatus}
          onStartGmailAuth={props.handleStartGmailAuth}
        />
      )}

      {/* SUBTAB 5. DOCENTES (ADMIN & TEACHER) */}
      <CourseTeachersPanel
        courseTeachers={props.courseTeachers}
        selectedNewTeacherId={props.selectedNewTeacherId}
        setSelectedNewTeacherId={props.setSelectedNewTeacherId}
        allTeachersList={props.allTeachersList}
        handleAssignTeacher={props.handleAssignTeacher}
        handleRemoveTeacher={props.handleRemoveTeacher}
        profile={profile}
        courseSubTab={courseSubTab}
      />

      {courseSubTab === "study_groups" && (
        <StudyGroupsPanel
          courseId={selectedCourse.id || selectedCourse.course?.id}
          studyGroups={props.studyGroups}
          setStudyGroups={props.setStudyGroups}
          currentUser={currentUser}
          api={api}
        />
      )}

      {/* SUBTAB: TUTORÍAS */}
      {courseSubTab === "tutorias" && (
        <TutoringPanel
          courseId={selectedCourse.id || selectedCourse.course?.id}
          tutors={props.tutors}
          setTutors={props.setTutors}
          tutoringSessions={props.tutoringSessions}
          setTutoringSessions={props.setTutoringSessions}
          currentUser={currentUser}
          api={api}
        />
      )}
    </div>
  );
}
