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
                .hidden { display: none !important; }
              </style>
            </head>
            <body>
              <h1>Jutsu Classroom Dashboard</h1>
              <p>Panel de Administración Académica y Cátedras</p>

              <!-- Sección Alertas y Roster -->
              <h2>Alertas Tempranas y Estudiantes</h2>
              <table id="roster-table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Matrícula</th>
                    <th>Alertas Tempranas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr id="student-row-1">
                    <td><strong>Juan Pérez</strong><br/><span style="color:#737373; font-size:11px;">juan@unrn.edu.ar</span></td>
                    <td>2024-001</td>
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

              <!-- Sección Modales Especiales: QR, Feedback, Tutorías y Cronogramas -->
              <div style="margin-top:24px; display:flex; flex-wrap:wrap; gap:12px;">
                <button type="button" class="btn-action" id="btn-open-qr-modal" onclick="document.getElementById('qr-modal').classList.remove('hidden')">📱 Firmar Presente QR</button>
                <button type="button" class="btn-action" id="btn-open-feedback-modal" onclick="document.getElementById('feedback-modal').classList.remove('hidden')">✍️ Dejar Feedback Anónimo</button>
                <button type="button" class="btn-action" id="btn-open-tutoring-modal" onclick="document.getElementById('tutoring-modal').classList.remove('hidden')">🤝 Postularse como Tutor</button>
                <button type="button" class="btn-action" id="btn-open-version-modal" onclick="document.getElementById('version-modal').classList.remove('hidden')">💾 Guardar Versión Cronograma</button>
                <button type="button" class="btn-action" id="btn-open-group-modal" onclick="document.getElementById('group-modal').classList.remove('hidden')">👥 Crear Grupo de Estudio</button>
                <button type="button" class="btn-action" id="btn-open-lti-guide" onclick="document.getElementById('lti-modal').classList.remove('hidden')">🔗 Ver Guía LTI Moodle</button>
                <button type="button" class="btn-action" id="btn-trigger-toast" onclick="document.getElementById('toast-container').classList.remove('hidden')">🔔 Probar Toast</button>
                <button type="button" class="btn-action" id="btn-export-ical">📅 Exportar iCal (.ics)</button>
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
