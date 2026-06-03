import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, GithubAuthProvider, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const firebaseConfig = {
  projectId: "jutsu-classroom-mrtin",
  appId: "1:913557328690:web:831831bbd35cd384a67d2b",
  storageBucket: "jutsu-classroom-mrtin.firebasestorage.app",
  apiKey: "REPLACED_BY_ENV_VAL",
  authDomain: "jutsu-classroom-mrtin.firebaseapp.com",
  messagingSenderId: "913557328690"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

const loadingIndicator = document.getElementById('loading-indicator');
const withLoading = async (fn) => {
    loadingIndicator.classList.remove('hidden');
    try { return await fn(); }
    finally { loadingIndicator.classList.add('hidden'); }
};

const _api = httpsCallable(functions, 'api');
const api = async (data) => withLoading(() => _api(data));

let currentUser = null;
let currentProfile = null;

const logoutBtn = document.getElementById('logout-btn');
const authOverlay = document.getElementById('auth-overlay');
const userDisplay = document.getElementById('user-display');
const userRoleLabel = document.getElementById('user-role');

document.getElementById('login-github-btn').onclick = () => {
    loadingIndicator.classList.remove('hidden');
    signInWithPopup(auth, new GithubAuthProvider())
        .catch(e => { alert("Falló el inicio con GitHub: " + e.message); })
        .finally(() => loadingIndicator.classList.add('hidden'));
};

document.getElementById('login-google-btn').onclick = () => {
    loadingIndicator.classList.remove('hidden');
    signInWithPopup(auth, new GoogleAuthProvider())
        .catch(e => { alert("Falló el inicio con Google: " + e.message); })
        .finally(() => loadingIndicator.classList.add('hidden'));
};

document.getElementById('login-email-btn').onclick = async () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('password-input').value;
    if (!email || !pass) return alert("Por favor ingresa email y contraseña.");
    loadingIndicator.classList.remove('hidden');
    try { 
        await signInWithEmailAndPassword(auth, email, pass); 
    } catch(e) { 
        alert("Error al entrar: " + e.message); 
    } finally {
        loadingIndicator.classList.add('hidden');
    }
};

document.getElementById('signup-email-btn').onclick = async () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('password-input').value;
    if (!email || !pass) return alert("Por favor ingresa email y contraseña.");
    loadingIndicator.classList.remove('hidden');
    try { 
        await createUserWithEmailAndPassword(auth, email, pass); 
    } catch(e) { 
        alert("Error al registrarte: " + e.message); 
    } finally {
        loadingIndicator.classList.add('hidden');
    }
};
logoutBtn.onclick = () => signOut(auth);



const routes = {
    '/admin/courses': 'admin-courses',
    '/admin/course-detail': 'admin-course-detail',
    '/admin/users': 'admin-users',
    '/teacher/courses': 'teacher-courses',
    '/teacher/course-settings': 'teacher-course-settings',
    '/teacher/course-schedule': 'teacher-course-schedule',
    '/teacher/assignments': 'teacher-assignments',
    '/teacher/announcements': 'teacher-announcements',
    '/student/courses': 'student-courses',
    '/profile': 'profile',
};

window.navigateTo = (url) => {
    history.pushState(null, null, url);
    router();
};

