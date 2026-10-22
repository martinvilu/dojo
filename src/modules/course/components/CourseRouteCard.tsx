"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { buildCoursePath, slugify, TERMS } from "@/lib/courseRoutes";

const TERM_LABEL: Record<string, string> = { "1c": "1er cuatrimestre", "2c": "2do cuatrimestre", anual: "Anual", verano: "Curso de verano" };
const inputClass = "w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white";

/**
 * Dirección pública de la cátedra: /{asignatura}/{año}/{cuatrimestre}/…
 * (SPEC §2.3). Sin IDs internos ni datos personales.
 */
export function CourseRouteCard({ course, canEdit }: { course: any; canEdit: boolean }) {
  const courseId = course?.id || course?.course?.id;
  const source = { ...(course?.course || {}), ...course };
  const startYear = Number(String(source.start_date || "").slice(0, 4)) || new Date().getFullYear();
  const [form, setForm] = useState({
    slug: source.route_slug || slugify(source.name || ""),
    year: String(source.route_year || startYear),
    term: source.route_term || (new Date().getMonth() < 7 ? "1c" : "2c"),
  });
  const [saved, setSaved] = useState(source.route_slug ? { route_slug: source.route_slug, route_year: source.route_year, route_term: source.route_term } : null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const path = saved ? buildCoursePath(saved, { subTab: "overview" }) : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api("setCourseRoute", { courseId, slug: form.slug, year: Number(form.year), term: form.term });
      setSaved({ route_slug: r.slug, route_year: r.year, route_term: r.term });
      setForm({ ...form, slug: r.slug });
      showToast("Dirección de la cátedra actualizada.", "success");
    } catch (err: any) {
      showToast("No se pudo guardar: " + err.message, "error");
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-200">🔗 Dirección de la cátedra</h3>
        <p className="text-xs text-gray-400 mt-1">Enlaces legibles y sin datos personales, para compartir o usar desde Moodle.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="routeSlug" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Asignatura</label>
          <input id="routeSlug" value={form.slug} disabled={!canEdit} onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="b6003-programacion-1" className={inputClass} />
        </div>
        <div>
          <label htmlFor="routeYear" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Año</label>
          <input id="routeYear" type="number" min={2000} max={2100} value={form.year} disabled={!canEdit} onChange={(e) => setForm({ ...form, year: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label htmlFor="routeTerm" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cuatrimestre</label>
          <select id="routeTerm" value={form.term} disabled={!canEdit} onChange={(e) => setForm({ ...form, term: e.target.value })} className={inputClass}>
            {TERMS.map((t: string) => <option key={t} value={t}>{TERM_LABEL[t] || t}</option>)}
          </select>
        </div>
      </div>
      {path && (
        <div className="flex items-center gap-2">
          <input readOnly value={`${origin}${path}`} aria-label="Dirección de la cátedra" className={`${inputClass} font-mono text-amber-400 select-all`} />
          <button type="button" onClick={async () => showToast((await copyToClipboard(`${origin}${path}`)) ? "Dirección copiada." : "No se pudo copiar.", "success")}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-semibold text-gray-200 cursor-pointer">Copiar</button>
        </div>
      )}
      {canEdit && <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer">Guardar dirección</button>}
    </form>
  );
}
