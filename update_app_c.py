import re

with open('js/app.js', 'r') as f:
    js = f.read()

# Add route
js = js.replace("'/teacher/assignments': 'teacher-assignments',", "'/teacher/assignments': 'teacher-assignments',\n    '/teacher/announcements': 'teacher-announcements',")

# Load teacher announcements
js = js.replace("if (path === '/teacher/assignments') loadTeacherAssignments();", "if (path === '/teacher/assignments') loadTeacherAssignments();\n    if (path === '/teacher/announcements') loadTeacherAnnouncements();")

teacher_logic = """
async function loadTeacherAnnouncements() {
    const list = document.getElementById('teacher-announcements-list');
    list.innerHTML = '<p>Cargando avisos...</p>';
    
    try {
        const cRes = await api({ action: 'getTeacherCourses' });
        const select = document.getElementById('announcement-course-select');
        select.innerHTML = cRes.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        const res = await api({ action: 'getTeacherAnnouncements' });
        
        if (res.data.length === 0) {
            list.innerHTML = '<p style="color: #666; font-style: italic;">No enviaste ningún aviso todavía.</p>';
            return;
        }
        
        list.innerHTML = res.data.map(a => {
            const cName = cRes.data.find(c => c.id === a.course_id)?.name || 'Materia Desconocida';
            const dateStr = a.created_at ? new Date(a.created_at._seconds * 1000).toLocaleString('es-AR') : 'Reciente';
            const msgHtml = typeof marked !== 'undefined' ? marked.parse(a.message) : a.message;
            return `
                <div class="card" style="border-left: 4px solid #3498db; margin-bottom: 15px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-weight: bold; color: #3498db;">${cName}</span>
                        <span style="font-size: 0.8em; color: #999;">${dateStr}</span>
                    </div>
                    <div class="markdown-body" style="font-size: 0.95em;">${msgHtml}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        list.innerHTML = `<p style="color: red;">Error: ${e.message}</p>`;
    }
}

document.getElementById('send-announcement-btn').onclick = async () => {
    const course_id = document.getElementById('announcement-course-select').value;
    const message = document.getElementById('announcement-message').value;
    if (!message) return alert("Escribí un mensaje");
    
    const btn = document.getElementById('send-announcement-btn');
    btn.disabled = true;
    btn.innerText = "Enviando...";
    try {
        await api({ action: 'createAnnouncement', payload: { course_id, message } });
        document.getElementById('announcement-message').value = '';
        loadTeacherAnnouncements();
    } catch(e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Enviar Aviso a los Alumnos";
    }
};

"""
js = js + "\n" + teacher_logic

# Update loadStudentCourses to show announcements
student_logic = """
        // Fetch announcements
        const courseIds = res.data.map(c => c.id);
        const annRes = await api({ action: 'getStudentAnnouncements', payload: { courseIds } });
        let annHtml = '';
        if (annRes.data && annRes.data.length > 0) {
            annHtml = `
            <div class="card" style="border-left: 4px solid #f1c40f; background: #fffdf5; margin-bottom: 25px;">
                <h3 style="margin-top: 0; color: #d35400;">📢 Avisos de tus Profesores</h3>
                ${annRes.data.map(a => {
                    const cName = res.data.find(c => c.id === a.course_id)?.name || 'Materia';
                    const dateStr = a.created_at ? new Date(a.created_at._seconds * 1000).toLocaleString('es-AR') : '';
                    const msgHtml = typeof marked !== 'undefined' ? marked.parse(a.message) : a.message;
                    return `
                        <div style="border-bottom: 1px solid #f0e6d2; padding-bottom: 10px; margin-bottom: 10px;">
                            <div style="font-size: 0.8em; color: #7f8c8d; margin-bottom: 5px;"><strong>${cName}</strong> - ${dateStr}</div>
                            <div class="markdown-body" style="font-size: 0.95em; color: #333;">${msgHtml}</div>
                        </div>
                    `;
                }).join('')}
            </div>
            `;
        }
        
        container.innerHTML = annHtml + res.data.map(c => {
"""

js = js.replace("container.innerHTML = res.data.map(c => {", student_logic)

with open('js/app.js', 'w') as f:
    f.write(js)
