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

    // Pre-compute attendance stats per student
    const attStats = new Map<string, { recordedCount: number; presentOrLate: number }>();
    courseAttendance.forEach((att) => {
      if (!att.records) return;
      Object.entries(att.records).forEach(([studentId, status]) => {
        if (!status) return; // Preserve original truthiness semantics
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

    // Pre-compute submissions per student
    const subMap = new Map<string, Set<string>>();
    courseSubmissions.forEach((sub) => {
      let studentSubs = subMap.get(sub.student_id);
      if (!studentSubs) {
        studentSubs = new Set<string>();
        subMap.set(sub.student_id, studentSubs);
      }
      studentSubs.add(sub.assignment_id);
    });

    // Pre-compute past due assignments relevant to this course
    const coursePastDue = new Set<string>();
    assignments.forEach((a) => {
      if (pastDueAssignments.has(a.id)) {
        coursePastDue.add(a.id);
      }
    });

    roster.forEach((student) => {
      if (student.role !== "student") return;

      const stats = attStats.get(student.id) || { recordedCount: 0, presentOrLate: 0 };
      const { recordedCount, presentOrLate } = stats;
      const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
      const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

      const studentSubs = subMap.get(student.id) || new Set<string>();
      let hasMissingAssignments = false;
      for (const aId of coursePastDue) {
        if (!studentSubs.has(aId)) {
          hasMissingAssignments = true;
          break;
        }
      }

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
