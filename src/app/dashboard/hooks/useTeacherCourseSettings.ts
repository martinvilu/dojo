"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

export interface ScheduleItem {
  day: string;
  time: string;
  type: string;
}

interface UseTeacherCourseSettingsArgs {
  selectedCourse: any;
  setSelectedCourse: (updater: any) => void;
  setCourses: (updater: any) => void;
  setApiLoading: (v: boolean) => void;
}

/**
 * Teacher-side course configuration: cover text, start/duration, GitHub
 * token, Moodle integration fields, weekly schedules editor, commissions
 * and cloning from another course. Also owns the MBZ/XML export and roster
 * sync actions.
 */
export function useTeacherCourseSettings({
  selectedCourse,
  setSelectedCourse,
  setCourses,
  setApiLoading
}: UseTeacherCourseSettingsArgs) {
  // Teacher Schedule & Settings local states
  const [teacherStartDate, setTeacherStartDate] = useState("");
  const [teacherDuration, setTeacherDuration] = useState("");
  const [teacherCoverText, setTeacherCoverText] = useState("");
  const [teacherGithubToken, setTeacherGithubToken] = useState("");
  const [teacherMoodleEnabled, setTeacherMoodleEnabled] = useState(false);
  const [teacherExternalCalendars, setTeacherExternalCalendars] = useState("");
  const [teacherSchedules, setTeacherSchedules] = useState<ScheduleItem[]>([]);

  // Adding schedule states
  const [scheduleDay, setScheduleDay] = useState("Lunes");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleType, setScheduleType] = useState("Teoría");

  // Clone course config state
  const [otherTeacherCourses, setOtherTeacherCourses] = useState<any[]>([]);
  const [cloneSourceId, setCloneSourceId] = useState("");

  // Commissions editing states
  const [teacherCommissionsMapping, setTeacherCommissionsMapping] = useState<Record<string, string>>({});
  const [teacherCommissions, setTeacherCommissions] = useState<string[]>([]);
  const [newCommissionInput, setNewCommissionInput] = useState<string>("");

  // Expanded Moodle Integration states
  const [moodleApiUrl, setMoodleApiUrl] = useState<string>("");
  const [moodleWsToken, setMoodleWsToken] = useState<string>("");
  const [moodleCourseId, setMoodleCourseId] = useState<string>("");
  const [showCsvEndpoint, setShowCsvEndpoint] = useState(false);
  const [showCsvGradingEndpoint, setShowCsvGradingEndpoint] = useState(false);

  /** Hydrate the form from a getCourseSettings payload, falling back to the
   *  currently selected course snapshot. */
  const applyCourseSettings = (data: any) => {
    setTeacherStartDate(data.start_date || selectedCourse?.start_date || "");
    setTeacherDuration(data.duration_weeks ? data.duration_weeks.toString() : (selectedCourse?.duration_weeks ? selectedCourse.duration_weeks.toString() : ""));
    setTeacherCoverText(data.cover_text || selectedCourse?.cover_text || "");
    setTeacherGithubToken(data.github_token || selectedCourse?.github_token || "");
    setTeacherMoodleEnabled(data.moodle_enabled || selectedCourse?.moodle_enabled || false);
    setTeacherExternalCalendars(Array.isArray(data.external_calendars) ? data.external_calendars.join(", ") : (data.external_calendars || ""));
    setTeacherSchedules(data.schedules || selectedCourse?.schedules || []);
    const comms = Array.isArray(data.commissions) ? data.commissions : (Array.isArray(selectedCourse?.commissions) ? selectedCourse.commissions : ["Comisión A", "Comisión B"]);
    setTeacherCommissions(comms);
  };

  const handleAddSchedule = () => {
    if (!scheduleTime) return showToast("Poné una hora válida.", "success");
    setTeacherSchedules([...teacherSchedules, { day: scheduleDay, time: scheduleTime, type: scheduleType }]);
    setScheduleTime("");
  };

  const handleRemoveSchedule = (idx: number) => {
    setTeacherSchedules(teacherSchedules.filter((_, i) => i !== idx));
  };

  const handleSaveTeacherSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const durationNum = parseInt(teacherDuration);
      const updatedData = {
        cover_text: teacherCoverText,
        duration_weeks: isNaN(durationNum) ? null : durationNum,
        start_date: teacherStartDate,
        external_calendars: teacherExternalCalendars.split(",").map(c => c.trim()).filter(Boolean),
        github_token: teacherGithubToken,
        moodle_enabled: teacherMoodleEnabled,
        schedules: teacherSchedules,
        commissions: teacherCommissions,
        commissions_mapping: teacherCommissionsMapping
      };

      await api("updateCourseSettings", {
        courseId: cid,
        data: updatedData
      });

      setSelectedCourse((prev: any) => {
        if (!prev) return null;
        if (prev.course) {
          return {
            ...prev,
            course: {
              ...prev.course,
              ...updatedData
            }
          };
        }
        return {
          ...prev,
          ...updatedData
        };
      });

      setCourses((prev: any[]) => prev.map(c => {
        if (c.id === cid) {
          return {
            ...c,
            ...updatedData
          };
        }
        return c;
      }));

      showToast("Configuración de cátedra guardada.", "success");
    } catch (err: any) {
      showToast("Error al guardar configuración: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleCloneCourseConfig = async () => {
    if (!cloneSourceId) return;
    if (!confirm("¿Seguro que querés clonar la configuración? Sobrescribirá tus horarios y duración.")) return;
    setApiLoading(true);
    try {
      const cid = selectedCourse?.id || selectedCourse?.course?.id;
      await api("cloneCourseExtraData", { sourceCourseId: cloneSourceId, targetCourseId: cid });
      // Reload settings tab
      const res = await api("getCourseSettings", { courseId: cid });
      const data = res.data;
      setTeacherStartDate(data.start_date || "");
      setTeacherDuration(data.duration_weeks?.toString() || "");
      setTeacherCoverText(data.cover_text || "");
      setTeacherGithubToken(data.github_token || "");
      setTeacherMoodleEnabled(data.moodle_enabled || false);
      setTeacherExternalCalendars((data.external_calendars || []).join(", "));
      setTeacherSchedules(data.schedules || []);
      setTeacherCommissionsMapping(data.commissions_mapping || {});
      setTeacherCommissions(data.commissions || ["Comisión A", "Comisión B", "Comisión C", "Comisión D"]);
      showToast("Configuración clonada exitosamente.", "success");
    } catch (err: any) {
      showToast("Error al clonar configuración: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleExportMoodleXml = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const res = await api("exportCourseToMoodleXml", { courseId: cid });
      if (res?.mbzBase64) {
        const binaryStr = atob(res.mbzBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/x-gzip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "moodle_backup.mbz";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("¡Archivo de Respaldo MBZ (Moodle 4.2) generado y descargado exitosamente!", "success");
      } else if (res?.xmlContent) {
        const blob = new Blob([res.xmlContent], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "moodle_backup.xml";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("¡Respaldo XML de Moodle generado y descargado exitosamente!", "success");
      }
    } catch (err: any) {
      showToast("Error al exportar curso a Moodle: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleSyncMoodleRoster = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    if (!moodleApiUrl || !moodleWsToken || !moodleCourseId) {
      showToast("Por favor completá la URL de Moodle, el Token de Web Service y el ID del curso de Moodle.", "success");
      return;
    }
    setApiLoading(true);
    try {
      const res = await api("syncMoodleCourseRoster", {
        courseId: cid,
        moodleUrl: moodleApiUrl,
        moodleToken: moodleWsToken,
        moodleCourseId: moodleCourseId
      });
      showToast(`¡Sincronización completada! ${res.syncedCount} estudiantes sincronizados desde un total de ${res.totalMoodleUsers} usuarios en Moodle.`, "success");
    } catch (err: any) {
      showToast("Error al sincronizar roster desde Moodle: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  return {
    teacherStartDate, setTeacherStartDate,
    teacherDuration, setTeacherDuration,
    teacherCoverText, setTeacherCoverText,
    teacherGithubToken, setTeacherGithubToken,
    teacherMoodleEnabled, setTeacherMoodleEnabled,
    teacherExternalCalendars, setTeacherExternalCalendars,
    teacherSchedules, setTeacherSchedules,
    scheduleDay, setScheduleDay,
    scheduleTime, setScheduleTime,
    scheduleType, setScheduleType,
    otherTeacherCourses, setOtherTeacherCourses,
    cloneSourceId, setCloneSourceId,
    teacherCommissionsMapping, setTeacherCommissionsMapping,
    teacherCommissions, setTeacherCommissions,
    newCommissionInput, setNewCommissionInput,
    moodleApiUrl, setMoodleApiUrl,
    moodleWsToken, setMoodleWsToken,
    moodleCourseId, setMoodleCourseId,
    showCsvEndpoint, setShowCsvEndpoint,
    showCsvGradingEndpoint, setShowCsvGradingEndpoint,
    applyCourseSettings,
    handleAddSchedule,
    handleRemoveSchedule,
    handleSaveTeacherSettings,
    handleCloneCourseConfig,
    handleExportMoodleXml,
    handleSyncMoodleRoster
  };
}
