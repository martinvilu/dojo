"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

interface UseAnnouncementsArgs {
  selectedCourse: any;
  setApiLoading: (v: boolean) => void;
  setError: (v: string) => void;
}

/**
 * Course announcements: teacher publishing (markdown body), student
 * acknowledgement and teacher-side acknowledgement listing. Announcement
 * fetching per subtab stays in the dashboard orchestrator, which uses the
 * exposed setAnnouncements.
 */
export function useAnnouncements({ selectedCourse, setApiLoading, setError }: UseAnnouncementsArgs) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState("");
  const [visibleAcksId, setVisibleAcksId] = useState<string | null>(null);
  const [announcementAcks, setAnnouncementAcks] = useState<any[]>([]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncementMessage) return;
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      await api("createAnnouncement", { course_id: cid, message: newAnnouncementMessage });
      setNewAnnouncementMessage("");
      const res = await api("getTeacherAnnouncements");
      setAnnouncements((res || []).filter((a: any) => a.course_id === cid));
      showToast("Aviso enviado a la cátedra.", "success");
    } catch (err: any) {
      showToast("Error al enviar aviso: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleAcknowledgeAnnouncement = async (announcementId: string) => {
    setApiLoading(true);
    try {
      await api("acknowledgeAnnouncement", { announcementId });
      const cid = selectedCourse?.id || selectedCourse?.course?.id;
      if (cid) {
        const annRes = await api("getStudentAnnouncements", { courseIds: [cid] });
        setAnnouncements(annRes || []);
      }
    } catch (err: any) {
      setError("Error al confirmar recepción: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleToggleAcks = async (announcementId: string) => {
    if (visibleAcksId === announcementId) {
      setVisibleAcksId(null);
      setAnnouncementAcks([]);
    } else {
      setApiLoading(true);
      try {
        const res = await api("getAnnouncementAcknowledgements", { announcementId });
        setAnnouncementAcks(res || []);
        setVisibleAcksId(announcementId);
      } catch (err: any) {
        setError("Error al cargar acuses de recibo: " + err.message);
      } finally {
        setApiLoading(false);
      }
    }
  };

  return {
    announcements,
    setAnnouncements,
    newAnnouncementMessage,
    setNewAnnouncementMessage,
    visibleAcksId,
    announcementAcks,
    handleCreateAnnouncement,
    handleAcknowledgeAnnouncement,
    handleToggleAcks
  };
}
