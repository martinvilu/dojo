"use client";

import React, { useState } from "react";
import ModalShell from "@/components/dashboard/ui/ModalShell";
import { diffSchedules, type DiffStatus } from "./scheduleDiff";

const STATUS_STYLE: Record<DiffStatus, { label: string; box: string; chip: string }> = {
  added: { label: "Agregada", box: "bg-green-950/10 border-green-800/30", chip: "bg-green-900/30 text-green-400" },
  removed: { label: "Eliminada", box: "bg-red-950/10 border-red-800/30", chip: "bg-red-900/30 text-red-400" },
  modified: { label: "Modificada", box: "bg-amber-950/10 border-amber-800/30", chip: "bg-amber-900/30 text-amber-400" },
  moved: { label: "Movida", box: "bg-sky-950/10 border-sky-800/30", chip: "bg-sky-900/30 text-sky-400" },
  identical: { label: "Idéntica", box: "bg-neutral-950/30 border-neutral-850", chip: "bg-neutral-800 text-gray-400" },
};

/** Historial de versiones del cronograma y comparación con otras cátedras. */
export function ScheduleVersionsModal({ teacherClasses, scheduleVersions, comparisonCourses, onRestore, onLoadComparison, onClose }: {
  teacherClasses: any[];
  scheduleVersions: any[];
  comparisonCourses: any[];
  onRestore: (versionId: string) => void;
  onLoadComparison: () => void;
  onClose: () => void;
}) {
  const [selectedVersionForDiff, setSelectedVersionForDiff] = useState<any | null>(null);
  const [selectedCourseForComparison, setSelectedCourseForComparison] = useState<any | null>(null);

  return (
    <>
        <ModalShell onClose={() => { onClose(); setSelectedVersionForDiff(null); setSelectedCourseForComparison(null); }} ariaLabel="Versiones de cronograma y comparación interanual"
          overlayClassName="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-5xl w-full min-w-[280px] sm:min-w-[640px] shrink-0 mx-auto h-[85vh] flex flex-col justify-between shadow-2xl relative z-10">
            <div className="flex justify-between items-center pb-4 border-b border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-white">Versiones de Cronograma & Comparación Interanual</h3>
                <p className="text-xs text-gray-400">Compará versiones históricas de este curso o con otras cátedras.</p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  setSelectedVersionForDiff(null);
                  setSelectedCourseForComparison(null);
                }}
                type="button"
                aria-label="Cerrar comparativa"
                className="text-gray-400 hover:text-white font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 rounded p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 my-4 overflow-hidden">
              {/* Left Column: Versions List & Course List */}
              <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2 border-r border-neutral-850">
                {/* Save Current as Version */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">Versiones Guardadas</h4>
                  <div className="space-y-2">
                    {scheduleVersions.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVersionForDiff(v);
                          setSelectedCourseForComparison(null);
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer text-xs space-y-1 ${
                          selectedVersionForDiff?.id === v.id ? "bg-blue-950/40 border-blue-500/50" : "bg-neutral-950/60 border-neutral-850 hover:border-neutral-700"
                        }`}
                      >
                        <p className="font-bold text-white">{v.version_name}</p>
                        <p className="text-[10px] text-gray-400">Por: {v.created_by_name}</p>
                        <p className="text-[9px] text-gray-500">{new Date(v.created_at).toLocaleString()}</p>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestore(v.id);
                            }}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] font-bold transition cursor-pointer"
                          >
                            Restaurar
                          </button>
                        </div>
                      </div>
                    ))}
                    {scheduleVersions.length === 0 && (
                      <p className="text-xs text-gray-500 italic">No hay versiones guardadas.</p>
                    )}
                  </div>
                </div>

                {/* Compare Interanual */}
                <div className="space-y-3 pt-3 border-t border-neutral-850">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">Comparación Interanual</h4>
                  <p className="text-[10px] text-gray-400">Compará este cronograma con otra cursada del sistema.</p>
                  <button
                    onClick={() => {
                      onLoadComparison();
                    }}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-left text-blue-400 hover:border-blue-500 font-semibold transition"
                  >
                    📂 Cargar Otras Cátedras
                  </button>

                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {comparisonCourses.map((cc) => (
                      <div
                        key={cc.id}
                        onClick={() => {
                          setSelectedCourseForComparison(cc);
                          setSelectedVersionForDiff(null);
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                          selectedCourseForComparison?.id === cc.id ? "bg-amber-950/40 border-amber-500/50" : "bg-neutral-950/60 border-neutral-850 hover:border-neutral-700"
                        }`}
                      >
                        <p className="font-bold text-white">{cc.name}</p>
                        <p className="text-[10px] text-gray-400">{cc.class_instances?.length || 0} Clases</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Diff View */}
              <div className="md:col-span-2 overflow-y-auto space-y-4 pl-2">
                {selectedVersionForDiff || selectedCourseForComparison ? (
                  <>
                    <div className="flex justify-between items-center bg-neutral-950/60 p-3 rounded-xl border border-neutral-850">
                      <span className="text-xs font-bold text-white">
                        Comparando: {selectedVersionForDiff ? `Versión "${selectedVersionForDiff.version_name}"` : `Cátedra "${selectedCourseForComparison?.name}"`} con el cronograma actual
                      </span>
                      <span className="text-[10px] text-gray-400 font-sans">Diff de Clases</span>
                    </div>

                    <div className="space-y-3">
                      {diffSchedules(teacherClasses, selectedVersionForDiff?.class_instances || selectedCourseForComparison?.class_instances || []).map((item) => (
                        <div
                          key={item.idx}
                          className={`p-4 rounded-xl border text-xs space-y-2 ${STATUS_STYLE[item.status].box}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white">Clase {item.idx}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${STATUS_STYLE[item.status].chip}`}>
                              {STATUS_STYLE[item.status].label}{item.movedFrom ? ` (antes clase ${item.movedFrom})` : ""}
                            </span>
                          </div>

                          {item.status === "identical" && (
                            <p className="text-gray-300">
                              Tema: <span className="font-semibold text-white">{item.current?.topic}</span> ({item.current?.type} - {item.current?.special_status})
                            </p>
                          )}

                          {item.status === "added" && (
                            <p className="text-green-400">
                              + Tema: <span className="font-semibold text-white">{item.current?.topic}</span> ({item.current?.type} - {item.current?.special_status})
                            </p>
                          )}

                          {item.status === "removed" && (
                            <p className="text-red-400">
                              - Tema: <span className="font-semibold text-gray-500 line-through">{item.target?.topic}</span> ({item.target?.type} - {item.target?.special_status})
                            </p>
                          )}

                          {(item.status === "modified" || item.status === "moved") && (
                            <div className="space-y-1">
                              <div className={item.status === "moved" ? "text-sky-400" : "text-amber-400"}>
                                ✎ Actual: <span className="font-semibold text-white">{item.current?.topic}</span> ({item.current?.type} - {item.current?.special_status})
                              </div>
                              <div className="text-gray-500">
                                ✎ Versión: <span className="font-semibold">{item.target?.topic}</span> ({item.target?.type} - {item.target?.special_status})
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs italic">
                    Seleccioná una versión o cátedra para ver la comparación detallada.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setSelectedVersionForDiff(null);
                  setSelectedCourseForComparison(null);
                }}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-750 text-gray-300 text-xs font-bold rounded-xl transition border border-neutral-700 cursor-pointer"
              >
                Cerrar Historial
              </button>
            </div>
        </ModalShell>
    </>
  );
}

/** Pide el nombre de la versión a guardar. */
export function SaveScheduleVersionModal({ onSave, onClose }: { onSave: (name: string) => void; onClose: () => void }) {
  const [newVersionName, setNewVersionName] = useState("");
  return (
    <>
        <ModalShell onClose={onClose} ariaLabel="Guardar versión de cronograma"
          overlayClassName="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full min-w-[280px] sm:min-w-[380px] shrink-0 mx-auto space-y-4 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Guardar Versión de Cronograma</h3>
            <p className="text-xs text-gray-400">Esto creará un snapshot del cronograma en su estado actual.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre de la Versión</label>
              <input
                type="text"
                placeholder="Ej: Planificación Inicial 2026"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onSave(newVersionName)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Guardar Versión
              </button>
            </div>
        </ModalShell>
    </>
  );
}
