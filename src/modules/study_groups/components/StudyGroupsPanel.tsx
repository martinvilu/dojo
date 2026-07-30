"use client";

import React, { useState } from "react";
import BaseModal from "@/components/dashboard/ui/BaseModal";

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  schedule_prefs: string;
  members: string[];
  member_profiles?: any[];
}

interface StudyGroupsPanelProps {
  courseId: string;
  studyGroups: StudyGroup[];
  setStudyGroups: (groups: StudyGroup[]) => void;
  currentUser: any;
  api: (action: string, payload: any) => Promise<any>;
}

export default function StudyGroupsPanel({
  courseId,
  studyGroups,
  setStudyGroups,
  currentUser,
  api
}: StudyGroupsPanelProps) {
  const [buddySearchSchedulePrefs, setBuddySearchSchedulePrefs] = useState("Tarde");
  const [matchedBuddies, setMatchedBuddies] = useState<any[]>([]);
  const [searchingBuddies, setSearchingBuddies] = useState(false);

  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupSchedule, setNewGroupSchedule] = useState("Tarde");

  const handleFindStudyBuddies = async () => {
    try {
      setSearchingBuddies(true);
      const matches = await api("findStudyBuddies", {
        courseId,
        schedulePrefs: buddySearchSchedulePrefs
      });
      setMatchedBuddies(matches || []);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Error al buscar compañeros");
    } finally {
      setSearchingBuddies(false);
    }
  };

  const handleCreateStudyGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await api("createStudyGroup", {
        courseId,
        name: newGroupName,
        description: newGroupDesc,
        schedule_prefs: newGroupSchedule
      });
      setIsCreateGroupModalOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
      const groupsList = await api("getStudyGroups", { courseId });
      setStudyGroups(groupsList || []);
    } catch (e: any) {
      alert("Error creando grupo: " + (e.message || e));
    }
  };

  const handleJoinStudyGroup = async (groupId: string) => {
    if (!confirm("¿Querés unirte a este grupo?")) return;
    try {
      await api("joinStudyGroup", { groupId });
      const groupsList = await api("getStudyGroups", { courseId });
      setStudyGroups(groupsList || []);
    } catch (e: any) {
      alert("Error: " + (e.message || e));
    }
  };

  const handleLeaveStudyGroup = async (groupId: string) => {
    if (!confirm("¿Seguro que querés abandonar este grupo?")) return;
    try {
      await api("leaveStudyGroup", { groupId });
      const groupsList = await api("getStudyGroups", { courseId });
      setStudyGroups(groupsList || []);
    } catch (e: any) {
      alert("Error: " + (e.message || e));
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">Grupos de Estudio Auto-organizados</h3>
            <p className="text-xs text-gray-400">Formá grupos de estudio con tus compañeros de cursada.</p>
          </div>
          <button
            onClick={() => setIsCreateGroupModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            ✨ Crear Nuevo Grupo
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Matching Engine Panel */}
          <div className="lg:col-span-1 bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
            <h4 className="font-bold text-white text-sm">🔍 Emparejamiento Inteligente</h4>
            <p className="text-xs text-gray-400">
              Buscá compañeros de cursada que estudien en tus mismos horarios para armar grupos de trabajo.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mi Preferencia Horaria</label>
                <select
                  value={buddySearchSchedulePrefs}
                  onChange={(e) => setBuddySearchSchedulePrefs(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Mañana">Mañana (08:00 - 12:00)</option>
                  <option value="Tarde">Tarde (12:00 - 18:00)</option>
                  <option value="Noche">Noche (18:00 - 22:00)</option>
                </select>
              </div>
              <button
                onClick={handleFindStudyBuddies}
                className="w-full px-4 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                {searchingBuddies ? "Buscando..." : "Buscar Compañeros Afines"}
              </button>
            </div>

            {matchedBuddies.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-neutral-850">
                <h5 className="text-xs font-bold text-amber-500">Alumnos encontrados ({matchedBuddies.length}):</h5>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {matchedBuddies.map((buddy) => (
                    <div key={buddy.id} className="bg-neutral-950/80 p-3 rounded-xl border border-neutral-850 text-xs">
                      <p className="font-semibold text-white">{buddy.full_name || buddy.email}</p>
                      <p className="text-[10px] text-gray-400">{buddy.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-900/40 text-blue-400 rounded text-[9px] font-bold">
                        {buddy.schedule_pref}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {matchedBuddies.length === 0 && !searchingBuddies && (
              <p className="text-xs text-gray-500 text-center pt-2">No se buscaron compañeros aún o no hay coincidencias.</p>
            )}
          </div>

          {/* Groups list */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="font-bold text-white text-sm">Grupos Activos ({studyGroups.length})</h4>
            {studyGroups.map((g) => {
              const isMember = g.members?.includes(currentUser?.uid);
              return (
                <div key={g.id} className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="text-base font-bold text-white">{g.name}</h5>
                      <p className="text-xs text-gray-400 mt-1">{g.description || "Sin descripción."}</p>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[10px] font-bold">
                      ⌚ Horario: {g.schedule_prefs}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h6 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Integrantes ({g.members?.length || 0}):</h6>
                    <div className="flex flex-wrap gap-2">
                      {g.member_profiles?.map((member: any) => (
                        <div key={member.id} className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-full border border-neutral-850">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          <span className="text-[11px] text-gray-300">{member.full_name || member.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-neutral-850">
                    {isMember ? (
                      <button
                        onClick={() => handleLeaveStudyGroup(g.id)}
                        className="px-4 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/25 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        Abandonar Grupo
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinStudyGroup(g.id)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Unirme al Grupo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {studyGroups.length === 0 && (
              <div className="bg-neutral-900/10 border border-dashed border-neutral-800 p-8 rounded-2xl text-center text-gray-500">
                No hay grupos activos en esta cátedra. ¡Creá el primero!
              </div>
            )}
          </div>
        </div>
      </div>

      {isCreateGroupModalOpen && (
        <BaseModal
          isOpen={isCreateGroupModalOpen}
          onClose={() => setIsCreateGroupModalOpen(false)}
        >
          <form onSubmit={handleCreateStudyGroup} className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full min-w-[280px] sm:min-w-[380px] shrink-0 mx-auto space-y-4 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Crear Grupo de Estudio</h3>
              <p className="text-xs text-gray-400 mb-6">Armá un grupo para juntarte a estudiar, resolver prácticas o hacer el TP.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nombre del Grupo</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Ej: Los recursantes de Algoritmos"
                  className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descripción (Objetivo)</label>
                <textarea
                  required
                  value={newGroupDesc}
                  onChange={e => setNewGroupDesc(e.target.value)}
                  placeholder="Ej: Nos juntamos los findes a sacar la guía de ejercicios..."
                  rows={3}
                  className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Horario Preferido</label>
                <select
                  value={newGroupSchedule}
                  onChange={(e) => setNewGroupSchedule(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="Mañana">Mañana (08:00 - 12:00)</option>
                  <option value="Tarde">Tarde (12:00 - 18:00)</option>
                  <option value="Noche">Noche (18:00 - 22:00)</option>
                  <option value="Fines de Semana">Fines de Semana</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setIsCreateGroupModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Crear Grupo
              </button>
            </div>
          </form>
        </BaseModal>
      )}
    </>
  );
}