const router = () => {
    if (!currentProfile) return; // Wait for profile before routing
    
    let path = window.location.pathname;
    
    // Redirect root to role default
    if (path === '/') {
        path = `/${currentProfile.role}/courses`;
        history.replaceState(null, null, path);
    }
    
    const sectionId = routes[path] || 'not-found';
    
    document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.remove('hidden');
    }
    
    const activeNav = document.querySelector(`.nav-item[href="${path}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Load data based on path
    if (path === '/admin/courses') loadAdminCourses();
    if (path === '/admin/course-detail') {
        const urlParams = new URLSearchParams(window.location.search);
        loadAdminCourseDetail(urlParams.get('id'));
    }
    if (path === '/admin/users') loadAdminUsers();
    if (path === '/teacher/courses') loadTeacherCourses();
    if (path === '/teacher/assignments') loadTeacherAssignments();
    if (path === '/teacher/announcements') loadTeacherAnnouncements();
    if (path === '/teacher/course-settings') {
        const urlParams = new URLSearchParams(window.location.search);
        loadTeacherCourseSettings(urlParams.get('id'));
    }
    if (path === '/teacher/course-schedule') {
        const urlParams = new URLSearchParams(window.location.search);
        loadTeacherCourseSchedule(urlParams.get('id'));
    }
    if (path === '/student/courses') loadStudentCourses();
    if (path === '/profile') loadProfile();
};

window.addEventListener('popstate', router);

document.body.addEventListener('click', e => {
    if (e.target.matches('[data-link]')) {
        e.preventDefault();
        navigateTo(e.target.getAttribute('href'));
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        authOverlay.classList.add('hidden');
        try {
            let res = await api({ action: 'getProfile' });
            if (!res.data) {
                // Wait briefly for cloud function to create the profile on first login
                await new Promise(r => setTimeout(r, 2000));
                res = await api({ action: 'getProfile' });
            }
            currentProfile = res.data || { role: 'student' };
            userDisplay.innerText = currentProfile.full_name || user.email;
            userRoleLabel.innerText = currentProfile.role;
            
            document.querySelectorAll('.role-nav').forEach(el => el.classList.add('hidden'));
            const nav = document.getElementById(`nav-${currentProfile.role}`);
            if (nav) nav.classList.remove('hidden');
            
            router();
        } catch (e) { console.error(e); }
    } else {
        currentUser = null;
        currentProfile = null;
        authOverlay.classList.remove('hidden');
        document.querySelectorAll('.role-nav, .content-section').forEach(el => el.classList.add('hidden'));
        history.replaceState(null, null, '/');
    }
});

async function loadAdminCourses() {
    const res = await api({ action: 'getAdminCourses' });
    const container = document.getElementById('admin-courses-list');
    container.innerHTML = res.data.map(c => `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="margin-bottom: 5px;">${c.name}</h3>
                <p style="margin: 0; color: #7f8c8d;">${c.github_org}</p>
            </div>
            <button class="secondary" onclick="navigateTo('/admin/course-detail?id=${c.id}')">Ver detalles</button>
        </div>
    `).join('');
}

document.getElementById('create-course-btn').onclick = async () => {
    const name = document.getElementById('course-name').value;
    const org = document.getElementById('course-org').value;
    await api({ action: 'createCourse', payload: { name, github_org: org } });
    loadAdminCourses();
};

async function loadAdminCourseDetail(courseId) {
    if (!courseId) return navigateTo('/admin/courses');
    try {
        const res = await api({ action: 'getAdminCourseDetails', payload: { courseId } });
        const data = res.data;
        document.getElementById('detail-course-name').innerText = data.name;
        document.getElementById('detail-course-org').innerText = data.github_org || 'N/A';
        document.getElementById('detail-course-code').innerText = data.invite_code || '-';
        
        document.getElementById('detail-course-teachers').innerHTML = data.teachers.length ? 
            data.teachers.map(t => `<li>${t.full_name} (${t.email})</li>`).join('') : '<li>Ninguno</li>';
            
        document.getElementById('detail-course-students-count').innerText = data.students.length;
        document.getElementById('detail-course-students').innerHTML = data.students.length ? 
            data.students.map(s => `<li>${s.full_name} (${s.email}) - Matrícula: ${s.matricula_unrn || 'N/A'}</li>`).join('') : '<li>Ninguno</li>';
            
        document.getElementById('detail-course-assignments').innerHTML = data.assignments.length ? 
            data.assignments.map(a => `<li><strong>${a.title}</strong> (Vence: ${new Date(a.due_date).toLocaleDateString()})</li>`).join('') : '<li>Ninguna</li>';
            
    } catch (e) {
        alert("Error cargando detalles del curso: " + e.message);
    }
}

async function loadAdminUsers() {
    const res = await api({ action: 'getAdminUsers' });
    document.getElementById('admin-users-table').innerHTML = res.data.map(u => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0;">${u.full_name || '-'}</td>
            <td>${u.email}</td>
            <td>${u.role}</td>
            <td>${u.matricula_unrn || '-'}</td>
            <td>${u.cohorte || '-'}</td>
        </tr>
    `).join('');
}

async function loadTeacherCourses() {
    document.getElementById('teacher-courses-list').innerHTML = '<p>Cargando tus materias...</p>';
    
    // Fetch stats
    let statsHtml = '';
    try {
        const stats = await api({ action: 'getTeacherDashboardStats' });
        if (stats.data.pendingCorrections > 0) {
            statsHtml = `<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <h4 style="margin: 0; color: #856404;">⚠️ Tenés ${stats.data.pendingCorrections} correcciones pendientes</h4>
                <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #856404;">Revisá la pestaña "Entregas" para sincronizar las notas desde Sheets.</p>
            </div>`;
        }
    } catch(e) { console.error(e); }
    
    const res = await api({ action: 'getTeacherCourses' });
    document.getElementById('teacher-courses-list').innerHTML = res.data.map(c => `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="margin-bottom: 5px;">${c.name}</h3>
                <p style="margin: 0; color: #7f8c8d;"><strong>Código de invitación:</strong> ${c.invite_code || '-'}</p>
            </div>
            <button onclick="navigateTo('/teacher/course-settings?id=${c.id}')">Configurar cursada</button>
        </div>
    `).join('') || '<p>No tenés cursos asignados</p>';
}

let currentCourseSettingsId = null;
let currentCourseSchedules = [];

