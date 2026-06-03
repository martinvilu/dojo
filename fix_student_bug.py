import re

# Fix index.html
with open('index.html', 'r') as f:
    html = f.read()

section_html = """
        <section id="teacher-announcements" class="content-section hidden">
            <header class="dashboard-header">
                <h2>📢 Enviar Avisos Generales</h2>
            </header>
            
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <div style="flex: 2; min-width: 300px;">
                    <div class="card" style="border-top: 4px solid #3498db;">
                        <h3 style="margin-top: 0; color: #2c3e50;">Nuevo Aviso</h3>
                        <div class="form-group">
                            <label>Seleccionar Materia</label>
                            <select id="announcement-course-select"></select>
                        </div>
                        <div class="form-group">
                            <label>Mensaje (Soporta Markdown)</label>
                            <textarea id="announcement-message" placeholder="Escribí acá tu aviso para los alumnos..." style="height: 150px; font-family: monospace;"></textarea>
                        </div>
                        <button id="send-announcement-btn" style="background: #3498db;">Enviar Aviso a los Alumnos</button>
                    </div>
                    
                    <h3 style="margin-top: 30px; color: #2c3e50;">Tus Avisos Anteriores</h3>
                    <div id="teacher-announcements-list"></div>
                </div>
                
                <div style="flex: 1; min-width: 250px;">
                    <div class="card" style="background: #fdfdfd; border: 1px solid #ddd;">
                        <h3 style="margin-top: 0; font-size: 1.1em; color: #27ae60;">💡 Últimos Cambios (Changelog)</h3>
                        <p style="font-size: 0.85em; color: #666;">Te dejamos un resumen de las últimas mejoras que le hicimos a Jutsu Classroom, por si querés avisarles a tus alumnos:</p>
                        <ul style="font-size: 0.85em; color: #444; padding-left: 20px;">
                            <li><strong>Grupos:</strong> Los TPs ahora pueden ser grupales. El líder crea el repo y luego invita a los compañeros desde su panel.</li>
                            <li><strong>Solo Lectura:</strong> Podés archivar tareas desde la pestaña Entregas para bloquear el código (se les saca el permiso de push).</li>
                            <li><strong>Markdown:</strong> El cronograma y los avisos ahora soportan formato Markdown.</li>
                            <li><strong>Calendario:</strong> Los alumnos pueden agregar el cronograma directo a Google Calendar.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
"""

if "teacher-announcements" not in html:
    html = html.replace('<section id="student-courses" class="content-section hidden">', section_html + '\n        <section id="student-courses" class="content-section hidden">')

with open('index.html', 'w') as f:
    f.write(html)

# Fix app.js
with open('js/app.js', 'r') as f:
    js = f.read()

js = js.replace("document.getElementById('send-announcement-btn').onclick = async () => {", """
const annBtn = document.getElementById('send-announcement-btn');
if (annBtn) annBtn.onclick = async () => {""")

with open('js/app.js', 'w') as f:
    f.write(js)
