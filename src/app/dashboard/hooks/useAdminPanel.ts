"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

interface UseAdminPanelArgs {
  getSelectedCourseId?: () => string | undefined;
  setCourses: (courses: any[]) => void;
  setCourseTeachers: (teachers: any[]) => void;
  setApiLoading: (v: boolean) => void;
  setError: (msg: string) => void;
}

/**
 * Admin management domain: user approval/deletion/role changes, course
 * creation, global settings and teacher assignment to a selected course.
 */
export function useAdminPanel({
  getSelectedCourseId,
  setCourses,
  setCourseTeachers,
  setApiLoading,
  setError
}: UseAdminPanelArgs) {
  const [users, setUsers] = useState<any[]>([]);
  const [allTeachersList, setAllTeachersList] = useState<any[]>([]);
  const [selectedNewTeacherId, setSelectedNewTeacherId] = useState("");

  // Create course form
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseOrg, setNewCourseOrg] = useState("");

  // Global settings form
  const [globalCalendarUrl, setGlobalCalendarUrl] = useState("");

  const handleApproveUser = async (uid: string) => {
    if (!confirm("¿Aprobar manualmente a este usuario?")) return;
    setApiLoading(true);
    try {
      await api("approveUser", { targetUid: uid });
      const res = await api("getAdminUsers");
      setUsers(res || []);
    } catch (err: any) {
      setError("Error al aprobar usuario: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    setApiLoading(true);
    try {
      await api("deleteUser", { targetUid: uid });
      const res = await api("getAdminUsers");
      setUsers(res || []);
    } catch (err: any) {
      setError("Error al borrar usuario: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleUpdateUserRole = async (uid: string, newRole: "admin" | "teacher" | "student") => {
    if (!confirm(`¿Estás seguro de que deseas cambiar el rol del usuario a ${newRole === "admin" ? "Administrador" : newRole === "teacher" ? "Profesor" : "Estudiante"}?`)) return;
    setApiLoading(true);
    try {
      await api("updateUserRole", { targetUid: uid, newRole });
      const res = await api("getAdminUsers");
      setUsers(res || []);
    } catch (err: any) {
      setError("Error al cambiar rol: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleUpdateUserProfile = async (uid: string, data: any) => {
    setApiLoading(true);
    try {
      await api("updateUserProfile", { userId: uid, data });
      const res = await api("getAdminUsers");
      setUsers(res || []);
    } catch (err: any) {
      setError("Error al actualizar perfil de usuario: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleAssignTeacher = async () => {
    const cid = getSelectedCourseId?.();
    if (!cid || !selectedNewTeacherId) return;
    setApiLoading(true);
    try {
      await api("assignTeacher", { courseId: cid, teacherId: selectedNewTeacherId });
      setSelectedNewTeacherId("");
      const tRes = await api("getCourseTeachers", { courseId: cid });
      setCourseTeachers(tRes || []);
    } catch (err: any) {
      setError("Error al asignar profesor: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    const cid = getSelectedCourseId?.();
    if (!cid) return;
    if (!confirm("¿Desasignar a este profesor de la cátedra?")) return;
    setApiLoading(true);
    try {
      await api("removeTeacher", { courseId: cid, teacherId });
      const tRes = await api("getCourseTeachers", { courseId: cid });
      setCourseTeachers(tRes || []);
    } catch (err: any) {
      setError("Error al desasignar profesor: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName) return;
    setApiLoading(true);
    try {
      await api("createCourse", { name: newCourseName, github_org: newCourseOrg });
      setNewCourseName("");
      setNewCourseOrg("");
      const res = await api("getAdminCourses");
      setCourses(res || []);
    } catch (err: any) {
      setError("Error al crear curso: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiLoading(true);
    try {
      await api("saveGlobalSettings", { globalCalendarIcsUrl: globalCalendarUrl });
      showToast("Configuración guardada.", "success");
    } catch (err: any) {
      setError("Error al guardar configuraciones: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  return {
    users, setUsers,
    allTeachersList, setAllTeachersList,
    selectedNewTeacherId, setSelectedNewTeacherId,
    newCourseName, setNewCourseName,
    newCourseOrg, setNewCourseOrg,
    globalCalendarUrl, setGlobalCalendarUrl,
    handleApproveUser, handleDeleteUser, handleUpdateUserRole, handleUpdateUserProfile,
    handleAssignTeacher, handleRemoveTeacher,
    handleCreateCourse, handleSaveSettings
  };
}
