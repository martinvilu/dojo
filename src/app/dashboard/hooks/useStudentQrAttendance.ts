"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

interface UseStudentQrAttendanceArgs {
  selectedCourse: any;
  setApiLoading: (v: boolean) => void;
}

/**
 * Student-side QR attendance flow: token entry, geolocation capture and
 * submission through the submitQrAttendance cloud function (which validates
 * proximity against the teacher-published coordinates).
 */
export function useStudentQrAttendance({ selectedCourse, setApiLoading }: UseStudentQrAttendanceArgs) {
  const [studentActiveAttendanceClass, setStudentActiveAttendanceClass] = useState<number | null>(null);
  const [studentQrToken, setStudentQrToken] = useState("");
  const [studentAttendanceGeoLoading, setStudentAttendanceGeoLoading] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  const handleSubmitStudentAttendanceQr = async (classNumber: number) => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    setStudentAttendanceGeoLoading(true);

    let lat: number | null = null;
    let lng: number | null = null;

    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (err) {
        console.warn("Geolocation unavailable or denied:", err);
      }
    }

    setStudentAttendanceGeoLoading(false);

    try {
      await api("submitQrAttendance", {
        courseId: cid,
        classNumber,
        token: studentQrToken.trim().toUpperCase(),
        lat,
        lng
      });
      showToast("¡Asistencia registrada con éxito! Ya estás presente.", "success");
      setStudentActiveAttendanceClass(null);
      setStudentQrToken("");
    } catch (err: any) {
      showToast("Error al registrar asistencia: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  return {
    studentActiveAttendanceClass,
    setStudentActiveAttendanceClass,
    studentQrToken,
    setStudentQrToken,
    studentAttendanceGeoLoading,
    setStudentAttendanceGeoLoading,
    isQrScannerOpen,
    setIsQrScannerOpen,
    handleSubmitStudentAttendanceQr
  };
}
