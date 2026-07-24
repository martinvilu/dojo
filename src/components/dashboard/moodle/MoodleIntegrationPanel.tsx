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
    <div className="card-academic space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border-custom pb-4">
        <div>
          <h3 className="text-lg font-bold text-text-primary flex items-center space-x-2">
            <span>🎓 Integración Extendida Moodle 4.2+ (LTI 1.3 & Web Services REST)</span>
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Vinculá la cátedra <strong>{courseName}</strong> con tu aula de Moodle para sincronizar estudiantes, tareas, notas y el calendario de la materia.
          </p>
        </div>
        <span className="chip-status bg-tertiary-container/20 text-tertiary border border-tertiary/30 font-mono font-bold whitespace-nowrap">
          ⚡ Moodle 4.2+ Ready
        </span>
      </div>

      {/* WEB SERVICES CONFIGURATION CARD */}
      <div className="bg-bg-primary p-5 rounded border border-border-custom space-y-4">
        <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">
          🔌 Configuración de Moodle Web Services API
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary mb-1">URL del Servidor Moodle</label>
            <input
              type="url"
              value={moodleApiUrl}
              onChange={(e) => setMoodleApiUrl(e.target.value)}
              placeholder="https://moodle.unrn.edu.ar"
              className="input-academic w-full font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary mb-1">Web Service Token (wstoken)</label>
            <input
              type="password"
              value={moodleWsToken}
              onChange={(e) => setMoodleWsToken(e.target.value)}
              placeholder={moodleWsToken ? "••••••••••••••••" : "Token REST de Moodle"}
              className="input-academic w-full font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary mb-1">ID del Curso en Moodle</label>
            <input
              type="text"
              value={moodleCourseId}
              onChange={(e) => setMoodleCourseId(e.target.value)}
              placeholder="Ej: 142"
              className="input-academic w-full font-mono text-xs"
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
          className="p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-custom rounded text-left transition group cursor-pointer"
        >
          <p className="text-xs font-bold text-text-primary group-hover:text-tertiary transition flex items-center space-x-1">
            <span>👥 Sincronizar Alumnos</span>
          </p>
          <p className="text-[11px] text-text-secondary mt-1">Importa el roster inscripto en el curso de Moodle.</p>
        </button>

        <button
          type="button"
          onClick={handleSyncContents}
          disabled={loading}
          className="p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-custom rounded text-left transition group cursor-pointer"
        >
          <p className="text-xs font-bold text-text-primary group-hover:text-emerald-600 transition flex items-center space-x-1">
            <span>📚 Importar Contenidos</span>
          </p>
          <p className="text-[11px] text-text-secondary mt-1">Trae temas y clases desde Moodle a Ninja Dojo.</p>
        </button>

        <button
          type="button"
          onClick={onExportXml}
          disabled={loading}
          className="p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-custom rounded text-left transition group cursor-pointer"
        >
          <p className="text-xs font-bold text-text-primary group-hover:text-purple-600 transition flex items-center space-x-1">
            <span>📥 Descargar Respaldo XML</span>
          </p>
          <p className="text-[11px] text-text-secondary mt-1">Exporta la cátedra en formato Moodle XML Backup.</p>
        </button>

        <button
          type="button"
          onClick={handleFetchDeepLinks}
          disabled={loading}
          className="p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-custom rounded text-left transition group cursor-pointer"
        >
          <p className="text-xs font-bold text-text-primary group-hover:text-amber-600 transition flex items-center space-x-1">
            <span>🔗 LTI Deep Linking</span>
          </p>
          <p className="text-[11px] text-text-secondary mt-1">Genera enlaces directos LTI 1.3 para Moodle.</p>
        </button>
      </div>

      {/* LTI DEEP LINKING MODAL */}
      {showDeepLinkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-academic max-w-xl w-full space-y-4 shadow-xl rounded-lg">
            <h3 className="text-base font-bold text-text-primary flex justify-between items-center">
              <span>🔗 Enlaces LTI 1.3 Deep Linking para Moodle</span>
              <button onClick={() => setShowDeepLinkModal(false)} className="text-text-secondary hover:text-text-primary text-sm font-bold cursor-pointer">✕</button>
            </h3>
            <p className="text-xs text-text-secondary">
              Copiá las URLs directas para agregarlas como Herramienta Externa en Moodle:
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {deepLinkItems.map((item, idx) => (
                <div key={idx} className="bg-bg-primary p-3 rounded border border-border-custom flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-text-primary">{item.title}</p>
                    <p className="text-[10px] text-text-muted font-mono truncate max-w-xs">{item.url}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(item.url);
                      alert("¡Enlace LTI copiado al portapapeles!");
                    }}
                    className="btn-primary min-w-[80px] min-h-[32px] text-xs py-1"
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
