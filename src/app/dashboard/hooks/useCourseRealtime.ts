"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import { api } from "@/lib/api";

interface UseCourseRealtimeArgs {
  selectedCourse: any;
}

/**
 * Course-scoped live data: roster/teachers fetch plus Firestore snapshots
 * for attendance and class Q&A comments of the selected course.
 */
export function useCourseRealtime({ selectedCourse }: UseCourseRealtimeArgs) {
  const [courseTeachers, setCourseTeachers] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [courseAttendance, setCourseAttendance] = useState<any[]>([]);
  const [courseComments, setCourseComments] = useState<any[]>([]);
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) {
      setRoster([]);
      setCourseTeachers([]);
      return;
    }
    api("getCourseRoster", { courseId: cid })
      .then((res) => {
        setRoster(res || []);
      })
      .catch((err) => {
        console.error("Error loading roster:", err);
      });

    api("getCourseTeachers", { courseId: cid })
      .then((res) => {
        setCourseTeachers(res || []);
      })
      .catch((err) => {
        console.error("Error loading course teachers:", err);
      });
  }, [selectedCourse]);

  useEffect(() => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) {
      setCourseAttendance([]);
      return;
    }
    const q = collection(db, "courses", cid, "attendance");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const att = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCourseAttendance(att);
    }, (err) => {
      console.error("Error loading attendance:", err);
    });
    return () => unsubscribe();
  }, [selectedCourse]);

  const toggleComments = (idx: number) => {
    setExpandedComments(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  useEffect(() => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) {
      setCourseComments([]);
      return;
    }

    const q = query(
      collection(db, "courses", cid, "class_comments"),
      orderBy("created_at", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCourseComments(comments);
    }, (err) => {
      console.error("Error loading comments:", err);
    });

    return () => unsubscribe();
  }, [selectedCourse]);

  return {
    roster, setRoster,
    courseAttendance,
    courseTeachers, setCourseTeachers,
    courseComments,
    expandedComments, setExpandedComments, toggleComments
  };
}
