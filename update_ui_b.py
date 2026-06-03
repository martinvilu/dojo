import re

with open('js/app.js', 'r') as f:
    js = f.read()

# Replace assignment card UI in loadTeacherAssignments
old_ui_regex = r"<div style=\"background: #fdfdfd; padding: 15px; border: 1px solid #eee; border-radius: 4px; margin-top: 15px;\">.*?<h4 style=\"margin-top: 0; color: #2c3e50;\">📊 Carga de Notas Automática \(desde Google Sheets\)</h4>.*?</div>"

new_ui = """
                    <div style="background: #fdfdfd; padding: 15px; border: 1px solid #eee; border-radius: 4px; margin-top: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: #2c3e50;">📊 Sincronización Inversa (Google Sheets)</h4>
                            <button onclick="downloadTemplate('${a.id}', '${a.course_id}', '${a.title.replace(/'/g, "\\'")}')" style="margin: 0; background: #27ae60; border: none; font-size: 0.8em; padding: 5px 10px;">⬇️ Descargar Plantilla</button>
                        </div>
                        <p style="font-size: 0.9em; color: #555;">Ahora la sincronización se dispara <strong>directamente desde tu planilla</strong>. En Google Sheets, andá a <em>Extensiones > Apps Script</em> y pegá este código:</p>
                        
                        <div style="position: relative;">
                            <textarea readonly style="width: 100%; height: 120px; font-family: monospace; font-size: 0.8em; background: #2c3e50; color: #ecf0f1; padding: 10px; border-radius: 4px; border: none;">function SincronizarNotas() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const matriculaIdx = headers.findIndex(h => h.includes('matricula') || h.includes('matrícula'));
  const notaIdx = headers.findIndex(h => h.includes('nota') || h.includes('calificacion'));
  const feedbackIdx = headers.findIndex(h => h.includes('feedback') || h.includes('devolucion'));
  
  if (matriculaIdx === -1 || notaIdx === -1) return SpreadsheetApp.getUi().alert('Faltan columnas de Matricula o Nota');
  
  const grades = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][matriculaIdx]) grades.push({ matricula: data[i][matriculaIdx], grade: data[i][notaIdx], feedback: feedbackIdx !== -1 ? data[i][feedbackIdx] : '' });
  }
  
  const payload = { assignmentId: "${a.id}", sync_secret: "${a.sync_secret || 'NO_GENERADO_AUN_EDITA_LA_TAREA_PARA_GENERAR'}", grades: grades };
  const res = UrlFetchApp.fetch("https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/webhook", {
    method: "post", contentType: "application/json", payload: JSON.stringify(payload)
  });
  SpreadsheetApp.getUi().alert('Resultado: ' + JSON.parse(res.getContentText()).updatedCount + ' alumnos actualizados.');
}</textarea>
                        </div>
                    </div>
"""

js = re.sub(old_ui_regex, new_ui, js, flags=re.DOTALL)

# Delete window.saveSheetUrl and window.syncGrades
js = re.sub(r"window\.saveSheetUrl = async.*?};", "", js, flags=re.DOTALL)
js = re.sub(r"window\.syncGrades = async.*?};", "", js, flags=re.DOTALL)

with open('js/app.js', 'w') as f:
    f.write(js)

# Now update index.html for Webhook URL in course settings
with open('index.html', 'r') as f:
    html = f.read()

webhook_html = """
                <div class="form-group" style="margin-top: 20px;">
                    <label>URL de Webhook (Seguimiento de Entregas)</label>
                    <input type="url" id="course-webhook-url" placeholder="https://tusistema.com/webhook/recepcion-entregas">
                    <small style="color: #666; display: block; margin-top: 5px;">Si configurás esta URL, el sistema enviará un POST (JSON) cada vez que un alumno acepte una tarea.</small>
                </div>
"""

html = html.replace('<div class="form-group">\n                    <label>Token de GitHub</label>', webhook_html + '\n                <div class="form-group">\n                    <label>Token de GitHub</label>')

with open('index.html', 'w') as f:
    f.write(html)
    
# Finally update loadTeacherCourseSettings in app.js to handle webhook_url
with open('js/app.js', 'r') as f:
    js2 = f.read()

js2 = js2.replace("document.getElementById('course-github-org').value = course.github_org || '';", "document.getElementById('course-github-org').value = course.github_org || '';\n    if(document.getElementById('course-webhook-url')) document.getElementById('course-webhook-url').value = course.webhook_url || '';")

js2 = js2.replace("github_token: document.getElementById('course-github-token').value", "github_token: document.getElementById('course-github-token').value,\n        webhook_url: document.getElementById('course-webhook-url') ? document.getElementById('course-webhook-url').value : ''")

with open('js/app.js', 'w') as f:
    f.write(js2)

