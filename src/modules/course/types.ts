import { UserProfile, UserRole } from "@/modules/auth/types";
import { Dispatch, SetStateAction } from "react";

export interface Course {
  id: string;
  name: string;
  description?: string;
  commission?: string;
  year?: number | string;
  semester?: number | string;
  icon?: string;
  github_org?: string;
  moodle_course_id?: string;
  teacher_ids?: string[];
  student_ids?: string[];
  created_at?: unknown;
}

export interface StudentRiskData {
  hasCriticalAttendance: boolean;
  hasMissingAssignments: boolean;
  attendanceRate: number;
  isAtRisk: boolean;
}

export interface CourseAttendanceEntry {
  id: string;
  date?: string;
  classNumber?: number;
  records?: Record<string, "present" | "late" | "absent" | string>;
}

export interface CourseAssignment {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  course_id: string;
  github_repo_prefix?: string;
  created_at?: unknown;
}

export interface CourseSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  repo_url?: string;
  status: "submitted" | "graded" | "late" | "pending" | string;
  grade?: string | number | null;
  feedback?: string;
  submitted_at?: unknown;
}

export interface CommentReaction {
  thumbs_up?: string[];
  party?: string[];
  heart?: string[];
}

export interface ClassComment {
  id: string;
  classNumber: number;
  user_id: string;
  user_name: string;
  user_role: UserRole | string;
  content: string;
  is_best_answer?: boolean;
  reactions?: CommentReaction;
  created_at?: unknown;
}

export interface CourseOverviewPanelProps {
  profile?: UserProfile | any;
  selectedCourse: Course | any;
  assignments: CourseAssignment[] | any[];
  setAssignments?: (a: any[]) => void;
  showToast?: (message: string, type?: any, id?: string) => void;
  overviewSubmissionsList: CourseSubmission[] | any[];
  loadingOverviewSubmissions?: boolean;
  roster?: UserProfile[] | any[];
  courseAttendance?: CourseAttendanceEntry[] | any[];
  courseSubmissions?: CourseSubmission[] | any[];
  pastDueAssignments?: Set<any>;
  setCourseSubTab: (tab: string) => void;
  courseComments?: ClassComment[] | any[];
  setExpandedComments?: Dispatch<SetStateAction<Record<number, boolean>>> | any;
  [key: string]: any;
}
