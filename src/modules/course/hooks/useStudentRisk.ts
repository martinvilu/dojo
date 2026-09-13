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

    // Precompute attendance stats: studentId -> { total: number, presentOrLate: number }
    const attendanceStats = new Map<string, { total: number; presentOrLate: number }>();
    for (const att of courseAttendance) {
      if (att.records) {
        for (const studentId in att.records) {
          let stats = attendanceStats.get(studentId);
          if (!stats) {
            stats = { total: 0, presentOrLate: 0 };
            attendanceStats.set(studentId, stats);
          }
          if (att.records[studentId]) {
            stats.total++;
            const status = att.records[studentId];
            if (status === "present" || status === "late") {
              stats.presentOrLate++;
            }
          }
        }
      }
    }

    // Precompute submissions: studentId -> Set<assignment_id>
    const submissionsByStudent = new Map<string, Set<string>>();
    for (const sub of courseSubmissions) {
      let studentSet = submissionsByStudent.get(sub.student_id);
      if (!studentSet) {
        studentSet = new Set();
        submissionsByStudent.set(sub.student_id, studentSet);
      }
      studentSet.add(sub.assignment_id);
    }

    roster.forEach((student) => {
      if (student.role !== "student") return;

      const stats = attendanceStats.get(student.id) || { total: 0, presentOrLate: 0 };
      const recordedCount = stats.total;
      const presentOrLate = stats.presentOrLate;

      const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
      const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

      const studentSubs = submissionsByStudent.get(student.id);

      let hasMissingAssignments = false;
      for (const a of assignments) {
        if (pastDueAssignments.has(a.id)) {
          if (!studentSubs || !studentSubs.has(a.id)) {
            hasMissingAssignments = true;
            break;
          }
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
