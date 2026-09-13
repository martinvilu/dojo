export type UserRole = "admin" | "teacher" | "student";

export type AccountStatus = "pending" | "approved";

export type SubmissionStatus = "submitted" | "graded" | "late" | "pending";

export type AttendanceStatus = "present" | "late" | "absent";

export const USER_ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
  STUDENT: "student",
} as const;

export const ACCOUNT_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
} as const;

export const SUBMISSION_STATUSES = {
  SUBMITTED: "submitted",
  GRADED: "graded",
  LATE: "late",
  PENDING: "pending",
} as const;

export const ATTENDANCE_STATUSES = {
  PRESENT: "present",
  LATE: "late",
  ABSENT: "absent",
} as const;

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  account_status: AccountStatus;
  matricula_unrn?: string;
  cohorte?: string;
  github_user?: string;
}