function renderSchedules() {
    const list = document.getElementById('settings-schedules-list');
    if (currentCourseSchedules.length === 0) {
        list.innerHTML = '<p style="color: #666; font-style: italic;">No agregaste horarios todavía.</p>';
        return;
    }
    list.innerHTML = currentCourseSchedules.map((s, i) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9f9f9; border: 1px solid #eee; margin-bottom: 5px; border-radius: 4px;">
            <span><strong>${s.day}</strong> a las <strong>${s.time}</strong> (${s.type})</span>
            <button class="danger" style="margin: 0; padding: 5px 10px;" onclick="removeSchedule(${i})">X</button>
        </div>
    `).join('');
}

window.removeSchedule = (index) => {
    currentCourseSchedules.splice(index, 1);
    renderSchedules();
};

document.getElementById('add-schedule-btn').onclick = () => {
    const day = document.getElementById('schedule-day').value;
    const time = document.getElementById('schedule-time').value;
    const type = document.getElementById('schedule-type').value;
    if (!time) return alert('Poné una hora válida.');
    currentCourseSchedules.push({ day, time, type });
    renderSchedules();
    document.getElementById('schedule-time').value = '';
};

async function loadTeacherCourseSettings(courseId) {
    if (!courseId) return navigateTo('/teacher/courses');
    currentCourseSettingsId = courseId;
    document.getElementById('teacher-settings-title').innerText = 'Cargando configuración...';
    try {
        const res = await api({ action: 'getCourseSettings', payload: { courseId } });
        const data = res.data;
        document.getElementById('teacher-settings-title').innerText = `Configurar: ${data.name}`;
        document.getElementById('settings-cover-text').value = data.cover_text || '';
        document.getElementById('settings-start-date').value = data.start_date || '';
        document.getElementById('settings-duration').value = data.duration_weeks || '';
        document.getElementById('settings-external-calendars').value = (data.external_calendars || []).join(', ');
        document.getElementById('settings-github-token').value = data.github_token || '';
        
        document.getElementById('export-ics-link').href = `/api/calendar?id=${courseId}`;
        
        currentCourseSchedules = data.schedules || [];
        renderSchedules();
        
        // Fetch other courses for cloning
        const tcRes = await api({ action: 'getTeacherCourses' });
        const cloneSelect = document.getElementById('settings-clone-course-select');
        cloneSelect.innerHTML = '<option value="">Seleccioná una materia...</option>' + 
            tcRes.data.filter(c => c.id !== courseId).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
    } catch (e) {
        alert("Error cargando configuración: " + e.message);
    }
}

async function applyCourseTemplate(data) {
    document.getElementById('settings-cover-text').value = data.cover_text || '';
    if (data.duration_weeks) document.getElementById('settings-duration').value = data.duration_weeks;
    if (data.external_calendars) document.getElementById('settings-external-calendars').value = data.external_calendars.join(', ');
    currentCourseSchedules = data.schedules || [];
    renderSchedules();
    
    const payloadData = {
        cover_text: data.cover_text || '',
        duration_weeks: data.duration_weeks || null,
        external_calendars: data.external_calendars || [],
        github_token: data.github_token || '',
        schedules: currentCourseSchedules
    };
    if (data.class_instances) payloadData.class_instances = data.class_instances;
    
    await api({ action: 'updateCourseSettings', payload: { courseId: currentCourseSettingsId, data: payloadData } });
    alert("¡Planificación importada y guardada con éxito! Podés regenerar las clases para ajustar las fechas.");
}

document.getElementById('clone-course-btn').onclick = async () => {
    const cid = document.getElementById('settings-clone-course-select').value;
    if (!cid) return alert("Seleccioná una materia para clonar.");
    if (!confirm("¿Seguro que querés sobreescribir la configuración actual con la materia seleccionada?")) return;
    try {
        const res = await api({ action: 'getCourseSettings', payload: { courseId: cid } });
        await applyCourseTemplate(res.data);
    } catch (e) { alert("Error al clonar: " + e.message); }
};

document.getElementById('export-json-btn').onclick = async () => {
    try {
        const res = await api({ action: 'getCourseSettings', payload: { courseId: currentCourseSettingsId } });
        const data = {
            cover_text: res.data.cover_text,
            duration_weeks: res.data.duration_weeks,
            external_calendars: res.data.external_calendars,
            schedules: res.data.schedules,
            class_instances: res.data.class_instances
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planificacion_${res.data.name.replace(/\s+/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) { alert("Error al exportar: " + e.message); }
};

document.getElementById('import-json-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm("Esto va a sobreescribir tu planificación actual. ¿Continuar?")) {
        e.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            await applyCourseTemplate(data);
        } catch (err) {
            alert("Error al leer el archivo JSON: " + err.message);
        }
        e.target.value = '';
    };
    reader.readAsText(file);
};


document.getElementById('save-course-settings-btn').onclick = async () => {
    const btn = document.getElementById('save-course-settings-btn');
    btn.disabled = true;
    btn.innerText = "Guardando...";
    try {
        const payload = {
            courseId: currentCourseSettingsId,
            data: {
                cover_text: document.getElementById('settings-cover-text').value,
                start_date: document.getElementById('settings-start-date').value,
                duration_weeks: parseInt(document.getElementById('settings-duration').value) || 0,
                external_calendars: document.getElementById('settings-external-calendars').value.split(',').map(s => s.trim()).filter(s => s),
                github_token: document.getElementById('settings-github-token').value,
                schedules: currentCourseSchedules
            }
        };
        await api({ action: 'updateCourseSettings', payload });
        const status = document.getElementById('settings-save-status');
        status.style.display = 'block';
        setTimeout(() => status.style.display = 'none', 3000);
    } catch (e) {
        alert("Error al guardar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Configuración de la Cursada";
    }
};

document.getElementById('manage-schedule-btn').onclick = () => {
    navigateTo('/teacher/course-schedule?id=' + currentCourseSettingsId);
};

let currentClassInstances = [];
let scheduleCourseData = null;

async function loadTeacherCourseSchedule(courseId) {
    if (!courseId) return navigateTo('/teacher/courses');
    document.getElementById('teacher-schedule-title').innerText = 'Cargando...';
    try {
        const res = await api({ action: 'getCourseSettings', payload: { courseId } });
        scheduleCourseData = res.data;
        document.getElementById('teacher-schedule-title').innerText = `Cronograma: ${scheduleCourseData.name}`;
        
        currentClassInstances = scheduleCourseData.class_instances || [];
        if (currentClassInstances.length === 0) {
            generateClassInstances();
        } else {
            renderScheduleClasses();
        }
    } catch (e) {
        alert("Error cargando cronograma: " + e.message);
    }
}

function generateClassInstances() {
    if (!scheduleCourseData.start_date || !scheduleCourseData.duration_weeks || !scheduleCourseData.schedules || scheduleCourseData.schedules.length === 0) {
        alert("Primero tenés que configurar la fecha de inicio, duración y horarios en la vista anterior.");
        return navigateTo('/teacher/course-settings?id=' + scheduleCourseData.id);
    }
    
    currentClassInstances = [];
    const [y, m, d] = scheduleCourseData.start_date.split('-').map(Number);
    const baseDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    
    const dayMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
    
    let generatedClasses = [];
    scheduleCourseData.schedules.forEach(sch => {
        const targetDay = dayMap[sch.day];
        if (targetDay === undefined) return;
        
        let currentDay = baseDate.getUTCDay();
        let diff = targetDay - currentDay;
        if (diff < 0) diff += 7;
        
        const firstClassDate = new Date(baseDate.getTime() + diff * 86400000);
        const [hh, mm] = (sch.time || "00:00").split(':').map(Number);
        firstClassDate.setUTCHours(hh, mm, 0);
        
        for (let i = 0; i < scheduleCourseData.duration_weeks; i++) {
            const classDate = new Date(firstClassDate.getTime() + i * 7 * 86400000);
            generatedClasses.push({
                date: classDate.toISOString(),
                type: sch.type,
                topic: "",
                presentation_url: "",
                recording_url: "",
                special_status: "Normal"
            });
        }
    });
    
    generatedClasses.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const oldInstances = currentClassInstances || [];
    generatedClasses.forEach((ci, idx) => {
        if (oldInstances[idx]) {
            ci.topic = oldInstances[idx].topic || "";
            ci.presentation_url = oldInstances[idx].presentation_url || "";
            ci.recording_url = oldInstances[idx].recording_url || "";
            ci.special_status = oldInstances[idx].special_status || "Normal";
            ci.description = oldInstances[idx].description || "";
        }
    });
    
    currentClassInstances = generatedClasses;
    renderScheduleClasses();
}

document.getElementById('generate-schedule-btn').onclick = () => {
    if (confirm("¿Seguro querés regenerar? Vas a perder los temas, links y estados especiales cargados.")) {
        generateClassInstances();
    }
};

function renderScheduleClasses() {
    const list = document.getElementById('schedule-classes-list');
    if (currentClassInstances.length === 0) {
        list.innerHTML = '<p>No hay clases generadas.</p>';
        return;
    }
    
    list.innerHTML = currentClassInstances.map((ci, idx) => {
        const d = new Date(ci.date);
        const dateStr = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
        const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        
        return `
        <div class="card" style="display: flex; flex-direction: column; gap: 10px; ${ci.special_status === 'Feriado' ? 'opacity: 0.6; background: #eee;' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <h3 style="margin: 0; text-transform: capitalize;">Clase ${idx + 1}: ${dateStr} - ${timeStr} (${ci.type})</h3>
                <select id="ci-status-${idx}" onchange="updateClassInstance(${idx}, 'special_status', this.value)">
                    <option value="Normal" ${ci.special_status === 'Normal' ? 'selected' : ''}>Normal</option>
                    <option value="Clase Remota" ${ci.special_status === 'Clase Remota' ? 'selected' : ''}>Clase Remota</option>
                    <option value="Examen" ${ci.special_status === 'Examen' ? 'selected' : ''}>Examen</option>
                    <option value="Feriado" ${ci.special_status === 'Feriado' ? 'selected' : ''}>Feriado / Sin Clase</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 5px;">
                <div style="flex: 1; min-width: 250px;">
                    <label style="font-weight: bold; font-size: 0.9em; color: #555;">Tema de la clase</label>
                    <input type="text" id="ci-topic-${idx}" value="${ci.topic || ''}" onchange="updateClassInstance(${idx}, 'topic', this.value)" placeholder="Ej: Unidad 1: Introducción a la materia">
                </div>
                <div style="flex: 2; min-width: 100%; margin-top: 10px;">
                    <label style="font-weight: bold; font-size: 0.9em; color: #555;">Descripción / Temario (Soporta Markdown)</label>
                    <textarea id="ci-desc-${idx}" onchange="updateClassInstance(${idx}, 'description', this.value)" placeholder="Ej: - Variables\n- Funciones\n- Bucles" style="width: 100%; height: 60px; margin-top: 5px; font-family: monospace;">${ci.description || ''}</textarea>
                </div>
            </div>
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px;">
                    <label style="font-weight: bold; font-size: 0.9em; color: #555;">Enlace a Presentación / Material</label>
                    <input type="url" id="ci-pres-${idx}" value="${ci.presentation_url || ''}" onchange="updateClassInstance(${idx}, 'presentation_url', this.value)" placeholder="https://docs.google.com/presentation/d/... ">
                </div>
                <div style="flex: 1; min-width: 250px;">
                    <label style="font-weight: bold; font-size: 0.9em; color: #555;">Enlace a Grabación de la clase</label>
                    <input type="url" id="ci-rec-${idx}" value="${ci.recording_url || ''}" onchange="updateClassInstance(${idx}, 'recording_url', this.value)" placeholder="https://youtube.com/...">
                </div>
            </div>
        </div>
        `;
    }).join('');
}

window.updateClassInstance = (idx, field, value) => {
    currentClassInstances[idx][field] = value;
    if (field === 'special_status') renderScheduleClasses();
};

document.getElementById('save-schedule-btn').onclick = async () => {
    const btn = document.getElementById('save-schedule-btn');
    btn.disabled = true;
    btn.innerText = "Guardando...";
    try {
        await api({ action: 'updateCourseSettings', payload: {
            courseId: scheduleCourseData.id,
            data: { class_instances: currentClassInstances }
        }});
        const status = document.getElementById('schedule-save-status');
        status.style.display = 'block';
        setTimeout(() => status.style.display = 'none', 3000);
    } catch (e) {
        alert("Error al guardar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Cronograma Completo";
    }
};

async function loadStudentCourses() {
    const container = document.getElementById('student-courses-list');
    container.innerHTML = '<p>Cargando tu cursada...</p>';
    
    try {
        const res = await api({ action: 'getStudentCourses' });
        
        let assignments = [];
        let submissions = [];
        if (res.data && res.data.length > 0) {
            const courseIds = res.data.map(c => c.id);
            const assignRes = await api({ action: 'getStudentAssignments', payload: { courseIds } });
            assignments = assignRes.data.assignments || [];
            submissions = assignRes.data.submissions || [];
        }
        
        document.getElementById('enroll-btn').onclick = async () => {
        const code = document.getElementById('enroll-code').value;
        if (!code) return;
        try {
            await api({ action: 'enrollCourse', payload: { code: code.toUpperCase() } });
            document.getElementById('enroll-code').value = '';
            loadStudentCourses();
        } catch (e) {
            alert("Uy, error al enrolarte: " + e.message);
        }
    };
    
    
window.addCollaborator = async (submissionId, assignmentId) => {
    const email = prompt("Ingresá el correo electrónico del compañero que querés agregar al repositorio de este grupo:");
    if (!email) return;
    
    try {
        await api({ action: 'addGroupCollaborator', payload: { submissionId, assignmentId, email } });
        alert("¡Compañero agregado con éxito al repositorio!");
    } catch(e) {
        alert("Error: " + e.message);
    }
};

window.acceptAssignment = async (assignmentId, isGroup) => {
        let groupName = '';
        if (isGroup) {
            groupName = prompt('Esta es una tarea grupal. Ingresá el nombre de tu equipo (se usará para el nombre del repositorio, no uses espacios ni caracteres raros):');
            if (!groupName) return; // Cancelled
        }
        const btn = document.getElementById(`btn-accept-${assignmentId}`);
        const status = document.getElementById(`status-accept-${assignmentId}`);
        btn.disabled = true;
        btn.innerText = "Creando repositorio... esto tarda unos segundos";
        status.innerText = "Conectando con GitHub...";
        status.style.color = "#e67e22";
        
        try {
            const res = await api({ action: 'acceptAssignment', payload: { assignmentId, groupName } });
            status.innerText = "¡Repositorio creado con éxito!";
            status.style.color = "#27ae60";
            setTimeout(() => {
                loadStudentCourses();
            }, 1000);
        } catch (e) {
            btn.disabled = false;
            btn.innerText = "Aceptar Tarea en GitHub";
            status.innerText = "Error: " + e.message;
            status.style.color = "#c0392b";
            
            if (e.message.includes('perfil académico')) {
                setTimeout(() => window.location.search = '?path=/student/profile', 2000);
            }
        }
    };
    
    if (!res.data || res.data.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                <h2>No estás anotado en ninguna cursada todavía</h2>
                <p>Usá el recuadro de arriba para ingresar el código de tu materia.</p>
            </div>
        `;
    } else {
        const now = new Date();
        now.setHours(0,0,0,0);
        
        
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

            const classInstances = (c.class_instances || []).map((ci, idx) => ({ ...ci, classNumber: idx + 1 }));
            const upcoming = classInstances.filter(ci => new Date(ci.date) >= now).slice(0, 3);
            
            let classesHtml = '<p style="color: #666; font-style: italic;">Todavía no hay clases planificadas en el cronograma.</p>';
            
            if (classInstances.length > 0) {
                classesHtml = `
                    <h4 style="margin-top: 15px; margin-bottom: 5px; color: #2c3e50;">Próximas Clases:</h4>
                    <ul style="padding-left: 20px; color: #444; list-style-type: none;">
                        ${upcoming.length ? upcoming.map(ci => {
                            const d = new Date(ci.date);
                            const ds = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
                            const ts = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                            
                            let tags = '';
                            if (ci.special_status === 'Examen') tags += '<span style="background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">EXAMEN</span>';
                            if (ci.special_status === 'Clase Remota') tags += '<span style="background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">REMOTA</span>';
                            if (ci.special_status === 'Feriado') tags += '<span style="background: #95a5a6; color: white; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">FERIADO / CANCELADA</span>';
                            
                            let links = [];
                            if (ci.presentation_url) links.push(`<a href="${ci.presentation_url}" target="_blank" style="color: #3498db; text-decoration: underline;">Material</a>`);
                            if (ci.recording_url) links.push(`<a href="${ci.recording_url}" target="_blank" style="color: #3498db; text-decoration: underline;">Grabación</a>`);
                            const linksStr = links.length ? ` - [ ${links.join(' | ')} ]` : '';
                            
                            const topicHtml = typeof marked !== 'undefined' ? marked.parseInline(ci.topic || ci.type) : (ci.topic || ci.type);
                            const descHtml = (ci.description && typeof marked !== 'undefined') ? `<div style="font-size: 0.9em; color: #555; background: #fff; padding: 10px; margin-top: 5px; border-left: 3px solid #ccc; border-radius: 4px;" class="markdown-body">${marked.parse(ci.description)}</div>` : '';
                            
                            return `<li style="margin-bottom: 15px; background: #fdfdfd; border: 1px solid #eee; padding: 10px; border-radius: 4px; ${ci.special_status === 'Feriado' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                                <strong>Clase ${ci.classNumber} (${ds} ${ts})</strong>: ${topicHtml} ${tags} ${linksStr}
                                ${descHtml}
                            </li>`;
                        }).join('') : '<li>No hay clases futuras planificadas.</li>'}
                    </ul>
                    <details style="margin-top: 10px;">
                        <summary style="cursor: pointer; color: #3498db; font-weight: bold;">Ver todo el cronograma (${classInstances.length} clases)</summary>
                        <div style="padding: 10px; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px; margin-top: 10px; max-height: 250px; overflow-y: auto;">
                            <ul style="padding-left: 20px; font-size: 0.9em; color: #555; margin: 0; list-style-type: none;">
                                ${classInstances.map(ci => {
                                    const d = new Date(ci.date);
                                    const ds = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
                                    let tags = ci.special_status !== 'Normal' ? ` <em>(${ci.special_status})</em>` : '';
                                    const topicHtml = typeof marked !== 'undefined' ? marked.parseInline(ci.topic || ci.type) : (ci.topic || ci.type);
                                    return `<li style="margin-bottom: 5px;"><strong>Clase ${ci.classNumber} (${ds}):</strong> ${topicHtml} ${tags}</li>`;
                                }).join('')}
                            </ul>
                        </div>
                    </details>
                `;
            }
            
            const courseAssignments = assignments.filter(a => a.course_id === c.id);
            let assignmentsHtml = '';
            if (courseAssignments.length > 0) {
                assignmentsHtml = `
                    <h4 style="margin-top: 25px; margin-bottom: 10px; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 5px;">Tareas y Entregas</h4>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        ${courseAssignments.map(a => {
                            const sub = submissions.find(s => s.assignment_id === a.id);
                            
                            if (sub) {
                                return `
                                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px;">
                                        <h5 style="margin: 0 0 5px 0; color: #166534; font-size: 1.1em;">✅ ${a.title}</h5>
                                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                            <a href="${sub.repo_url}" target="_blank" style="color: #15803d; text-decoration: none; font-weight: bold;">Ver tu repositorio en GitHub ↗</a>
                                            <div style="background: white; padding: 5px 10px; border-radius: 4px; border: 1px solid #dcfce7; font-size: 0.9em;">
                                                <strong>Nota:</strong> ${sub.grade ? sub.grade : '<span style="color: #999;">Sin calificar</span>'}
                                                ${sub.feedback ? `<br><strong>Feedback:</strong> ${sub.feedback}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div style="background: #fff; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                                        <h5 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.1em;">⏳ ${a.title}</h5>
                                        <p style="font-size: 0.9em; color: #64748b; margin-top: 0;">Todavía no aceptaste esta tarea. Al aceptarla se creará tu repositorio en GitHub para que empieces a trabajar.</p>
                                        <button onclick="acceptAssignment('${a.id}')" style="margin: 0; background: #3498db; padding: 8px 15px; font-size: 0.9em; border: none; font-weight: bold;" id="btn-accept-${a.id}">Aceptar Tarea en GitHub</button>
                                        <p id="status-accept-${a.id}" style="margin: 5px 0 0 0; font-size: 0.85em; font-weight: bold;"></p>
                                    </div>
                                `;
                            }
                        }).join('')}
                    </div>
                `;
            }
            
            return `
            <div class="card" style="border-top: 4px solid #8e44ad; position: relative;">
                <h2 style="color: #8e44ad; margin-bottom: 5px;">${c.name}</h2>
                <p style="color: #7f8c8d; margin-top: 0;">${c.github_org || ''}</p>
                
                ${c.cover_text ? `<p style="background: #fdfbf7; padding: 15px; border-left: 3px solid #f1c40f; font-style: italic; white-space: pre-line;">${c.cover_text}</p>` : ''}
                
                <div style="margin-top: 15px; margin-bottom: 15px;">
                    <a href="/api/calendar?id=${c.id}" target="_blank" style="display: inline-block; padding: 8px 12px; background: #9b59b6; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em; font-weight: bold;">
                        📅 Suscribirse al Calendario (Google/Apple)
                    </a>
                </div>
                
                ${classesHtml}
                ${assignmentsHtml}
            </div>
            `;
        }).join('');
    }
    } catch(e) {
        container.innerHTML = `<p style="color: red;">Error: ${e.message}</p>`;
    }
}

function loadProfile() {
    if (!currentProfile) return;
    document.getElementById('profile-matricula').value = currentProfile.matricula_unrn || '';
    document.getElementById('profile-cohorte').value = currentProfile.cohorte || '';
}

document.getElementById('save-profile-btn').onclick = async () => {
    const btn = document.getElementById('save-profile-btn');
    btn.disabled = true;
    btn.innerText = "Guardando...";
    
    const matricula_unrn = document.getElementById('profile-matricula').value;
    const cohorteText = document.getElementById('profile-cohorte').value;
    const cohorte = cohorteText ? parseInt(cohorteText, 10) : null;
    
    try {
        await api({ action: 'updateProfile', payload: { matricula_unrn, cohorte } });
        currentProfile.matricula_unrn = matricula_unrn;
        currentProfile.cohorte = cohorte;
        
        const status = document.getElementById('profile-save-status');
        status.style.display = 'block';
        setTimeout(() => status.style.display = 'none', 3000);
    } catch (e) {
        alert("Error al guardar tu perfil: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardá tu Perfil";
    }
};

async function loadTeacherAssignments() {
    const list = document.getElementById('teacher-assignments-list');
    list.innerHTML = '<p>Cargando tareas...</p>';
    
    try {
        const cRes = await api({ action: 'getTeacherCourses' });
        const select = document.getElementById('assignment-course-select');
        select.innerHTML = cRes.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        const res = await api({ action: 'getTeacherAssignments' });
        
        if (res.data.length === 0) {
            list.innerHTML = '<p style="color: #666; font-style: italic;">Todavía no creaste ninguna tarea.</p>';
            return;
        }
        
        list.innerHTML = res.data.map(a => {
            const cName = cRes.data.find(c => c.id === a.course_id)?.name || 'Materia Desconocida';
            return `
                <div class="card" style="border-left: 4px solid #8e44ad; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #8e44ad;">${a.title} <span style="font-size: 0.7em; color: #7f8c8d; font-weight: normal;">en ${cName}</span>${a.is_group ? ' <span style="font-size: 0.7em; background: #3498db; color: white; padding: 2px 5px; border-radius: 4px;">GRUPAL</span>' : ''}</h3>
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button onclick="editAssignment('${a.id}', '${a.title.replace(/'/g, "\'")}', '${a.template_repo}', ${a.create_feedback_pr || false}, ${a.is_group || false})" style="background: #f39c12; border: none; padding: 5px 10px; font-size: 0.8em; margin: 0;">✏️ Editar Tarea</button>
                        <button onclick="archiveAssignment('${a.id}')" style="background: #c0392b; border: none; padding: 5px 10px; font-size: 0.8em; margin: 0;" id="btn-archive-${a.id}">🔒 Archivar (Solo Lectura)</button>
                    </div>
                    
                    
                    
                    <div style="background: #fdfdfd; padding: 15px; border: 1px solid #eee; border-radius: 4px; margin-top: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: #2c3e50;">📊 Sincronización Inversa (Google Sheets)</h4>
                            <button onclick="downloadTemplate('${a.id}', '${a.course_id}', '${a.title.replace(/'/g, "\'")}')" style="margin: 0; background: #27ae60; border: none; font-size: 0.8em; padding: 5px 10px;">⬇️ Descargar Plantilla</button>
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

                        
                        <div style="display: flex; gap: 10px;">
                            <button onclick="downloadTemplate('${a.id}', '${a.course_id}', '${a.title}')" style="margin: 0; background: #27ae60; border: none;">⬇️ Descargar Plantilla de Alumnos (CSV)</button>
                            <button onclick="syncGrades('${a.id}')" style="margin: 0; background: #2980b9; border: none;">🔄 Sincronizar Notas Ahora</button>
                        </div>
                        <p id="sync-status-${a.id}" style="margin-top: 10px; font-weight: bold; font-size: 0.9em; margin-bottom: 0;"></p>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        list.innerHTML = `<p style="color: red;">Error: ${e.message}</p>`;
    }
}

