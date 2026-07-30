"use client";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

import React, { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

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
      showToast("Completá los parámetros de conexión de Moodle.", "success");
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
      showToast(`¡Contenidos importados! ${res.importedSectionsCount} nuevas secciones/clases creadas desde Moodle.`, "success");
    } catch (err: any) {
      showToast("Error al importar contenidos de Moodle: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const getPublicBaseUrl = () => {
    const CANONICAL = "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app";
    if (typeof window === "undefined") return CANONICAL;
    const origin = window.location.origin;
    if (
      !origin ||
      origin.includes("0.0.0.0") ||
      origin.includes("127.0.0.1") ||
      origin.includes("localhost") ||
      origin.includes(":8080") ||
      origin.includes(":3000")
    ) {
      return CANONICAL;
    }
    return origin;
  };

  const handleFetchDeepLinks = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const baseUrl = getPublicBaseUrl();
      const res = await api("getMoodleLtiDeepLinkContent", { courseId, baseUrl });
      setDeepLinkItems(res.items || []);
      setShowDeepLinkModal(true);
    } catch (err: any) {
      showToast("Error al obtener enlaces LTI Deep Linking: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const [showGuideModal, setShowGuideModal] = useState(false);

  const ltiToolUrl = `${getPublicBaseUrl()}/api/lti/launch`;
  const ltiDeepLinkUrl = `${getPublicBaseUrl()}/api/lti/deeplink`;

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
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="btn-secondary text-xs px-3 py-1.5 min-h-[36px]"
          >
            <span>📖 Guía de Registro LTI</span>
          </button>
          <span className="chip-status bg-tertiary-container/20 text-tertiary border border-tertiary/30 font-mono font-bold whitespace-nowrap">
            ⚡ Moodle 4.2+ Ready
          </span>
        </div>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-xl w-full min-w-[280px] sm:min-w-[480px] shrink-0 mx-auto max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative z-10 text-left">
            <h3 className="text-base font-bold text-text-primary flex justify-between items-center">
              <span>🔗 Enlaces LTI 1.3 Deep Linking para Moodle</span>
              <button onClick={() => setShowDeepLinkModal(false)} className="text-text-secondary hover:text-text-primary text-sm font-bold cursor-pointer" aria-label="Cerrar modal">✕</button>
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
                    onClick={async () => {
                      const ok = await copyToClipboard(item.url);
                      showToast(ok ? "¡Enlace LTI copiado al portapapeles con éxito!" : "No se pudo copiar el enlace LTI automáticamente.", "success");
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

      {/* MOODLE LTI CONFIGURATION GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-2xl w-full min-w-[280px] sm:min-w-[540px] shrink-0 mx-auto max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl relative z-10 text-left my-auto">
            <div className="flex justify-between items-start border-b border-border-custom pb-3">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center space-x-2">
                  <span>📖 Guía paso a paso: Registro de Herramienta Externa en Moodle</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Completá el formulario de <strong>Administración del sitio &gt; Plugins &gt; Herramientas externas &gt; Registrar herramienta externa</strong> en Moodle con estos parámetros exactos:
                </p>
              </div>
              <button onClick={() => setShowGuideModal(false)} className="text-text-secondary hover:text-text-primary text-sm font-bold cursor-pointer" aria-label="Cerrar modal">✕</button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2 text-xs">
              {/* SECTION 1: AJUSTES DE LA HERRAMIENTA */}
              <div className="bg-bg-primary p-4 rounded border border-border-custom space-y-3">
                <h4 className="font-bold text-text-primary uppercase tracking-wider text-xs border-b border-border-custom pb-1">
                  1. Ajustes de la Herramienta
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-text-secondary">Nombre de la herramienta:</span>
                    <button
                      onClick={async () => {
                        const ok = await copyToClipboard(`Ninja Dojo - ${courseName}`);
                        showToast(ok ? "¡Nombre de la herramienta copiado con éxito!" : "No se pudo copiar el texto.", "success");
                      }}
                      className="text-tertiary hover:underline text-[11px] font-bold"
                    >
                      Copiar
                    </button>
                  </div>
                  <input readOnly value={`Ninja Dojo - ${courseName}`} className="input-academic w-full font-mono text-[11px]" />

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-text-secondary">URL de la herramienta:</span>
                    <button
                      onClick={async () => {
                        const ok = await copyToClipboard(ltiToolUrl);
                        showToast(ok ? "¡URL de la herramienta copiada con éxito!" : "No se pudo copiar la URL.", "success");
                      }}
                      className="text-tertiary hover:underline text-[11px] font-bold"
                    >
                      Copiar
                    </button>
                  </div>
                  <input readOnly value={ltiToolUrl} className="input-academic w-full font-mono text-[11px]" />

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-text-secondary">LTI Version:</span>
                    <span className="chip-status text-[10px]">LTI 1.3 / Advantage (o LTI 1.0/1.1)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="font-semibold text-text-secondary block">Clave de cliente:</span>
                      <input readOnly value="dojo_unrn" className="input-academic w-full font-mono text-[11px] mt-1" />
                    </div>
                    <div>
                      <span className="font-semibold text-text-secondary block">Secreto compartido:</span>
                      <input readOnly value="sec_dojo_unrn_2026" className="input-academic w-full font-mono text-[11px] mt-1" />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-text-secondary">Parámetros personalizados:</span>
                    <button
                      onClick={async () => {
                        const ok = await copyToClipboard(`course_id=${courseId}`);
                        showToast(ok ? "¡Parámetros copiados con éxito!" : "No se pudo copiar los parámetros.", "success");
                      }}
                      className="text-tertiary hover:underline text-[11px] font-bold"
                    >
                      Copiar
                    </button>
                  </div>
                  <input readOnly value={`course_id=${courseId}`} className="input-academic w-full font-mono text-[11px]" />

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-text-secondary">Contenedor de inicio por defecto:</span>
                    <span className="font-semibold text-text-primary">Incrustar, sin bloques</span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <input type="checkbox" checked readOnly className="rounded" />
                    <span className="font-semibold text-text-primary">Supports Deep Linking (Content-Item Message)</span>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-text-secondary">Content Selection URL:</span>
                    <button
                      onClick={async () => {
                        const ok = await copyToClipboard(ltiDeepLinkUrl);
                        showToast(ok ? "¡URL de selección copiada con éxito!" : "No se pudo copiar la URL.", "success");
                      }}
                      className="text-tertiary hover:underline text-[11px] font-bold"
                    >
                      Copiar
                    </button>
                  </div>
                  <input readOnly value={ltiDeepLinkUrl} className="input-academic w-full font-mono text-[11px]" />
                </div>
              </div>

              {/* SECTION 2: SERVICIOS */}
              <div className="bg-bg-primary p-4 rounded border border-border-custom space-y-2">
                <h4 className="font-bold text-text-primary uppercase tracking-wider text-xs border-b border-border-custom pb-1">
                  2. Servicios
                </h4>
                <p className="text-text-secondary"><strong className="text-text-primary">IMS LTI Assignment and Grade Services:</strong> Use this service for grade sync and column management</p>
                <p className="text-text-secondary"><strong className="text-text-primary">IMS LTI Names and Role Provisioning:</strong> Use this service to retrieve members' information as per privacy settings</p>
                <p className="text-text-secondary"><strong className="text-text-primary">Tool Settings:</strong> Use this service</p>
              </div>

              {/* SECTION 3: PRIVACIDAD */}
              <div className="bg-bg-primary p-4 rounded border border-border-custom space-y-2">
                <h4 className="font-bold text-text-primary uppercase tracking-wider text-xs border-b border-border-custom pb-1">
                  3. Privacidad
                </h4>
                <p className="text-text-secondary"><strong className="text-text-primary">Compartir el nombre del usuario:</strong> Siempre</p>
                <p className="text-text-secondary"><strong className="text-text-primary">Compartir el e-mail del usuario:</strong> Siempre</p>
                <p className="text-text-secondary"><strong className="text-text-primary">Aceptar calificaciones desde la herramienta:</strong> As specified in Deep Linking definition or Delegate to teacher</p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border-custom">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="btn-primary"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
