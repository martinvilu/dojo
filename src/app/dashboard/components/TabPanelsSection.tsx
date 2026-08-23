"use client";

import AdminPanel from "@/modules/course/components/AdminPanel";
import StudentPanel from "@/modules/course/components/StudentPanel";
import ProfilePanel from "@/modules/auth/components/ProfilePanel";
import TeacherPanel from "@/modules/course/components/TeacherPanel";
import { AdminBackupsSection } from "./AdminBackupsSection";

const PanelFallback = () => (
  <div className="p-6 text-center text-sm text-gray-400" role="status">Cargando módulo…</div>
);

const CalendarPanel = dynamic(() => import("@/modules/calendar/components/CalendarPanel"), { loading: () => <PanelFallback /> });
import dynamic from "next/dynamic";

interface TabPanelsSectionProps {
  profile: any;
  activeTab: string;
  courses: any[];
  users: any[];
  assignments: any[];
  teacherClasses: any[];
  selectedCourse: any;
  // admin
  globalCalendarUrl: string;
  setGlobalCalendarUrl: (v: string) => void;
  newCourseName: string;
  setNewCourseName: (v: string) => void;
  newCourseOrg: string;
  setNewCourseOrg: (v: string) => void;
  handleCreateCourse: (e: React.FormEvent) => Promise<void> | void;
  handleUpdateUserRole: (uid: string, newRole: "admin" | "teacher" | "student") => Promise<void> | void;
  handleUpdateUserProfile: (uid: string, data: any) => Promise<void> | void;
  handleApproveUser: (uid: string) => Promise<void> | void;
  handleDeleteUser: (uid: string) => Promise<void> | void;
  handleSaveSettings: (e: React.FormEvent) => Promise<void> | void;
  systemBackups: any[];
  onCreateBackup: () => void;
  onDownloadBackup: (backupId: string) => void;
  onRestoreBackupDocument: (backupId: string, collectionName: string, docId: string) => void;
  // navigation
  viewCourseDetails: (course: any) => Promise<void>;
  onOpenCourseCalendar: (courseId: string) => void;
  onOpenQrScanner: () => void;
  // student enroll
  enrollCode: string;
  setEnrollCode: (v: string) => void;
  handleEnrollCourse: (e: React.FormEvent) => Promise<void> | void;
  // profile
  profileName: string;
  setProfileName: (v: string) => void;
  profileMatricula: string;
  setProfileMatricula: (v: string) => void;
  profileCohorte: string;
  setProfileCohorte: (v: string) => void;
  profileGithubUser: string;
  setProfileGithubUser: (v: string) => void;
  handleUpdateProfile: (e: React.FormEvent) => Promise<void> | void;
  handleAddSecondaryEmail: (email: string) => Promise<void> | void;
  xpLogs: any[];
  gmailStatus: any;
  handleStartGmailAuth: () => void;
  handleDisconnectGmail: () => void;
  handleSendTestGmail: () => void;
  testEmailAddress: string;
  setTestEmailAddress: (v: string) => void;
}

/**
 * Top-level tab panels of the dashboard (admin, backups, teacher, student,
 * calendar, profile), rendered when no course detail view is active.
 */
export function TabPanelsSection(props: TabPanelsSectionProps) {
  const {
    profile, activeTab, courses, users, assignments, teacherClasses, selectedCourse
  } = props;

  return (
    <>
      {/* ADMIN TABS COMPONENT */}
      {profile?.role === "admin" && (
        <AdminPanel
          activeTab={activeTab}
          courses={courses}
          users={users}
          globalCalendarUrl={props.globalCalendarUrl}
          setGlobalCalendarUrl={props.setGlobalCalendarUrl}
          newCourseName={props.newCourseName}
          setNewCourseName={props.setNewCourseName}
          newCourseOrg={props.newCourseOrg}
          setNewCourseOrg={props.setNewCourseOrg}
          handleCreateCourse={props.handleCreateCourse}
          handleUpdateUserRole={props.handleUpdateUserRole}
          handleUpdateUserProfile={props.handleUpdateUserProfile}
          handleApproveUser={props.handleApproveUser}
          handleDeleteUser={props.handleDeleteUser}
          handleSaveSettings={props.handleSaveSettings}
          viewCourseDetails={props.viewCourseDetails}
        />
      )}

      {/* ADMIN BACKUPS PANEL */}
      {profile?.role === "admin" && activeTab === "admin-backups" && (
        <AdminBackupsSection
          systemBackups={props.systemBackups}
          courses={courses}
          assignments={assignments}
          users={users}
          onCreateBackup={props.onCreateBackup}
          onDownloadBackup={props.onDownloadBackup}
          onRestoreBackupDocument={props.onRestoreBackupDocument}
        />
      )}

      {/* TEACHER TABS COMPONENT */}
      {!selectedCourse && (
        <TeacherPanel
          activeTab={activeTab}
          courses={courses}
          viewCourseDetails={props.viewCourseDetails}
          onOpenCourseCalendar={props.onOpenCourseCalendar}
        />
      )}

      {/* STUDENT TABS COMPONENT */}
      {!selectedCourse && (
        <StudentPanel
          activeTab={activeTab}
          courses={courses}
          enrollCode={props.enrollCode}
          setEnrollCode={props.setEnrollCode}
          handleEnrollCourse={props.handleEnrollCourse}
          viewCourseDetails={props.viewCourseDetails}
          onOpenCourseCalendar={props.onOpenCourseCalendar}
          onOpenQrScanner={props.onOpenQrScanner}
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
        profileName={props.profileName}
        setProfileName={props.setProfileName}
        profileMatricula={props.profileMatricula}
        setProfileMatricula={props.setProfileMatricula}
        profileCohorte={props.profileCohorte}
        setProfileCohorte={props.setProfileCohorte}
        profileGithubUser={props.profileGithubUser}
        setProfileGithubUser={props.setProfileGithubUser}
        handleUpdateProfile={props.handleUpdateProfile}
        handleAddSecondaryEmail={props.handleAddSecondaryEmail}
        xpLogs={props.xpLogs}
        gmailStatus={props.gmailStatus}
        handleStartGmailAuth={props.handleStartGmailAuth}
        handleDisconnectGmail={props.handleDisconnectGmail}
        handleSendTestGmail={props.handleSendTestGmail}
        testEmailAddress={props.testEmailAddress}
        setTestEmailAddress={props.setTestEmailAddress}
      />
    </>
  );
}
