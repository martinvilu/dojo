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
    // Pre-compute attendance stats to optimize O(N²) array filtering
    const attendanceStats = new Map<string, { recordedCount: number; presentOrLate: number }>();
    courseAttendance.forEach(c => {
      if (!c.records) return;
      Object.entries(c.records).forEach(([studentId, status]) => {
        if (!status) return; // Preserve truthiness check
        const stats = attendanceStats.get(studentId) || { recordedCount: 0, presentOrLate: 0 };
        stats.recordedCount += 1;
        if (status === "present" || status === "late") {
          stats.presentOrLate += 1;
        }
        attendanceStats.set(studentId, stats);
      });
    });

    // Pre-compute submissions per student to optimize O(N²) searching
    const submissionsMap = new Map<string, Set<string>>();
    courseSubmissions.forEach(s => {
      if (!submissionsMap.has(s.student_id)) {
        submissionsMap.set(s.student_id, new Set());
      }
      submissionsMap.get(s.student_id)!.add(s.assignment_id);
    });

    const data = new Map<string, StudentRiskData>();

    roster.forEach((student) => {
      if (student.role !== "student") return;

      const stats = attendanceStats.get(student.id) || { recordedCount: 0, presentOrLate: 0 };
      const { recordedCount, presentOrLate } = stats;

      const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
      const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

      const studentSubs = submissionsMap.get(student.id) || new Set<string>();
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
