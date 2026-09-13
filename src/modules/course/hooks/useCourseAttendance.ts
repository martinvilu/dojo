import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import { CourseAttendanceEntry } from "../types";

export interface StudentAttendanceSummary {
  studentId: string;
  totalRecordedClasses: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendanceRate: number;
}

export function useCourseAttendance(courseId?: string | null) {
  const [attendance, setAttendance] = useState<CourseAttendanceEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setAttendance([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const attRef = collection(db, "courses", courseId, "attendance");
    const q = query(attRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CourseAttendanceEntry[];
        setAttendance(records);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [courseId]);

  const getStudentAttendanceSummary = useCallback(
    (studentId: string): StudentAttendanceSummary => {
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let totalRecordedClasses = 0;

      attendance.forEach((entry) => {
        const status = entry.records?.[studentId];
        if (!status) return;

        totalRecordedClasses++;
        if (status === "present") presentCount++;
        else if (status === "late") lateCount++;
        else if (status === "absent") absentCount++;
      });

      const effectivePresent = presentCount + lateCount;
      const attendanceRate = totalRecordedClasses > 0 ? (effectivePresent / totalRecordedClasses) * 100 : 100;

      return {
        studentId,
        totalRecordedClasses,
        presentCount,
        lateCount,
        absentCount,
        attendanceRate,
      };
    },
    [attendance]
  );

  const overallAverageRate = useMemo(() => {
    if (attendance.length === 0) return 100;
    let totalPresent = 0;
    let totalRecords = 0;

    attendance.forEach((entry) => {
      if (!entry.records) return;
      Object.values(entry.records).forEach((status) => {
        totalRecords++;
        if (status === "present" || status === "late") totalPresent++;
      });
    });

    return totalRecords > 0 ? (totalPresent / totalRecords) * 100 : 100;
  }, [attendance]);

  return {
    attendance,
    loading,
    error,
    getStudentAttendanceSummary,
    overallAverageRate,
  };
}
