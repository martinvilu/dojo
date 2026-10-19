/** Módulos de Ninja Dojo que un docente puede insertar en Moodle por Deep Linking. */
export const LTI_MODULES: Record<string, { title: string; text: string; target: string }> = {
  course: { title: "📚 Vista General de la Cátedra", text: "Acceso al panel principal, docentes y planificación general.", target: "overview" },
  calendar: { title: "📅 Calendario y Cronograma", text: "Acceso al calendario interactivo, cronograma de clases y eventos de la cursada.", target: "schedules" },
  github: { title: "💻 Prácticas y Entregas (GitHub)", text: "Módulo de gestión de tareas prácticas y repositorios en GitHub.", target: "assignments" },
  mail: { title: "📧 Gestión de Correos Electrónicos", text: "Envío y programación de correos a estudiantes de la cátedra.", target: "emails" },
  students: { title: "📊 Estado de Cursada y Alumnos", text: "Panel de control de presentismo, entregas y progreso.", target: "students" },
  announcements: { title: "📢 Tablero de Avisos y Novedades", text: "Novedades oficiales e información importante de la cátedra.", target: "announcements" },
  tutoring: { title: "🤝 Módulo de Tutorías y Mentorías", text: "Espacio para solicitar mentorías entre pares y consultas académicas.", target: "tutorias" },
  study_groups: { title: "👥 Grupos de Estudio", text: "Organización de equipos de estudio y emparejamiento inteligente.", target: "study_groups" },
  auth: { title: "🔐 Autenticación y Perfil", text: "Acceso a la gestión de cuenta, OAuth y tokens personales.", target: "profile" },
};

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]!);

/** Pantalla de selección de módulo; envía `selectedModule` + campos ocultos a `action`. */
export function moduleSelectionPage(action: string, hidden: Record<string, string>): string {
  const cards = Object.entries(LTI_MODULES).map(([key, m]) => `
    <form method="POST" action="${esc(action)}" class="card">
      ${Object.entries(hidden).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("")}
      <input type="hidden" name="selectedModule" value="${esc(key)}">
      <h2>${m.title}</h2><p>${m.text}</p>
      <button type="submit">Agregar módulo</button>
    </form>`).join("");
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ninja Dojo · Deep Linking</title>
<style>
  body{background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;margin:0;padding:24px}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#a3a3a3;font-size:13px;margin:0 0 20px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
  .card{background:#171717;border:1px solid #262626;border-radius:14px;padding:16px;margin:0}
  .card h2{font-size:15px;margin:0 0 6px} .card p{color:#a3a3a3;font-size:12px;margin:0 0 12px}
  button{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer}
  button:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
</style></head>
<body><h1>🥷 Ninja Dojo (Jutsu Classroom)</h1><p class="sub">Elegí el módulo que querés integrar en esta sección del curso de Moodle.</p>
<div class="grid">${cards}</div></body></html>`;
}