document.getElementById('create-assignment-btn').onclick = async () => {
    const courseId = document.getElementById('assignment-course-select').value;
    const title = document.getElementById('assignment-title').value;
    const template = document.getElementById('assignment-template').value;
    const createPr = document.getElementById('assignment-pr').checked;
    const isGroup = document.getElementById('assignment-group') ? document.getElementById('assignment-group').checked : false;
    
    if (!title) return alert("Escribí un título para la tarea");
    if (!template) return alert("Escribí el repositorio de plantilla (ej: org/repo)");
    
    document.getElementById('create-assignment-btn').disabled = true;
    
    if (window.editingAssignmentId) {
        try {
            await api({ action: 'updateAssignment', payload: { assignmentId: window.editingAssignmentId, data: { title, template_repo: template, create_feedback_pr: createPr, is_group: isGroup } } });
            window.editingAssignmentId = null;
            document.getElementById('create-assignment-btn').innerText = 'Crear Tarea';
        } catch(e) {
            alert("Error al editar tarea: " + e.message);
        }
    } else {
        try {
            await api({ action: 'createAssignment', payload: { course_id: courseId, title, template_repo: template, create_feedback_pr: createPr, is_group: isGroup } });
        } catch (e) {
            alert("Error al crear tarea: " + e.message);
        }
    }
    
    document.getElementById('assignment-title').value = '';
    document.getElementById('assignment-template').value = '';
    loadTeacherAssignments();
    document.getElementById('create-assignment-btn').disabled = false;
};



