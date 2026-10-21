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

    // ⚡ Bolt: Pre-compute attendance stats per student into a Map to change O(C * R) to O(C)
    const attStats = new Map<string, { recordedCount: number; presentOrLate: number }>();
    courseAttendance.forEach((c) => {
      if (!c.records) return;
      Object.entries(c.records).forEach(([studentId, status]) => {
        if (!status) return;
        if (!attStats.has(studentId)) {
          attStats.set(studentId, { recordedCount: 0, presentOrLate: 0 });
        }
        const stats = attStats.get(studentId)!;
        stats.recordedCount++;
        if (status === "present" || status === "late") {
          stats.presentOrLate++;
        }
      });
    });

    // ⚡ Bolt: Pre-compute submissions per student into a Map of Sets for O(1) lookups
    const subsMap = new Map<string, Set<string>>();
    courseSubmissions.forEach((s) => {
      if (!subsMap.has(s.student_id)) {
        subsMap.set(s.student_id, new Set());
      }
      subsMap.get(s.student_id)!.add(s.assignment_id);
    });

    roster.forEach((student) => {
      if (student.role !== "student") return;

      const stats = attStats.get(student.id) || { recordedCount: 0, presentOrLate: 0 };
      const { recordedCount, presentOrLate } = stats;

      const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
      const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

      const studentSubs = subsMap.get(student.id) || new Set();
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
