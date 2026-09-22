import { useMemo } from "react";
import { UserProfile } from "@/modules/auth/types";
import { CourseAssignment, CourseAttendanceEntry, CourseSubmission, StudentRiskData } from "../types";

export interface StudentWithCommission extends UserProfile {
  commissions?: Record<string, string>;
}

export interface StudentRiskCalculationResult {
  studentsRiskData: Map<string, StudentRiskData>;
  studentsAtRisk: StudentWithCommission[];
}

/**
 * Calculates academic risk for students based on attendance rate (< 75% after 3+ classes)
 * and missing past-due assignments.
 */
export function useStudentRisk(
  roster: StudentWithCommission[] = [],
  courseAttendance: CourseAttendanceEntry[] = [],
  courseSubmissions: CourseSubmission[] = [],
  assignments: CourseAssignment[] = [],
  pastDueAssignments: Set<string> = new Set()
): StudentRiskCalculationResult {
  const studentsRiskData = useMemo(() => {
    // Precompute attendance stats to avoid O(N*M) loops
    const attendanceStats = new Map<string, { recorded: number; presentOrLate: number }>();
    courseAttendance.forEach(c => {
      if (!c.records) return;
      Object.entries(c.records).forEach(([studentId, status]) => {
        if (!status) return; // Skip falsy values
        const current = attendanceStats.get(studentId) || { recorded: 0, presentOrLate: 0 };
        current.recorded += 1;
        if (status === "present" || status === "late") {
          current.presentOrLate += 1;
        }
        attendanceStats.set(studentId, current);
      });
    });

    // Precompute submissions by student to avoid O(N*M) loops
    const studentSubmissionsMap = new Map<string, Set<string>>();
    courseSubmissions.forEach(s => {
      if (!studentSubmissionsMap.has(s.student_id)) {
        studentSubmissionsMap.set(s.student_id, new Set());
      }
      studentSubmissionsMap.get(s.student_id)!.add(s.assignment_id);
    });

    const data = new Map<string, StudentRiskData>();

    roster.forEach((student) => {
      if (student.role !== "student") return;

      const stats = attendanceStats.get(student.id) || { recorded: 0, presentOrLate: 0 };
      const recordedCount = stats.recorded;
      const presentOrLate = stats.presentOrLate;

      const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
      const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

      const studentSubs = studentSubmissionsMap.get(student.id) || new Set<string>();

      const hasMissingAssignments = assignments.some((a) => {
        const hasSub = studentSubs.has(a.id);
        const isPastDue = pastDueAssignments.has(a.id);
        return !hasSub && isPastDue;
      });

      data.set(student.id, {
        hasCriticalAttendance,
        hasMissingAssignments,
        attendanceRate,
        isAtRisk: hasCriticalAttendance || hasMissingAssignments,
      });
    });

    return data;
  }, [roster, courseAttendance, courseSubmissions, assignments, pastDueAssignments]);

  const studentsAtRisk = useMemo(() => {
    return roster.filter((student) => studentsRiskData.get(student.id)?.isAtRisk);
  }, [roster, studentsRiskData]);

  return { studentsRiskData, studentsAtRisk };
}
