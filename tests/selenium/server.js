const http = require("http");

function startMockServer(port = 3000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      
      if (req.url === "/login" || req.url === "/") {
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html lang="es">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Jutsu Classroom - Login</title>
              <style>
                body { background: #0a0a0a; color: white; font-family: system-ui, sans-serif; padding: 20px; }
                .card { background: #171717; border: 1px solid #262626; padding: 24px; border-radius: 16px; max-width: 400px; margin: 40px auto; }
                input { width: 100%; padding: 10px; margin: 8px 0; background: #000; border: 1px solid #333; color: white; border-radius: 8px; box-sizing: border-box; }
                button { width: 100%; padding: 10px; margin: 6px 0; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
                button.secondary { background: #262626; color: #d4d4d4; }
                .oauth-btns { display: flex; gap: 8px; margin-top: 12px; }
                .oauth-btns button { flex: 1; background: #171717; border: 1px solid #333; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Jutsu Classroom</h1>
                <p id="auth-subtitle">Ingresá a la plataforma central</p>
                <form id="login-form" onsubmit="event.preventDefault(); window.location.href='/dashboard';">
                  <label for="email">Correo Electrónico</label>
                  <input id="email" type="email" placeholder="alumno@unrn.edu.ar" required />
                  <label for="password">Contraseña</label>
                  <input id="password" type="password" required />
                  <button type="submit" id="btn-submit">Iniciar Sesión</button>
                </form>
                <button type="button" class="secondary" id="btn-toggle-mode" onclick="
                  const p = document.getElementById('auth-subtitle');
                  if (p.innerText.includes('plataforma')) {
                    p.innerText = 'Creá tu cuenta académica';
                    this.innerText = 'Iniciá sesión';
                  } else {
                    p.innerText = 'Ingresá a la plataforma central';
                    this.innerText = 'Registrate gratis';
                  }
                ">Registrate gratis</button>
                <div class="oauth-btns">
                  <button type="button" id="btn-google"><span>Google</span></button>
                  <button type="button" id="btn-github"><span>GitHub</span></button>
                </div>
              </div>
            </body>
          </html>
        `);
      } else if (req.url.startsWith("/dashboard")) {
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html lang="es">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Jutsu Classroom - Dashboard</title>
              <style>
                body { background: #0a0a0a; color: white; font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
                h1 { font-size: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #121212; border-radius: 12px; overflow: hidden; }
                th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #262626; font-size: 13px; }
                th { background: #171717; color: #a3a3a3; font-weight: 600; text-transform: uppercase; font-size: 11px; }
                .badge-alert-critical { background: rgba(69, 10, 10, 0.9); border: 1px solid rgba(185, 28, 28, 0.6); color: #fca5a5; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
                .badge-alert-warning { background: rgba(69, 26, 3, 0.9); border: 1px solid rgba(180, 83, 9, 0.6); color: #fcd34d; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
                .badge-alert-none { background: #171717; border: 1px solid #262626; color: #a3a3a3; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; display: inline-block; white-space: nowrap; }
                .btn-action { padding: 6px 12px; background: rgba(37, 99, 235, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #93c5fd; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; }
                .btn-action:hover { background: #2563eb; color: white; }
                .btn-danger { padding: 6px 12px; background: rgba(153, 27, 27, 0.2); border: 1px solid rgba(220, 38, 38, 0.4); color: #fca5a5; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; }
                details { background: #171717; border: 1px solid #262626; padding: 16px; border-radius: 12px; margin-top: 20px; }
                summary { font-weight: bold; font-size: 14px; cursor: pointer; color: #60a5fa; }
                .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 16px; overflow-y: auto; }
                .modal-card { background: #171717; border: 1px solid #262626; padding: 24px; border-radius: 16px; width: 100%; max-width: 512px; min-width: 280px; box-sizing: border-box; }
                .toast-portal { position: fixed; bottom: 16px; left: 16px; right: 16px; z-index: 999999; max-width: 400px; margin-left: auto; background: #171717; border: 1px solid #404040; padding: 14px 16px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
                .role-badge { padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
                .role-student { background: #1e3a8a; color: #93c5fd; }
                .role-tutor { background: #312e81; color: #c084fc; }
                .role-teacher { background: #064e3b; color: #6ee7b7; }
                .role-admin { background: #701a75; color: #f0abfc; }
                .hidden { display: none !important; }
              </style>
            </head>
            <body>
              <h1>Jutsu Classroom Dashboard</h1>
              <p>Panel de Administración Académica y Cátedras</p>

              <!-- Selector de Rol Activo para Pruebas Multi-Rol -->
              <div style="background:#171717; border:1px solid #262626; padding:12px; border-radius:12px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:12px; color:#a3a3a3; font-weight:bold;">Rol Activo:</span>
                  <span id="current-role-badge" class="role-badge role-teacher">Docente</span>
                </div>
                <select id="user-role-selector" style="background:#000; color:white; border:1px solid #333; padding:4px 8px; border-radius:6px; font-size:12px;" onchange="
                  const b = document.getElementById('current-role-badge');
                  b.innerText = this.value;
                  b.className = 'role-badge role-' + this.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  document.getElementById('toast-msg').innerText = 'Rol cambiado a: ' + this.value;
                  document.getElementById('toast-container').classList.remove('hidden');
                ">
                  <option value="Estudiante">Estudiante</option>
                  <option value="Tutor">Tutor Académico</option>
                  <option value="Docente" selected>Docente</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <!-- Buscador y Filtro de Comisión -->
              <div style="margin-bottom: 16px; display:flex; flex-wrap:wrap; gap:16px; align-items:center;">
                <input id="student-search-input" type="text" placeholder="🔍 Buscar por nombre o email..." style="background:#171717; color:white; border:1px solid #333; padding:8px 12px; border-radius:8px; font-size:12px; width:240px;" oninput="
                  const q = this.value.toLowerCase();
                  const r1 = document.getElementById('student-row-1');
                  const r2 = document.getElementById('student-row-2');
                  const r3 = document.getElementById('student-row-3');
                  if (r1) r1.style.display = 'Juan Pérez'.toLowerCase().includes(q) || 'juan@unrn.edu.ar'.includes(q) ? '' : 'none';
                  if (r2) r2.style.display = 'María González'.toLowerCase().includes(q) || 'maria@unrn.edu.ar'.includes(q) ? '' : 'none';
                  if (r3) r3.style.display = 'Lucas Rodríguez'.toLowerCase().includes(q) || 'lucas@unrn.edu.ar'.includes(q) ? '' : 'none';
                " />

                <label style="font-size:12px; font-weight:bold; color:#a3a3a3;">Filtrar por Comisión:</label>
                <select id="commission-filter-select" style="background:#171717; color:white; border:1px solid #333; padding:6px 12px; border-radius:8px; font-size:12px;" onchange="
                  const val = this.value;
                  const r1 = document.getElementById('student-row-1');
                  const r2 = document.getElementById('student-row-2');
                  const r3 = document.getElementById('student-row-3');
                  if (val === 'Comisión 1') {
                    if (r1) r1.classList.remove('hidden');
                    if (r2) r2.classList.add('hidden');
                    if (r3) r3.classList.add('hidden');
                  } else {
                    if (r1) r1.classList.remove('hidden');
                    if (r2) r2.classList.remove('hidden');
                    if (r3) r3.classList.remove('hidden');
                  }
                ">
                  <option value="Todas">Todas las Comisiones</option>
                  <option value="Comisión 1">Comisión 1</option>
                  <option value="Comisión 2">Comisión 2</option>
                </select>
              </div>

              <!-- Sección Alertas y Roster -->
              <h2>Alertas Tempranas y Estudiantes</h2>
              <table id="roster-table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Matrícula</th>
                    <th>Asistencia</th>
                    <th>Tareas Entregadas</th>
                    <th>Alertas Tempranas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr id="student-row-1">
                    <td><strong>Juan Pérez</strong><br/><span style="color:#737373; font-size:11px;">juan@unrn.edu.ar</span></td>
                    <td>2024-001</td>
                    <td><span id="attendance-pct-1" style="font-weight:bold; color:#ef4444;">65%</span></td>
                    <td>
                      <div style="width:100px; height:6px; background:#262626; border-radius:4px; overflow:hidden;">
                        <div id="assignments-bar-1" style="width:50%; height:100%; background:#3b82f6;"></div>
                      </div>
                      <span style="font-size:10px; color:#a3a3a3;">2 / 4 Entregadas</span>
                    </td>
                    <td>
                      <div class="badge-alert-critical" id="alert-badge-critical">
                        <span>⚠️</span><span>Asistencia Crítica (&lt;75%)</span>
                      </div>
                    </td>
                    <td>
                      <button class="btn-action" id="btn-email-juan" onclick="document.getElementById('email-modal').classList.remove('hidden')">✉️ Email</button>
                      <button class="btn-danger" id="btn-delete-juan" onclick="document.getElementById('delete-user-modal').classList.remove('hidden')">🗑️ Borrar</button>
                    </td>
                  </tr>
                  <tr id="student-row-2">
                    <td><strong>María González</strong><br/><span style="color:#737373; font-size:11px;">maria@unrn.edu.ar</span></td>
                    <td>2024-002</td>
                    <td><span id="attendance-pct-2" style="font-weight:bold; color:#10b981;">90%</span></td>
                    <td>
                      <div style="width:100px; height:6px; background:#262626; border-radius:4px; overflow:hidden;">
                        <div id="assignments-bar-2" style="width:25%; height:100%; background:#f59e0b;"></div>
                      </div>
                      <span style="font-size:10px; color:#a3a3a3;">1 / 4 Entregadas</span>
                    </td>
                    <td>
                      <div class="badge-alert-warning" id="alert-badge-warning">
                        <span>⚠️</span><span>Tareas Atrasadas</span>
                      </div>
                    </td>
                    <td>
                      <button class="btn-action" id="btn-email-maria" onclick="document.getElementById('email-modal').classList.remove('hidden')">✉️ Email</button>
                    </td>
                  </tr>
                  <tr id="student-row-3">
                    <td><strong>Lucas Rodríguez</strong><br/><span style="color:#737373; font-size:11px;">lucas@unrn.edu.ar</span></td>
                    <td>2024-003</td>
                    <td><span id="attendance-pct-3" style="font-weight:bold; color:#10b981;">100%</span></td>
                    <td>
                      <div style="width:100px; height:6px; background:#262626; border-radius:4px; overflow:hidden;">
                        <div id="assignments-bar-3" style="width:100%; height:100%; background:#10b981;"></div>
                      </div>
                      <span style="font-size:10px; color:#a3a3a3;">4 / 4 Entregadas</span>
                    </td>
                    <td>
                      <div class="badge-alert-none" id="alert-badge-none">Sin Alertas</div>
                    </td>
                    <td>
                      <button class="btn-action" id="btn-email-lucas" onclick="document.getElementById('email-modal').classList.remove('hidden')">✉️ Email</button>
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Sección Oculta de Endpoint CSV -->
              <details id="csv-endpoint-section">
                <summary id="csv-section-summary">📊 URL de Endpoint CSV para Planillas de Cálculo (Google Sheets / Excel)</summary>
                <div style="margin-top: 12px;">
                  <p style="font-size:12px; color:#a3a3a3;">Copiá este enlace para importar notas y asistencias automáticamente en tu planilla de cálculo:</p>
                  <input id="csv-url-input" type="text" readonly value="http://localhost:3000/api/csv-export?course=programacion1&token=xyz789" style="background:#000; color:#60a5fa; border:1px solid #333; padding:8px 12px; width:100%; border-radius:8px; font-family:monospace; font-size:12px; box-sizing:border-box;" />
                  <button type="button" class="btn-action" style="margin-top:8px;" onclick="document.getElementById('toast-msg').innerText='¡URL CSV copiada al portapapeles!'; document.getElementById('toast-container').classList.remove('hidden');">Copiar URL CSV</button>
                </div>
              </details>

              <!-- Sección Modales Especiales por Rol -->
              <div style="margin-top:24px; display:flex; flex-wrap:wrap; gap:12px;">
                <button type="button" class="btn-action" id="btn-open-qr-modal" onclick="document.getElementById('qr-modal').classList.remove('hidden')">📱 Firmar Presente QR</button>
                <button type="button" class="btn-action" id="btn-generate-qr-code" onclick="
                  const token = Math.random().toString(36).substring(2, 8).toUpperCase();
                  document.getElementById('qr-generated-token').innerText = token;
                  document.getElementById('teacher-qr-modal').classList.remove('hidden');
                ">🎲 Generar Token QR Docente</button>
                <button type="button" class="btn-action" id="btn-open-schedule-email-modal" onclick="document.getElementById('schedule-email-modal').classList.remove('hidden')">📅 Programar Email Masivo Docente</button>
                <button type="button" class="btn-action" id="btn-open-grade-modal" onclick="document.getElementById('grade-modal').classList.remove('hidden')">📝 Calificar Entrega Docente</button>
                <button type="button" class="btn-action" id="btn-open-certificate-modal" onclick="document.getElementById('certificate-modal').classList.remove('hidden')">📜 Certificado de Alumno</button>
                <button type="button" class="btn-action" id="btn-open-feedback-modal" onclick="document.getElementById('feedback-modal').classList.remove('hidden')">✍️ Dejar Feedback Anónimo</button>
                <button type="button" class="btn-action" id="btn-open-tutoring-modal" onclick="document.getElementById('tutoring-modal').classList.remove('hidden')">🤝 Postularse como Tutor</button>
                <button type="button" class="btn-action" id="btn-open-tutor-profile-modal" onclick="document.getElementById('tutor-profile-modal').classList.remove('hidden')">⚙️ Perfil y Horarios Tutor</button>
                <button type="button" class="btn-action" id="btn-open-tutor-dashboard" onclick="document.getElementById('tutor-dashboard-modal').classList.remove('hidden')">🎓 Panel de Tutor</button>
                <button type="button" class="btn-action" id="btn-open-version-modal" onclick="document.getElementById('version-modal').classList.remove('hidden')">💾 Guardar Versión Cronograma</button>
                <button type="button" class="btn-action" id="btn-open-group-modal" onclick="document.getElementById('group-modal').classList.remove('hidden')">👥 Crear Grupo de Estudio</button>
                <button type="button" class="btn-action" id="btn-open-github-modal" onclick="document.getElementById('github-modal').classList.remove('hidden')">🐙 Vincular GitHub</button>
                <button type="button" class="btn-action" id="btn-open-team-modal" onclick="document.getElementById('team-modal').classList.remove('hidden')">🚩 Asignar Nombre Equipo</button>
                <button type="button" class="btn-action" id="btn-open-comment-modal" onclick="document.getElementById('comment-modal').classList.remove('hidden')">💬 Comentario de Entrega</button>
                <button type="button" class="btn-action" id="btn-open-submit-assignment-modal" onclick="document.getElementById('submit-assignment-modal').classList.remove('hidden')">📤 Entregar Tarea (URL)</button>
                <button type="button" class="btn-action" id="btn-open-join-group-modal" onclick="document.getElementById('join-group-modal').classList.remove('hidden')">🤝 Unirme a Grupo de Estudio</button>
                <button type="button" class="btn-action" id="btn-open-attendance-history" onclick="document.getElementById('attendance-history-modal').classList.remove('hidden')">📋 Historial de Asistencias</button>
                <button type="button" class="btn-action" id="btn-open-settings-modal" onclick="document.getElementById('settings-modal').classList.remove('hidden')">⚙️ Ajustes y Notificaciones</button>
                <button type="button" class="btn-action" id="btn-open-lti-guide" onclick="document.getElementById('lti-modal').classList.remove('hidden')">🔗 Ver Guía LTI Moodle</button>
                <button type="button" class="btn-action" id="btn-trigger-toast" onclick="document.getElementById('toast-container').classList.remove('hidden')">🔔 Probar Toast</button>
                <button type="button" class="btn-action" id="btn-export-ical" onclick="document.getElementById('toast-msg').innerText='¡Feed de iCal exportado exitosamente!'; document.getElementById('toast-container').classList.remove('hidden');">📅 Exportar iCal (.ics)</button>
              </div>

              <!-- MODAL CALIFICAR ENTREGA DOCENTE -->
              <div id="grade-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="grade-modal-card" style="max-width:380px;">
                  <h3 style="margin:0; font-size:16px;">📝 Calificar Entrega de Alumno</h3>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">Nota Numérica (1 al 10)</label>
                    <input id="student-grade-input" type="number" min="1" max="10" value="9" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  </div>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('grade-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-submit-grade" style="background:#10b981;" onclick="
                      document.getElementById('grade-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Calificación registrada con éxito!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Guardar Nota</button>
                  </div>
                </div>
              </div>

              <!-- MODAL CERTIFICADO DE ALUMNO -->
              <div id="certificate-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="certificate-modal-card" style="max-width:400px; text-align:center;">
                  <h3 style="margin:0; font-size:16px;">📜 Constancia de Alumno Regular</h3>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:8px;">Certificado digital verificado por Jutsu Classroom:</p>
                  <div style="background:#000; border:1px solid #333; padding:12px; border-radius:8px; margin:12px 0;">
                    <strong style="color:#60a5fa; font-size:14px;">Juan Pérez - Matrícula 2024-001</strong>
                    <p style="font-size:10px; color:#a3a3a3; margin:4px 0 0 0;">Cátedra Programación I • Estado: REGULAR</p>
                  </div>
                  <div style="display:flex; justify-content:center; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('certificate-modal').classList.add('hidden')">Cerrar</button>
                    <button type="button" id="btn-download-certificate" style="background:#2563eb;" onclick="
                      document.getElementById('certificate-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Certificado descargado exitosamente!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Descargar Constancia PDF</button>
                  </div>
                </div>
              </div>

              <!-- MODAL GENERAR TOKEN QR DOCENTE -->
              <div id="teacher-qr-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="teacher-qr-modal-card" style="max-width:380px; text-align:center;">
                  <h3 style="margin:0; font-size:16px;">🎲 Token de Asistencia Generado</h3>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:8px;">Mostrá este código en pantalla para que los alumnos firmen presente:</p>
                  <div id="qr-generated-token" style="font-size:32px; font-family:monospace; font-weight:bold; letter-spacing:6px; color:#f59e0b; margin:16px 0;">X8K2M9</div>
                  <div style="margin-top:16px; text-align:center;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('teacher-qr-modal').classList.add('hidden')">Cerrar Proyección</button>
                  </div>
                </div>
              </div>

              <!-- MODAL PROGRAMAR EMAIL MASIVO DOCENTE -->
              <div id="schedule-email-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="schedule-email-modal-card" style="max-width:420px;">
                  <h3 style="margin:0; font-size:16px;">📅 Programar Email Masivo por Alerta</h3>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">Fecha de Envío Automatizado</label>
                    <input id="schedule-email-date" type="date" value="2026-08-01" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  </div>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('schedule-email-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-submit-schedule-email" style="background:#2563eb;" onclick="
                      document.getElementById('schedule-email-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Envío masivo de emails programado!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Programar Envío</button>
                  </div>
                </div>
              </div>

              <!-- MODAL PERFIL Y HORARIOS DE TUTOR -->
              <div id="tutor-profile-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="tutor-profile-modal-card" style="max-width:400px;">
                  <h3 style="margin:0; font-size:16px;">⚙️ Ajustes de Perfil de Tutor</h3>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">Materias Habilitadas</label>
                    <input id="tutor-subjects-input" type="text" value="Programación I, Estructura de Datos" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  </div>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('tutor-profile-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-save-tutor-profile" style="background:#2563eb;" onclick="
                      document.getElementById('tutor-profile-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Perfil de tutor actualizado!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Guardar Cambios</button>
                  </div>
                </div>
              </div>

              <!-- MODAL PANEL DE TUTOR ACADÉMICO -->
              <div id="tutor-dashboard-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="tutor-dashboard-modal-card" style="max-width:440px;">
                  <h3 style="margin:0; font-size:16px;">🎓 Panel de Gestión de Tutorías Académicas</h3>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:8px;">Solicitudes de pares recibidas:</p>
                  <div style="background:#000; border:1px solid #333; padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <strong style="font-size:13px; color:white;">Solicitud de Juan Pérez</strong>
                      <p style="font-size:10px; color:#a3a3a3; margin:2px 0 0 0;">Dudas sobre React Hooks • Hoy 18:00hs</p>
                    </div>
                    <div style="display:flex; gap:6px;">
                      <button type="button" id="btn-decline-session-1" class="btn-action" style="background:rgba(239,68,68,0.2); color:#fca5a5;" onclick="
                        document.getElementById('tutor-dashboard-modal').classList.add('hidden');
                        document.getElementById('toast-msg').innerText='Sesión de tutoría rechazada o reprogramada';
                        document.getElementById('toast-container').classList.remove('hidden');
                      ">Rechazar</button>
                      <button type="button" id="btn-accept-session-1" class="btn-action" onclick="
                        document.getElementById('tutor-dashboard-modal').classList.add('hidden');
                        document.getElementById('toast-msg').innerText='¡Sesión de tutoría aceptada!';
                        document.getElementById('toast-container').classList.remove('hidden');
                      ">Aceptar</button>
                    </div>
                  </div>
                  <div style="margin-top:16px; text-align:right;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('tutor-dashboard-modal').classList.add('hidden')">Cerrar</button>
                  </div>
                </div>
              </div>

              <!-- MODAL HISTORIAL DE ASISTENCIAS DEL ALUMNO -->
              <div id="attendance-history-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="attendance-history-modal-card" style="max-width:440px;">
                  <h3 style="margin:0; font-size:16px;">📋 Mi Historial de Asistencias</h3>
                  <div id="attendance-history-list" style="margin-top:12px; display:flex; flex-col; gap:8px;">
                    <div style="background:#000; border:1px solid #333; padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between;">
                      <span style="font-size:12px; color:white;">Clase 1 - Introducción</span>
                      <span style="font-size:11px; color:#10b981; font-weight:bold;">PRESENTE</span>
                    </div>
                    <div style="background:#000; border:1px solid #333; padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between;">
                      <span style="font-size:12px; color:white;">Clase 2 - Variables y Funciones</span>
                      <span style="font-size:11px; color:#10b981; font-weight:bold;">PRESENTE</span>
                    </div>
                    <div style="background:#000; border:1px solid #333; padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between;">
                      <span style="font-size:12px; color:white;">Clase 3 - Algoritmos</span>
                      <span style="font-size:11px; color:#ef4444; font-weight:bold;">AUSENTE</span>
                    </div>
                  </div>
                  <div style="margin-top:16px; text-align:right;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('attendance-history-modal').classList.add('hidden')">Cerrar</button>
                  </div>
                </div>
              </div>

              <!-- MODAL AJUSTES Y NOTIFICACIONES DEL ALUMNO -->
              <div id="settings-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="settings-modal-card" style="max-width:400px;">
                  <h3 style="margin:0; font-size:16px;">⚙️ Ajustes y Notificaciones</h3>
                  <div style="margin-top:12px;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:white; cursor:pointer;">
                      <input id="chk-email-notif" type="checkbox" checked /> Notificaciones de Tareas por Email
                    </label>
                  </div>
                  <div style="margin-top:8px;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:white; cursor:pointer;">
                      <input id="chk-push-notif" type="checkbox" checked /> Recordatorios de Clases y Presentismo
                    </label>
                  </div>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('settings-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-save-settings" style="background:#2563eb;" onclick="
                      document.getElementById('settings-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Preferencias de usuario guardadas!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Guardar Ajustes</button>
                  </div>
                </div>
              </div>

              <!-- MODAL ENTREGAR TAREA (URL SOLUCIÓN) -->
              <div id="submit-assignment-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="submit-assignment-modal-card" style="max-width:420px;">
                  <h3 style="margin:0; font-size:16px;">📤 Entregar Tarea: Práctica 2</h3>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:8px;">Ingresá el enlace de tu solución en GitHub o Google Drive:</p>
                  <input id="assignment-solution-url-input" type="url" placeholder="https://github.com/usuario/practica2" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('submit-assignment-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-confirm-submission" style="background:#10b981;" onclick="
                      document.getElementById('submit-assignment-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Tarea entregada exitosamente!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Confirmar Entrega</button>
                  </div>
                </div>
              </div>

              <!-- MODAL UNIRSE A GRUPO DE ESTUDIO -->
              <div id="join-group-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="join-group-modal-card" style="max-width:420px;">
                  <h3 style="margin:0; font-size:16px;">🤝 Grupos de Estudio Disponibles</h3>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:8px;">Seleccioná un grupo de estudio al que desees sumarte:</p>
                  <div style="background:#000; border:1px solid #333; padding:12px; border-radius:8px; margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <strong style="font-size:13px; color:white;">Grupo Algoritmos (Turno Noche)</strong>
                      <p style="font-size:10px; color:#a3a3a3; margin:2px 0 0 0;">3 integrantes • Noche</p>
                    </div>
                    <button type="button" id="btn-confirm-join-group" class="btn-action" style="padding:4px 10px;" onclick="
                      document.getElementById('join-group-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Te has unido al grupo de estudio!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Unirme</button>
                  </div>
                  <div style="margin-top:16px; text-align:right;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('join-group-modal').classList.add('hidden')">Cerrar</button>
                  </div>
                </div>
              </div>

              <!-- MODAL VINCULAR GITHUB -->
              <div id="github-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="github-modal-card" style="max-width:380px;">
                  <h3 style="margin:0; font-size:16px;">Vincular cuenta de GitHub</h3>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:8px;">Ingresá tu usuario de GitHub para sincronizar repositorios:</p>
                  <input id="github-username-input" type="text" placeholder="ej: usuario-github" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('github-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-submit-github" style="background:#2563eb;" onclick="
                      document.getElementById('github-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Cuenta de GitHub vinculada con éxito!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Vincular GitHub</button>
                  </div>
                </div>
              </div>

              <!-- MODAL NOMBRE DE EQUIPO TAREA GRUPAL -->
              <div id="team-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="team-modal-card" style="max-width:380px;">
                  <h3 style="margin:0; font-size:16px;">Nombre del Equipo</h3>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:8px;">Esta es una tarea grupal. Ingresá el nombre de tu equipo:</p>
                  <input id="team-name-input" type="text" placeholder="LosNinjas" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('team-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-submit-team" style="background:#2563eb;" onclick="
                      document.getElementById('team-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Nombre de equipo asignado a la entrega!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Confirmar Equipo</button>
                  </div>
                </div>
              </div>

              <!-- MODAL COMENTARIO DE ENTREGA -->
              <div id="comment-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="comment-modal-card" style="max-width:400px;">
                  <h3 style="margin:0; font-size:16px;">Comentarios de la Entrega</h3>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:8px;">¿Querés dejarle un comentario opcional al profesor?</p>
                  <textarea id="submission-comment-input" rows="3" placeholder="Mensaje para el docente..." style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;"></textarea>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('comment-modal').classList.add('hidden')">Omitir</button>
                    <button type="button" id="btn-submit-comment" style="background:#2563eb;" onclick="
                      document.getElementById('comment-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Entrega y comentarios enviados!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Enviar Entrega</button>
                  </div>
                </div>
              </div>

              <!-- MODAL ENVIAR CORREO DIRECTO -->
              <div id="email-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="email-modal-card">
                  <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #262626; padding-bottom:12px;">
                    <h3 style="margin:0; font-size:16px;">✉️ Enviar Correo Directo a Alumno</h3>
                    <button type="button" id="btn-close-email-modal" style="background:none; border:none; color:#a3a3a3; font-size:18px; cursor:pointer;" onclick="document.getElementById('email-modal').classList.add('hidden')">✕</button>
                  </div>
                  <form id="direct-email-form" onsubmit="event.preventDefault(); document.getElementById('email-modal').classList.add('hidden'); document.getElementById('toast-container').classList.remove('hidden');">
                    <div style="margin-top:12px;">
                      <label style="font-size:11px; text-transform:uppercase; color:#a3a3a3; font-weight:bold;">Asunto</label>
                      <input id="email-subject-input" type="text" value="Mensaje de Cátedra Programación I" required style="width:100%; padding:8px; margin-top:4px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-top:12px;">
                      <label style="font-size:11px; text-transform:uppercase; color:#a3a3a3; font-weight:bold;">Mensaje</label>
                      <textarea id="email-body-textarea" rows="4" required style="width:100%; padding:8px; margin-top:4px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; font-family:sans-serif; box-sizing:border-box;">Estimado alumno, por favor revisar las tareas pendientes.</textarea>
                    </div>
                    <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                      <button type="button" style="width:auto; background:#262626; color:#d4d4d4;" onclick="document.getElementById('email-modal').classList.add('hidden')">Cancelar</button>
                      <button type="submit" id="btn-send-email-submit" style="width:auto; background:#2563eb; color:white;">✉️ Enviar Correo Directo</button>
                    </div>
                  </form>
                </div>
              </div>

              <!-- MODAL ELIMINAR USUARIO -->
              <div id="delete-user-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="delete-user-modal-card" style="max-width:420px;">
                  <div style="display:flex; align-items:center; gap:8px; color:#ef4444;">
                    <span style="font-size:24px;">⚠️</span>
                    <h3 id="delete-user-title" style="margin:0; font-size:16px; color:white;">Advertencia: Borrar Usuario</h3>
                  </div>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:12px;">Estás a punto de eliminar permanentemente a <strong style="color:white;">Juan Pérez</strong> del sistema.</p>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" id="btn-cancel-delete" style="background:#262626;" onclick="document.getElementById('delete-user-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-confirm-delete" style="background:#dc2626; color:white;" onclick="
                      document.getElementById('student-row-1').remove();
                      document.getElementById('delete-user-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='Usuario eliminado correctamente';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Eliminar Usuario</button>
                  </div>
                </div>
              </div>

              <!-- MODAL CREAR GRUPO DE ESTUDIO -->
              <div id="group-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="group-modal-card" style="max-width:400px;">
                  <h3 style="margin:0; font-size:16px;">👥 Crear Grupo de Estudio</h3>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">Nombre del Grupo</label>
                    <input id="group-name-input" type="text" placeholder="Grupo de estudio Algoritmos" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  </div>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">Preferencia Horaria</label>
                    <select id="group-schedule-select" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;">
                      <option value="Mañana">Mañana</option>
                      <option value="Tarde" selected>Tarde</option>
                      <option value="Noche">Noche</option>
                    </select>
                  </div>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('group-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-submit-group" style="background:#2563eb;" onclick="
                      document.getElementById('group-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Grupo de estudio creado exitosamente!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Crear Grupo</button>
                  </div>
                </div>
              </div>

              <!-- MODAL FIRMAR PRESENTISMO QR -->
              <div id="qr-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="qr-modal-card" style="max-width:380px;">
                  <h3 style="margin:0; font-size:16px;">📱 Firmar Presente (Clase 4)</h3>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:8px;">Ingresá el código de 6 caracteres del profesor:</p>
                  <input id="qr-token-input" type="text" maxlength="6" placeholder="A7B9X2" style="text-align:center; font-size:20px; font-family:monospace; font-weight:bold; letter-spacing:4px; color:#f59e0b; background:#000; border:1px solid #333; border-radius:8px; padding:10px; width:100%; box-sizing:border-box;" oninput="
                    const btn = document.getElementById('btn-confirm-qr');
                    if (this.value.length === 6) { btn.removeAttribute('disabled'); } else { btn.setAttribute('disabled', 'true'); }
                  " />
                  <div style="margin-top:16px; display:flex; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('qr-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-confirm-qr" disabled style="background:#2563eb;" onclick="
                      document.getElementById('qr-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Presente firmado correctamente!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Confirmar Presente</button>
                  </div>
                </div>
              </div>

              <!-- MODAL FEEDBACK ANÓNIMO -->
              <div id="feedback-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="feedback-modal-card" style="max-width:420px;">
                  <h3 style="margin:0; font-size:16px;">✍️ Feedback Anónimo (Clase 4)</h3>
                  <p style="font-size:11px; color:#a3a3a3;">Tu opinión es anónima y ayuda a mejorar el curso.</p>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">¿Qué te pareció la clase?</label>
                    <div style="font-size:24px; color:#fbbf24; cursor:pointer; margin-top:4px;">
                      <span id="star-5" onclick="this.parentNode.setAttribute('data-rating', '5')">★★★★★</span>
                    </div>
                  </div>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">Comentario Sugerido</label>
                    <textarea id="feedback-comment-input" rows="3" placeholder="Excelente explicación de la práctica..." style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;"></textarea>
                  </div>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('feedback-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-submit-feedback" style="background:#10b981;" onclick="
                      document.getElementById('feedback-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Feedback anónimo enviado!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Enviar Feedback</button>
                  </div>
                </div>
              </div>

              <!-- MODAL POSTULARSE COMO TUTOR -->
              <div id="tutoring-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="tutoring-modal-card" style="max-width:400px;">
                  <h3 style="margin:0; font-size:16px;">🤝 Registro como Tutor Académico</h3>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">Temas Fuertes</label>
                    <input id="tutor-topics-input" type="text" placeholder="React, TypeScript, Algoritmos" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  </div>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">Disponibilidad Horaria</label>
                    <input id="tutor-avail-input" type="text" placeholder="Lunes y Miércoles 18hs" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  </div>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('tutoring-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-submit-tutor" style="background:#2563eb;" onclick="
                      document.getElementById('tutoring-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Postulación de tutor registrada!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Postularme</button>
                  </div>
                </div>
              </div>

              <!-- MODAL GUARDAR VERSIÓN DE CRONOGRAMA -->
              <div id="version-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="version-modal-card" style="max-width:380px;">
                  <h3 style="margin:0; font-size:16px;">💾 Guardar Versión de Cronograma</h3>
                  <p style="font-size:12px; color:#a3a3a3;">Crea un snapshot del estado actual.</p>
                  <div style="margin-top:12px;">
                    <label style="font-size:11px; font-weight:bold; color:#a3a3a3;">Nombre de la Versión</label>
                    <input id="version-name-input" type="text" placeholder="Planificación Inicial 2026" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:white; border-radius:8px; font-size:12px; box-sizing:border-box;" />
                  </div>
                  <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" style="background:#262626;" onclick="document.getElementById('version-modal').classList.add('hidden')">Cancelar</button>
                    <button type="button" id="btn-save-version" style="background:#2563eb;" onclick="
                      document.getElementById('version-modal').classList.add('hidden');
                      document.getElementById('toast-msg').innerText='¡Snapshot de versión guardado!';
                      document.getElementById('toast-container').classList.remove('hidden');
                    ">Guardar Versión</button>
                  </div>
                </div>
              </div>

              <!-- MODAL LTI MOODLE -->
              <div id="lti-modal" class="modal-backdrop hidden">
                <div class="modal-card" id="lti-modal-card" style="max-width:600px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #262626; padding-bottom:12px;">
                    <h3 style="margin:0; font-size:16px;">📖 Guía paso a paso: Herramienta Externa LTI en Moodle</h3>
                    <button type="button" id="btn-close-lti-modal" style="background:none; border:none; color:#a3a3a3; font-size:18px; cursor:pointer;" onclick="document.getElementById('lti-modal').classList.add('hidden')">✕</button>
                  </div>
                  <p style="font-size:12px; color:#a3a3a3; margin-top:12px;">Configuración de URL del iniciador LTI 1.3:</p>
                  <code id="lti-url-code" style="background:#000; color:#34d399; padding:8px; display:block; border-radius:6px; font-size:12px;">http://localhost:3000/api/lti/launch</code>
                  <div style="margin-top:16px; text-align:right;">
                    <button type="button" style="width:auto; background:#262626; color:white;" onclick="document.getElementById('lti-modal').classList.add('hidden')">Cerrar Guía</button>
                  </div>
                </div>
              </div>

              <!-- TOAST NOTIFICATION -->
              <div id="toast-container" class="toast-portal hidden" role="alert" aria-live="polite">
                <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block; shrink:0;"></span>
                <p id="toast-msg" style="margin:0; font-size:13px; color:white; font-weight:600; flex:1; padding:0 12px;">¡Acción realizada con éxito en Ninja Dojo!</p>
                <button type="button" id="btn-close-toast" style="background:none; border:none; color:#a3a3a3; font-size:14px; cursor:pointer;" onclick="document.getElementById('toast-container').classList.add('hidden')">✕</button>
              </div>
            </body>
          </html>
        `);
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    server.listen(port, () => {
      resolve(server);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(null);
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { startMockServer };