window.editAssignment = (id, title, template, createPr, isGroup) => {
    window.editingAssignmentId = id;
    document.getElementById('assignment-title').value = title;
    document.getElementById('assignment-template').value = template;
    document.getElementById('assignment-pr').checked = createPr;
    if(document.getElementById('assignment-group')) document.getElementById('assignment-group').checked = isGroup;
    
    document.getElementById('create-assignment-btn').innerText = 'Guardar Cambios';
    document.getElementById('assignment-title').focus();
};

window.archiveAssignment = async (id) => {
    if (!confirm("¿Seguro que querés archivar esta tarea? Esto cambiará los permisos de todos los alumnos en GitHub a SOLO LECTURA. No podrán subir más código.")) return;
    
    const btn = document.getElementById(`btn-archive-${id}`);
    btn.disabled = true;
    btn.innerText = "Archivando...";
    
    try {
        const res = await api({ action: 'archiveAssignment', payload: { assignmentId: id } });
        alert(`¡Tarea archivada! Se cambiaron los permisos en ${res.data.count} repositorios.`);
        btn.innerText = "🔒 Archivada";
    } catch(e) {
        alert("Error al archivar: " + e.message);
        btn.disabled = false;
        btn.innerText = "🔒 Archivar (Solo Lectura)";
    }
};





window.downloadTemplate = async (assignmentId, courseId, title) => {
    try {
        const res = await api({ action: 'getCourseRoster', payload: { courseId } });
        if (res.data.length === 0) return alert("No hay alumnos inscriptos en esta materia todavía.");
        
        let csv = "Matricula,Email,Usuario_Github,Nota,Feedback\n";
        res.data.forEach(p => {
            csv += `"${p.matricula_unrn || ''}","${p.email || ''}","${p.github_user || ''}","",""\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plantilla_notas_${title.replace(/\\s+/g, '_')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("Error al generar plantilla: " + e.message);
    }
};



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

