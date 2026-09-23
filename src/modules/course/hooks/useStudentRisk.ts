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
    const data = new Map<string, StudentRiskData>();

    // Pre-compute attendance statistics for O(1) lookups
    const attendanceStats = new Map<string, { recordedCount: number; presentOrLate: number }>();
    courseAttendance.forEach(entry => {
      if (!entry.records) return;
      Object.entries(entry.records).forEach(([studentId, status]) => {
        if (!Boolean(status)) return;
        let stats = attendanceStats.get(studentId);
        if (!stats) {
          stats = { recordedCount: 0, presentOrLate: 0 };
          attendanceStats.set(studentId, stats);
        }
        stats.recordedCount++;
        if (status === "present" || status === "late") {
          stats.presentOrLate++;
        }
      });
    });

    // Pre-compute submissions for O(1) lookups
    const subsByStudent = new Map<string, Set<string>>();
    courseSubmissions.forEach(sub => {
      let studentSubs = subsByStudent.get(sub.student_id);
      if (!studentSubs) {
        studentSubs = new Set<string>();
        subsByStudent.set(sub.student_id, studentSubs);
      }
      studentSubs.add(sub.assignment_id);
    });

    roster.forEach((student) => {
      if (student.role !== "student") return;

      const stats = attendanceStats.get(student.id) || { recordedCount: 0, presentOrLate: 0 };
      const recordedCount = stats.recordedCount;
      const presentOrLate = stats.presentOrLate;

      const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
      const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

      const studentSubs = subsByStudent.get(student.id) || new Set<string>();
      const hasMissingAssignments = assignments.some((a) => {
        return pastDueAssignments.has(a.id) && !studentSubs.has(a.id);
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
