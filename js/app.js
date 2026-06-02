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
                schedules: currentCourseSchedules
            }
        };
        await api({ action: 'updateCourseSettings', payload });
        const status = document.getElementById('settings-save-status');
        status.style.display = 'block';
        setTimeout(() => status.style.display = 'none', 3000);
    } catch (e) {
        alert("Uy, error al guardar: " + e.message);
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
                <h3 style="margin: 0; text-transform: capitalize;">${dateStr} - ${timeStr} (${ci.type})</h3>
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
    const res = await api({ action: 'getStudentCourses' });
    const container = document.getElementById('student-courses-list');
    
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
        
        container.innerHTML = res.data.map(c => {
            const classInstances = c.class_instances || [];
            const upcoming = classInstances.filter(ci => new Date(ci.date) >= now).slice(0, 3);
            
            let classesHtml = '<p style="color: #666; font-style: italic;">Todavía no hay clases planificadas en el cronograma.</p>';
            
            if (classInstances.length > 0) {
                classesHtml = `
                    <h4 style="margin-top: 15px; margin-bottom: 5px; color: #2c3e50;">Próximas Clases:</h4>
                    <ul style="padding-left: 20px; color: #444;">
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
                            
                            return `<li style="margin-bottom: 5px; ${ci.special_status === 'Feriado' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                                <strong>${ds} ${ts}</strong>: ${ci.topic || ci.type} ${tags} ${linksStr}
                            </li>`;
                        }).join('') : '<li>No hay clases futuras planificadas.</li>'}
                    </ul>
                    <details style="margin-top: 10px;">
                        <summary style="cursor: pointer; color: #3498db; font-weight: bold;">Ver todo el cronograma (${classInstances.length} clases)</summary>
                        <div style="padding: 10px; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px; margin-top: 10px; max-height: 200px; overflow-y: auto;">
                            <ul style="padding-left: 20px; font-size: 0.9em; color: #555; margin: 0;">
                                ${classInstances.map(ci => {
                                    const d = new Date(ci.date);
                                    const ds = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
                                    let tags = ci.special_status !== 'Normal' ? ` <em>(${ci.special_status})</em>` : '';
                                    return `<li>${ds}: ${ci.topic || ci.type}${tags}</li>`;
                                }).join('')}
                            </ul>
                        </div>
                    </details>
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
            </div>
            `;
        }).join('');
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
                    <h3 style="margin-top: 0; color: #8e44ad;">${a.title} <span style="font-size: 0.7em; color: #7f8c8d; font-weight: normal;">en ${cName}</span></h3>
                    
                    <div style="background: #fdfdfd; padding: 15px; border: 1px solid #eee; border-radius: 4px; margin-top: 15px;">
                        <h4 style="margin-top: 0; color: #2c3e50;">📊 Carga de Notas Automática (desde Google Sheets)</h4>
                        <p style="font-size: 0.9em; color: #555;">Pegá acá el link de tu planilla de corrección. Asegurate de que el permiso esté en "Cualquier persona con el enlace puede leer".</p>
                        
                        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 15px;">
                            <input type="url" id="sheet-url-${a.id}" value="${a.grades_spreadsheet_url || ''}" placeholder="https://docs.google.com/spreadsheets/d/..." style="flex: 1; margin: 0; font-size: 0.9em;">
                            <button class="secondary" onclick="saveSheetUrl('${a.id}')" style="margin: 0; padding: 10px;">Guardar Link</button>
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
    if (!title) return alert("Escribí un título para la tarea");
    
    document.getElementById('create-assignment-btn').disabled = true;
    try {
        await api({ action: 'createAssignment', payload: { course_id: courseId, title } });
        document.getElementById('assignment-title').value = '';
        loadTeacherAssignments();
    } catch (e) {
        alert("Error al crear tarea: " + e.message);
    } finally {
        document.getElementById('create-assignment-btn').disabled = false;
    }
};

window.saveSheetUrl = async (assignmentId) => {
    const url = document.getElementById(`sheet-url-${assignmentId}`).value;
    try {
        await api({ action: 'updateAssignment', payload: { assignmentId, data: { grades_spreadsheet_url: url } } });
        alert("¡Link guardado exitosamente!");
    } catch (e) {
        alert("Error al guardar: " + e.message);
    }
};

window.syncGrades = async (assignmentId) => {
    const url = document.getElementById(`sheet-url-${assignmentId}`).value;
    if (!url) return alert("Primero pegá el link de la planilla y guardalo.");
    
    const status = document.getElementById(`sync-status-${assignmentId}`);
    status.style.color = '#e67e22';
    status.innerText = "Sincronizando notas... (esto puede tardar unos segundos)";
    
    try {
        const res = await api({ action: 'syncGradesFromSpreadsheet', payload: { assignmentId, sheetUrl: url } });
        status.style.color = '#27ae60';
        status.innerText = `¡Éxito! Se actualizaron o cargaron las notas de ${res.data.updatedCount} alumnos.`;
    } catch (e) {
        status.style.color = '#c0392b';
        status.innerText = "Error: " + e.message;
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

