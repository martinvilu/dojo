"use client";

import dynamic from "next/dynamic";
import { StudentAttendanceModals } from "@/modules/attendance/components/StudentAttendanceModals";
import { FeedbackModals } from "@/modules/course/components/FeedbackModals";
import { GithubPromptModal } from "@/modules/github/components/GithubPromptModal";
import CommandPalette from "@/components/dashboard/ui/CommandPalette";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { api } from "@/lib/api";

const PanelFallback = () => (
  <div className="p-6 text-center text-sm text-gray-400" role="status">Cargando módulo…</div>
);

const DirectEmailModal = dynamic(() => import("@/modules/mail/components/DirectEmailModal"), { loading: () => <PanelFallback /> });

interface DashboardOverlaysProps {
  profile: any;
  selectedCourse: any;
  courses: any[];
  teacherClasses: any[];
  assignments: any[];
  // QR attendance
  isQrScannerOpen: boolean;
  setIsQrScannerOpen: (v: boolean) => void;
  setStudentAttendanceGeoLoading: (v: boolean) => void;
  studentActiveAttendanceClass: any;
  setStudentActiveAttendanceClass: (v: any) => void;
  studentQrToken: string;
  setStudentQrToken: (v: string) => void;
  studentAttendanceGeoLoading: boolean;
  handleSubmitStudentAttendanceQr: (classNumber: number) => Promise<void> | void;
  // class feedback
  activeFeedbackClass: any;
  setActiveFeedbackClass: (v: any) => void;
  loadingFeedback: boolean;
  feedbackRating: number;
  setFeedbackRating: (v: number) => void;
  feedbackUnderstanding: string;
  setFeedbackUnderstanding: (v: string) => void;
  feedbackComment: string;
  setFeedbackComment: (v: string) => void;
  handleSubmitFeedback: (classNumber: number) => Promise<void> | void;
  viewingFeedbackClass: any;
  setViewingFeedbackClass: (v: any) => void;
  feedbackStats: any;
  // github prompt
  githubPromptModal: any;
  setGithubPromptModal: (v: any) => void;
  // command palette
  onCommandNavigate: (target: any) => Promise<void> | void;
  // direct email
  selectedDirectEmailStudent: any;
  setSelectedDirectEmailStudent: (v: any) => void;
  setApiLoading: (v: boolean) => void;
}

/**
 * Global modal/popup layer of the dashboard: student attendance modals,
 * anonymous feedback modals, GitHub linking prompt, command palette and
 * the direct email composer.
 */
export function DashboardOverlays(props: DashboardOverlaysProps) {
  const {
    profile, selectedCourse, courses, teacherClasses, assignments,
    isQrScannerOpen, setIsQrScannerOpen,
    setStudentAttendanceGeoLoading,
    studentActiveAttendanceClass, setStudentActiveAttendanceClass,
    studentQrToken, setStudentQrToken,
    studentAttendanceGeoLoading, handleSubmitStudentAttendanceQr,
    activeFeedbackClass, setActiveFeedbackClass,
    loadingFeedback,
    feedbackRating, setFeedbackRating,
    feedbackUnderstanding, setFeedbackUnderstanding,
    feedbackComment, setFeedbackComment,
    handleSubmitFeedback,
    viewingFeedbackClass, setViewingFeedbackClass,
    feedbackStats,
    githubPromptModal, setGithubPromptModal,
    onCommandNavigate,
    selectedDirectEmailStudent, setSelectedDirectEmailStudent,
    setApiLoading
  } = props;

  return (
    <>
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

      <GithubPromptModal githubPromptModal={githubPromptModal} setGithubPromptModal={setGithubPromptModal} showToast={showToast} />

      <CommandPalette
        courses={courses}
        classes={teacherClasses}
        assignments={assignments}
        onNavigate={onCommandNavigate}
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
    </>
  );
}
