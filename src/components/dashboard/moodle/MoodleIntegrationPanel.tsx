"use client";

import React, { useState } from "react";

interface MoodleIntegrationPanelProps {
  courseId: string;
  courseName: string;
  api: (action: string, payload?: any) => Promise<any>;
  onExportXml: () => void;
  onSyncRoster: () => void;
  moodleApiUrl: string;
  setMoodleApiUrl: (val: string) => void;
  moodleWsToken: string;
  setMoodleWsToken: (val: string) => void;
  moodleCourseId: string;
  setMoodleCourseId: (val: string) => void;
}

export default function MoodleIntegrationPanel({
  courseId,
  courseName,
  api,
  onExportXml,
  onSyncRoster,
  moodleApiUrl,
  setMoodleApiUrl,
  moodleWsToken,
  setMoodleWsToken,
  moodleCourseId,
  setMoodleCourseId
}: MoodleIntegrationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [deepLinkItems, setDeepLinkItems] = useState<any[]>([]);
  const [showDeepLinkModal, setShowDeepLinkModal] = useState(false);

  const handleSyncContents = async () => {
    if (!moodleApiUrl || !moodleWsToken || !moodleCourseId) {
      alert("Completá los parámetros de conexión de Moodle.");
      return;
    }
    setLoading(true);
    try {
      const res = await api("syncMoodleCourseContents", {
        courseId,
        moodleUrl: moodleApiUrl,
        moodleToken: moodleWsToken,
        moodleCourseId
      });
      alert(`¡Contenidos importados! ${res.importedSectionsCount} nuevas secciones/clases creadas desde Moodle.`);
    } catch (err: any) {
      alert("Error al importar contenidos de Moodle: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDeepLinks = async () => {
    setLoading(true);
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const res = await api("getMoodleLtiDeepLinkContent", { courseId, baseUrl });
      setDeepLinkItems(res.items || []);
      setShowDeepLinkModal(true);
    } catch (err: any) {
      alert("Error al obtener enlaces LTI Deep Linking: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-neutral-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>🎓 Integración Extendida Moodle 4.2+ (LTI 1.3 & Web Services REST)</span>
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Vinculá la cátedra <strong>{courseName}</strong> con tu aula de Moodle para sincronizar estudiantes, tareas, notas y el calendario de la materia.
          </p>
        </div>
        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-xl text-xs font-mono font-bold whitespace-nowrap">
          ⚡ Moodle 4.2+ Ready
        </span>
      </div>

      {/* WEB SERVICES CONFIGURATION CARD */}
      <div className="bg-neutral-950 p-5 rounded-xl border border-neutral-850 space-y-4">
        <h4 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
          🔌 Configuración de Moodle Web Services API
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">URL del Servidor Moodle</label>
            <input
              type="url"
              value={moodleApiUrl}
              onChange={(e) => setMoodleApiUrl(e.target.value)}
              placeholder="https://moodle.unrn.edu.ar"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">Web Service Token (wstoken)</label>
            <input
              type="password"
              value={moodleWsToken}
              onChange={(e) => setMoodleWsToken(e.target.value)}
              placeholder={moodleWsToken ? "••••••••••••••••" : "Token REST de Moodle"}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">ID del Curso en Moodle</label>
            <input
              type="text"
              value={moodleCourseId}
              onChange={(e) => setMoodleCourseId(e.target.value)}
              placeholder="Ej: 142"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={onSyncRoster}
          disabled={loading}
          className="p-4 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-blue-500/50 rounded-xl text-left transition group cursor-pointer"
        >
          <p className="text-xs font-bold text-white group-hover:text-blue-400 transition flex items-center space-x-1">
            <span>👥 Sincronizar Alumnos</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Importa el roster inscripto en el curso de Moodle.</p>
        </button>

        <button
          type="button"
          onClick={handleSyncContents}
          disabled={loading}
          className="p-4 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-emerald-500/50 rounded-xl text-left transition group cursor-pointer"
        >
          <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition flex items-center space-x-1">
            <span>📚 Importar Contenidos</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Trae temas y clases desde Moodle a Ninja Dojo.</p>
        </button>

        <button
          type="button"
          onClick={onExportXml}
          disabled={loading}
          className="p-4 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-purple-500/50 rounded-xl text-left transition group cursor-pointer"
        >
          <p className="text-xs font-bold text-white group-hover:text-purple-400 transition flex items-center space-x-1">
            <span>📥 Descargar Respaldo XML</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Exporta la cátedra en formato Moodle XML Backup.</p>
        </button>

        <button
          type="button"
          onClick={handleFetchDeepLinks}
          disabled={loading}
          className="p-4 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-amber-500/50 rounded-xl text-left transition group cursor-pointer"
        >
          <p className="text-xs font-bold text-white group-hover:text-amber-400 transition flex items-center space-x-1">
            <span>🔗 LTI Deep Linking</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Genera enlaces directos LTI 1.3 para Moodle.</p>
        </button>
      </div>

      {/* LTI DEEP LINKING MODAL */}
      {showDeepLinkModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-xl w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex justify-between items-center">
              <span>🔗 Enlaces LTI 1.3 Deep Linking para Moodle</span>
              <button onClick={() => setShowDeepLinkModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </h3>
            <p className="text-xs text-gray-400">
              Copiá las URLs directas para agregarlas como Herramienta Externa en Moodle:
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {deepLinkItems.map((item, idx) => (
                <div key={idx} className="bg-neutral-950 p-3 rounded-xl border border-neutral-850 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="text-[10px] text-gray-500 font-mono truncate max-w-xs">{item.url}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(item.url);
                      alert("¡Enlace LTI copiado al portapapeles!");
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition whitespace-nowrap"
                  >
                    Copiar URL
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
