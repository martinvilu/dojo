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

    // Pre-compute attendance stats for all students in O(A)
    const attStats = new Map<string, { recordedCount: number; presentOrLate: number }>();
    courseAttendance.forEach((c) => {
      if (!c.records) return;
      Object.entries(c.records).forEach(([studentId, status]) => {
        if (!status) return;

        let stats = attStats.get(studentId);
        if (!stats) {
          stats = { recordedCount: 0, presentOrLate: 0 };
          attStats.set(studentId, stats);
        }

        stats.recordedCount++;
        if (status === "present" || status === "late") {
          stats.presentOrLate++;
        }
      });
    });

    // Pre-compute submissions for all students in O(S)
    const studentSubmissionsMap = new Map<string, Set<string>>();
    courseSubmissions.forEach((s) => {
      let subs = studentSubmissionsMap.get(s.student_id);
      if (!subs) {
        subs = new Set();
        studentSubmissionsMap.set(s.student_id, subs);
      }
      subs.add(s.assignment_id);
    });

    roster.forEach((student) => {
      if (student.role !== "student") return;

      const studentAttStats = attStats.get(student.id) || { recordedCount: 0, presentOrLate: 0 };
      const recordedCount = studentAttStats.recordedCount;
      const presentOrLate = studentAttStats.presentOrLate;

      const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
      const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

      const studentSubs = studentSubmissionsMap.get(student.id);
      const hasMissingAssignments = assignments.some((a) => {
        const hasSub = studentSubs?.has(a.id) ?? false;
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
