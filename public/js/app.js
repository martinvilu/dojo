import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, GithubAuthProvider, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, linkWithCredential, linkWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
const apiCache = {};
const api = async (data) => {
    const isGet = data.action && data.action.startsWith('get');
    const cacheKey = isGet ? JSON.stringify(data) : null;
    
    if (!isGet) {
        // Invalidate cache on mutations
        Object.keys(apiCache).forEach(k => delete apiCache[k]);
    } else if (apiCache[cacheKey]) {
        return apiCache[cacheKey];
    }
    
    return withLoading(async () => {
        const result = await _api(data);
        if (cacheKey) apiCache[cacheKey] = result;
        return result;
    });
};

window.downloadIcsFile = (courseName, instances) => {
    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Jutsu Classroom//ES',
        'CALSCALE:GREGORIAN',
        `X-WR-CALNAME:${courseName}`
    ];
    instances.forEach((ci, idx) => {
        if (ci.special_status === 'Feriado') return;
        const d = new Date(ci.date);
        const dEnd = new Date(d.getTime() + 2 * 60 * 60 * 1000);
        const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        ics.push('BEGIN:VEVENT');
        ics.push(`UID:${ci.id || idx}@jutsu.com`);
        ics.push(`DTSTAMP:${formatDate(new Date())}`);
        ics.push(`DTSTART:${formatDate(d)}`);
        ics.push(`DTEND:${formatDate(dEnd)}`);
        ics.push(`SUMMARY:${ci.topic || ci.type}`);
        ics.push(`DESCRIPTION:Clase ${idx+1}. ${ci.description ? ci.description.replace(/\\n/g, '\\\\n') : ''}`);
        if (ci.meet_url) ics.push(`LOCATION:${ci.meet_url}`);
        ics.push('END:VEVENT');
    });
    ics.push('END:VCALENDAR');
    const blob = new Blob([ics.join('\\r\\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendario-${courseName.replace(/\\s+/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
};

let currentUser = null;
let currentProfile = null;

const logoutBtn = document.getElementById('logout-btn');
const authOverlay = document.getElementById('auth-overlay');
const userDisplay = document.getElementById('user-display');
const userRoleLabel = document.getElementById('user-role');


async function handleAuthError(e, pendingProvider) {
    if (e.code === 'auth/account-exists-with-different-credential') {
        const email = e.customData.email;
        let pendingCred;
        if (pendingProvider === 'github.com') {
            pendingCred = GithubAuthProvider.credentialFromError(e);
        } else if (pendingProvider === 'google.com') {
            pendingCred = GoogleAuthProvider.credentialFromError(e);
        }
        
        try {
            let methods = await fetchSignInMethodsForEmail(auth, email);
            
            // If email enumeration protection is on, methods might be empty. Fallback to trying Google first, then Github.
            if (!methods || methods.length === 0) {
                const isGoogle = confirm(`El email ${email} ya está registrado con otro método (seguramente Google). ¿Querés iniciar sesión con Google para vincular tu cuenta?`);
                if (isGoogle) methods = ['google.com'];
                else methods = ['github.com'];
            }

            if (methods.length > 0) {
                const providerToUse = methods[0];
                let providerObj;
                let providerName = '';
                
                if (providerToUse === 'google.com') {
                    providerObj = new GoogleAuthProvider();
                    providerName = 'Google';
                } else if (providerToUse === 'github.com') {
                    providerObj = new GithubAuthProvider();
                    providerName = 'GitHub';
                } else {
                    alert('El email ya está registrado con contraseña. Iniciá sesión con email y contraseña, y luego vinculá la cuenta.');
                    return;
                }
                
                alert(`Iniciá sesión con ${providerName} ahora para confirmar que sos el dueño y vincular la cuenta.`);
                
                const result = await signInWithPopup(auth, providerObj);
                await linkWithCredential(result.user, pendingCred);
                alert("¡Cuentas vinculadas exitosamente! Ya podés usar cualquiera de las dos para entrar.");
            }
        } catch (linkError) {
            alert("Error al vincular cuentas: " + linkError.message);
        }
    } else {
        alert("Falló el inicio de sesión: " + e.message);
    }
}

document.getElementById('login-github-btn').onclick = () => {
    loadingIndicator.classList.remove('hidden');
    signInWithPopup(auth, new GithubAuthProvider())
        .catch(e => handleAuthError(e, 'github.com'))
        .finally(() => loadingIndicator.classList.add('hidden'));
};

document.getElementById('login-google-btn').onclick = () => {
    loadingIndicator.classList.remove('hidden');
    signInWithPopup(auth, new GoogleAuthProvider())
        .catch(e => handleAuthError(e, 'google.com'))
        .finally(() => loadingIndicator.classList.add('hidden'));
};


document.getElementById('login-email-btn').onclick = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('password-input').value;
    if (!email || !pass) return alert("Por favor ingresa email y contraseña.");
    loadingIndicator.classList.remove('hidden');
    try { 
        await signInWithEmailAndPassword(auth, email, pass); 
    } catch(err) { 
        alert("Error al entrar: " + err.message); 
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
document.getElementById('logout-pending-btn').onclick = () => signOut(auth);

document.getElementById('submit-matricula-btn').onclick = async () => {
    const matricula = document.getElementById('matricula-input').value.trim();
    const errorEl = document.getElementById('matricula-error');
    if (!/^UNRN-\d{5,}$/.test(matricula)) {
        errorEl.style.display = 'block';
        return;
    }
    errorEl.style.display = 'none';
    
    try {
        await api({ action: 'submitMatricula', payload: { matricula } });
        alert("¡Matrícula guardada! Tu cuenta ha sido aprobada.");
        window.location.reload();
    } catch(e) {
        alert("Error: " + e.message);
    }
};

window.approveUser = async (uid) => {
    if (!confirm("¿Aprobar manualmente a este usuario?")) return;
    try {
        await api({ action: 'approveUser', payload: { targetUid: uid } });
        alert("Usuario aprobado.");
        loadAdminUsers();
    } catch(e) {
        alert("Error: " + e.message);
    }
};

document.getElementById('logout-pending-btn').onclick = () => signOut(auth);

document.getElementById('submit-matricula-btn').onclick = async () => {
    const matricula = document.getElementById('matricula-input').value.trim();
    const errorEl = document.getElementById('matricula-error');
    if (!/^UNRN-\d{5,}$/.test(matricula)) {
        errorEl.style.display = 'block';
        return;
    }
    errorEl.style.display = 'none';
    
    try {
        await api({ action: 'submitMatricula', payload: { matricula } });
        alert("¡Matrícula guardada! Tu cuenta ha sido aprobada.");
        window.location.reload();
    } catch(e) {
        alert("Error: " + e.message);
    }
};

window.approveUser = async (uid) => {
    if (!confirm("¿Aprobar manualmente a este usuario?")) return;
    try {
        await api({ action: 'approveUser', payload: { targetUid: uid } });
        alert("Usuario aprobado.");
        loadAdminUsers();
    } catch(e) {
        alert("Error: " + e.message);
    }
};




const routes = {
    '/admin/catedras': 'admin-courses',
    '/admin/catedras/detalle': 'admin-course-detail',
    '/admin/usuarios': 'admin-users',
    '/admin/configuracion': 'admin-settings',
    '/docente/catedras': 'teacher-courses',
    '/docente/catedras/configuracion': 'teacher-course-settings',
    '/docente/catedras/clases': 'teacher-course-schedule',
    '/docente/catedras/dashboard': 'teacher-course-dashboard',
    '/docente/tareas': 'teacher-assignments',
    '/docente/avisos': 'teacher-announcements',
    '/estudiante/catedras': 'student-courses',
    '/estudiante/catedras/clases': 'student-course-schedule-view',
    '/estudiante/tareas': 'student-assignments',
    '/estudiante/notificaciones': 'student-notifications',
    '/perfil': 'profile',
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
        const rolePaths = {
            'student': '/estudiante/catedras',
            'teacher': '/docente/catedras',
            'admin': '/admin/catedras'
        };
        path = rolePaths[currentProfile.role] || '/estudiante/catedras';
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
    if (path === '/admin/catedras') loadAdminCourses();
    if (path === '/admin/catedras/detalle') {
        const urlParams = new URLSearchParams(window.location.search);
        loadAdminCourseDetail(urlParams.get('id'));
    }
    if (path === '/admin/usuarios') loadAdminUsers();
    if (path === '/admin/configuracion') loadAdminSettings();
    if (path === '/docente/catedras') loadTeacherCourses();
    if (path === '/docente/catedras/configuracion') {
        const urlParams = new URLSearchParams(window.location.search);
        loadTeacherCourseSettings(urlParams.get('id'));
    }
    if (path === '/docente/catedras/clases') {
        const urlParams = new URLSearchParams(window.location.search);
        loadTeacherCourseSchedule(urlParams.get('id'));
    }
    if (path === '/docente/catedras/dashboard') {
        const urlParams = new URLSearchParams(window.location.search);
        loadTeacherCourseDashboard(urlParams.get('id'));
    }
    if (path === '/docente/tareas') loadTeacherAssignments();
    if (path === '/docente/avisos') loadTeacherAnnouncements();
    
    if (path === '/estudiante/catedras') loadStudentCourses();
    if (path === '/estudiante/catedras/clases') {
        const urlParams = new URLSearchParams(window.location.search);
        loadStudentCourseSchedule(urlParams.get('id'));
    }
    if (path === '/estudiante/tareas') loadStudentAssignments();
    if (path === '/estudiante/notificaciones') loadStudentNotifications();
    
    if (path === '/perfil') loadProfile();
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
            userDisplay.querySelector('.nav-text').innerText = currentProfile.full_name || user.email;
            userRoleLabel.innerText = currentProfile.role;
            
            const pendingOverlay = document.getElementById('pending-approval-overlay');
            if (currentProfile.account_status === 'pending') {
                pendingOverlay.classList.remove('hidden');
                document.querySelectorAll('.role-nav, .content-section').forEach(el => el.classList.add('hidden'));
                return;
            } else {
                if (pendingOverlay) pendingOverlay.classList.add('hidden');
            }
            
            document.querySelectorAll('.role-nav').forEach(el => el.classList.add('hidden'));
            const nav = document.getElementById(`nav-${currentProfile.role}`);
            if (nav) nav.classList.remove('hidden');
            
            if (currentProfile.role === 'student') {
                checkStudentNotifications();
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const enrollCode = urlParams.get('enroll');
            if (enrollCode) {
                try {
                    await api({ action: 'enrollCourse', payload: { code: enrollCode } });
                    alert('Te has inscripto al curso exitosamente.');
                    window.history.replaceState({}, document.title, window.location.pathname + (window.location.hash || ''));
                    window.location.reload();
                    return;
                } catch(e) {
                    alert('Error al inscribirse con enlace: ' + e.message);
                    window.history.replaceState({}, document.title, window.location.pathname + (window.location.hash || ''));
                }
            }

            const attendanceCode = urlParams.get('attendance');
            if (attendanceCode) {
                try {
                    const [courseId, classId] = attendanceCode.split('_');
                    await api({ action: 'markAttendance', payload: { courseId, classId } });
                    alert('Asistencia registrada exitosamente para la clase.');
                    window.history.replaceState({}, document.title, window.location.pathname + (window.location.hash || ''));
                } catch(e) {
                    alert('Error al registrar asistencia: ' + e.message);
                    window.history.replaceState({}, document.title, window.location.pathname + (window.location.hash || ''));
                }
            }
            
            router();
        } catch (e) { 
            console.error(e); 
            alert("Error al cargar perfil: " + e.message);
            signOut(auth);
        }
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
            <button class="secondary" onclick="navigateTo('/admin/catedras/detalle?id=${c.id}')">Ver detalles</button>
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
    if (!courseId) return navigateTo('/admin/catedras');
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
            <td>${u.account_status === 'pending' ? '<span style="color: #f39c12; font-weight: bold;">Pendiente</span>' : '<span style="color: #27ae60;">Aprobado</span>'}</td>
            <td>${u.account_status === 'pending' ? `<button onclick="approveUser('${u.id}')" style="background: #2ecc71; border: none; font-size: 0.8em; padding: 5px;">Aprobar</button>` : ''}</td>
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
            <div style="display: flex; gap: 10px;">
                <button class="secondary" onclick="navigateTo('/docente/catedras/dashboard?id=${c.id}')" style="background: #f1f2f6; border: 1px solid #dfe4ea; color: #2f3542;">📊 Dashboard</button>
                <button class="secondary" onclick="navigateTo('/docente/catedras/clases?id=${c.id}')" style="background: #e8f4f8; color: #2980b9; border: 1px solid #3498db;">📅 Cronograma</button>
                <button onclick="navigateTo('/docente/catedras/configuracion?id=${c.id}')">⚙️ Configurar cursada</button>
            </div>
        </div>
    `).join('') || '<p>No tenés cursos asignados</p>';
}

window.loadTeacherCourseDashboard = async (courseId) => {
    if (!courseId) return navigateTo('/docente/catedras');
    const grid = document.getElementById('dashboard-stats-grid');
    const alerts = document.getElementById('dashboard-alerts-list');
    
    grid.innerHTML = '<p>Cargando métricas...</p>';
    alerts.innerHTML = '<li>Cargando alertas...</li>';
    
    try {
        const res = await api({ action: 'getCourseDashboardStats', payload: { courseId } });
        const data = res.data;
        document.getElementById('dashboard-course-name').innerText = data.name;
        
        grid.innerHTML = `
            <div class="card" style="background: #e8f4f8; text-align: center;">
                <h3 style="margin: 0; font-size: 2em; color: #2980b9;">${data.totalStudents}</h3>
                <p style="margin: 5px 0 0; color: #555;">Alumnos inscriptos</p>
            </div>
            <div class="card" style="background: #fdf2e9; text-align: center;">
                <h3 style="margin: 0; font-size: 2em; color: #d35400;">${data.totalClasses}</h3>
                <p style="margin: 5px 0 0; color: #555;">Clases planificadas</p>
            </div>
            <div class="card" style="background: #eaeded; text-align: center;">
                <h3 style="margin: 0; font-size: 2em; color: #7f8c8d;">${data.totalAssignments}</h3>
                <p style="margin: 5px 0 0; color: #555;">Tareas / Entregas</p>
            </div>
            <div class="card" style="background: #eafaf1; text-align: center;">
                <h3 style="margin: 0; font-size: 2em; color: #27ae60;">${data.totalSubmissions}</h3>
                <p style="margin: 5px 0 0; color: #555;">Entregas recibidas</p>
            </div>
        `;
        
        const alertItems = [];
        if (data.pendingCorrections > 0) {
            alertItems.push(`<li style="color: #c0392b; margin-bottom: 10px;"><strong>¡Atención!</strong> Tienes ${data.pendingCorrections} entregas pendientes de corrección. Revisá el Google Sheet y luego andá a la pestaña "Entregas" para sincronizar.</li>`);
        }
        if (data.totalStudents === 0) {
            alertItems.push(`<li style="color: #f39c12; margin-bottom: 10px;"><strong>Sin alumnos:</strong> Nadie se ha inscripto aún. Recordá compartir el Código de Invitación o el Enlace Mágico.</li>`);
        }
        if (data.totalClasses === 0) {
            alertItems.push(`<li style="color: #f39c12; margin-bottom: 10px;"><strong>Sin cronograma:</strong> Aún no generaste el cronograma de clases. Usá la opción "Configurar cursada".</li>`);
        }
        if (data.totalAssignments > 0 && data.totalSubmissions > 0) {
            const onTimePct = Math.round((data.onTimeSubmissions / data.totalSubmissions) * 100);
            alertItems.push(`<li style="color: #2980b9; margin-bottom: 10px;"><strong>Rendimiento:</strong> El ${onTimePct}% de las entregas fueron enviadas a término.</li>`);
        }
        
        if (alertItems.length === 0) alertItems.push('<li style="color: #27ae60;">Todo está al día. ¡Buen trabajo!</li>');
        alerts.innerHTML = alertItems.join('');
        
    } catch(e) {
        grid.innerHTML = `<p style="color: red;">Error: ${e.message}</p>`;
        alerts.innerHTML = '<li>Error al cargar alertas</li>';
    }
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
            <span><strong>${s.day}</strong> a las <strong>${s.time}</strong> (${(s.duration || 2) * 30} min, ${s.type})</span>
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
    const duration = document.getElementById('schedule-duration').value || 2;
    if (!time) return alert('Poné una hora válida.');
    currentCourseSchedules.push({ day, time, type, duration: parseInt(duration) });
    renderSchedules();
    document.getElementById('schedule-time').value = '';
};

async function loadTeacherCourseSettings(courseId) {
    if (!courseId) return navigateTo('/docente/catedras');
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
        document.getElementById('settings-meet-url').value = data.meet_url || '';

        if (document.getElementById('settings-invite-student-link')) {
            const inviteStudentLink = `${window.location.origin}/?enroll=${data.invite_code}`;
            const inviteTeacherLink = `${window.location.origin}/?enroll=${data.teacher_invite_code}`;
            
            document.getElementById('settings-invite-student-link').value = inviteStudentLink;
            document.getElementById('settings-invite-teacher-link').value = inviteTeacherLink;
            
            document.getElementById('btn-copy-student-link').onclick = () => {
                navigator.clipboard.writeText(inviteStudentLink);
                alert('¡Enlace copiado para estudiantes!');
            };
            document.getElementById('btn-copy-teacher-link').onclick = () => {
                navigator.clipboard.writeText(inviteTeacherLink);
                alert('¡Enlace copiado para docentes!');
            };
        }

        const syncSecret = data.sync_secret || 'FALTA_TOKEN';
        document.getElementById('settings-export-grades-url').value = `https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/exportGradesCsv?courseId=${courseId}&token=${syncSecret}`;

        document.getElementById('settings-import-csv-btn').onclick = async () => {
            const fileInput = document.getElementById('settings-import-csv-input');
            if (!fileInput.files.length) return alert("Por favor selecciona un archivo CSV primero.");
            
            const file = fileInput.files[0];
            const statusEl = document.getElementById('settings-sync-grades-status');
            statusEl.innerText = "⏳ Subiendo e importando notas...";
            statusEl.style.color = "#f39c12";

            try {
                const text = await file.text();
                const res = await fetch(`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/importGrades?courseId=${courseId}&token=${syncSecret}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/csv' },
                    body: text
                });
                
                if (!res.ok) throw new Error(await res.text());
                const dataRes = await res.json();
                
                statusEl.innerText = `✅ Notas importadas con éxito. ${dataRes.updatedCount || 0} registros actualizados.`;
                statusEl.style.color = "#27ae60";
                setTimeout(() => statusEl.innerText = "", 5000);
            } catch (e) {
                statusEl.innerText = "❌ Error: " + e.message;
                statusEl.style.color = "#c0392b";
            }
        };
        
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
        meet_url: data.meet_url || '',
        schedules: currentCourseSchedules
    };
    if (data.class_instances) payloadData.class_instances = data.class_instances;
    
    await api({ action: 'updateCourseSettings', payload: { courseId: currentCourseSettingsId, data: payloadData } });
    alert("¡Planificación importada y guardada con éxito! Podés regenerar las clases para ajustar las fechas.");
}

document.getElementById('clone-course-btn').onclick = async () => {
    const cid = document.getElementById('settings-clone-course-select').value;
    if (!cid) return alert("Seleccioná una materia para clonar.");
    if (!confirm("¿Seguro que querés sobreescribir la configuración actual con la materia seleccionada? También se copiarán los avisos y tareas.")) return;
    try {
        const res = await api({ action: 'getCourseSettings', payload: { courseId: cid } });
        await applyCourseTemplate(res.data);
        await api({ action: 'cloneCourseExtraData', payload: { sourceCourseId: cid, targetCourseId: currentCourseSettingsId } });
        alert("¡Avisos y Tareas copiados exitosamente!");
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
                meet_url: document.getElementById('settings-meet-url').value,
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
    navigateTo('/docente/catedras/clases?id=' + currentCourseSettingsId);
};

let currentClassInstances = [];
let scheduleCourseData = null;

async function loadTeacherCourseSchedule(courseId) {
    if (!courseId) return navigateTo('/docente/catedras');
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
            setupTeacherVisualCalendar();
        }
    } catch (e) {
        alert("Error cargando cronograma: " + e.message);
    }
}

function generateClassInstances() {
    if (!scheduleCourseData.start_date || !scheduleCourseData.duration_weeks || !scheduleCourseData.schedules || scheduleCourseData.schedules.length === 0) {
        alert("Primero tenés que configurar la fecha de inicio, duración y horarios en la vista anterior.");
        return navigateTo('/docente/catedras/configuracion?id=' + scheduleCourseData.id);
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
                id: crypto.randomUUID(),
                date: classDate.toISOString(),
                type: sch.type,
                topic: "",
                presentation_url: "",
                recording_url: "",
                meet_url: scheduleCourseData.meet_url || "",
                special_status: "Normal"
            });
        }
    });
    
    generatedClasses.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const oldInstances = currentClassInstances || [];
    generatedClasses.forEach((ci, idx) => {
        if (oldInstances[idx]) {
            ci.id = oldInstances[idx].id || ci.id;
            ci.topic = oldInstances[idx].topic || "";
            ci.presentation_url = oldInstances[idx].presentation_url || "";
            ci.recording_url = oldInstances[idx].recording_url || "";
            ci.meet_url = oldInstances[idx].meet_url || ci.meet_url;
            ci.special_status = oldInstances[idx].special_status || "Normal";
            ci.description = oldInstances[idx].description || "";
        }
    });
    
    currentClassInstances = generatedClasses;
    renderScheduleClasses();
    setupTeacherVisualCalendar();
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
        const dateVal = d.toISOString().split('T')[0];
        const timeVal = d.toISOString().split('T')[1].substring(0, 5);
        
        return `
        <div class="card" style="display: flex; flex-direction: column; gap: 10px; ${ci.special_status === 'Feriado' ? 'opacity: 0.6; background: #eee;' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                <h3 style="margin: 0; text-transform: capitalize; flex: 1; min-width: 200px;">Clase ${idx + 1} (${ci.type})</h3>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <button class="secondary" style="margin: 0; padding: 5px 10px;" onclick="showAttendanceQR(${idx})" title="Código QR de Asistencia">📷 QR Asistencia</button>
                    <input type="date" value="${dateVal}" onchange="updateClassDate(${idx}, this.value, null)" style="padding: 5px;">
                    <input type="time" value="${timeVal}" onchange="updateClassDate(${idx}, null, this.value)" style="padding: 5px;">
                    <select id="ci-status-${idx}" onchange="updateClassInstance(${idx}, 'special_status', this.value)" style="padding: 5px;">
                        <option value="Normal" ${ci.special_status === 'Normal' ? 'selected' : ''}>Normal</option>
                        <option value="Clase Remota" ${ci.special_status === 'Clase Remota' ? 'selected' : ''}>Clase Remota</option>
                        <option value="Examen" ${ci.special_status === 'Examen' ? 'selected' : ''}>Examen</option>
                        <option value="Feriado" ${ci.special_status === 'Feriado' ? 'selected' : ''}>Feriado / Sin Clase</option>
                    </select>
                </div>
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
                    <label style="font-weight: bold; font-size: 0.9em; color: #555;">Enlace a Videollamada</label>
                    <input type="url" id="ci-meet-${idx}" value="${ci.meet_url || ''}" onchange="updateClassInstance(${idx}, 'meet_url', this.value)" placeholder="https://meet.google.com/xxx-xxxx-xxx">
                </div>
                <div style="flex: 1; min-width: 250px;">
                    <label style="font-weight: bold; font-size: 0.9em; color: #555;">Enlace a Grabación de la clase</label>
                    <div style="display: flex; gap: 5px;">
                        <input type="url" id="ci-rec-${idx}" value="${ci.recording_url || ''}" onchange="updateClassInstance(${idx}, 'recording_url', this.value)" placeholder="https://youtube.com/..." style="flex: 1;">
                        <button class="secondary" style="margin: 0;" onclick="linkYoutubeVideo(${idx})" title="Vincular con YouTube">YT</button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

window.showAttendanceQR = (idx) => {
    const ci = currentClassInstances[idx];
    if (!ci.id) return alert("Por favor guardá la configuración primero para generar IDs de clase.");
    
    const url = `${window.location.origin}/?attendance=${currentCourseSettingsId}_${ci.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 9999;';
    modal.onclick = () => document.body.removeChild(modal);
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; max-width: 90vw;" onclick="event.stopPropagation()">
            <h2 style="margin-top: 0;">Asistencia: Clase ${idx + 1}</h2>
            <p style="color: #666; margin-bottom: 20px;">Los estudiantes pueden escanear este código para dar el presente.</p>
            <img src="${qrUrl}" alt="QR Asistencia" style="width: 300px; height: 300px; border: 1px solid #eee; border-radius: 8px;">
            <p style="margin-top: 20px; font-size: 0.9em; word-break: break-all;"><a href="${url}" target="_blank">${url}</a></p>
            <button onclick="document.body.removeChild(this.parentElement.parentElement)" style="margin-top: 10px;">Cerrar</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.updateClassDate = (idx, dateVal, timeVal) => {
    const d = new Date(currentClassInstances[idx].date);
    let y = d.getUTCFullYear();
    let m = d.getUTCMonth();
    let day = d.getUTCDate();
    let h = d.getUTCHours();
    let min = d.getUTCMinutes();
    
    if (dateVal) {
        [y, m, day] = dateVal.split('-').map(Number);
        m--; // 0-indexed month
    }
    if (timeVal) {
        [h, min] = timeVal.split(':').map(Number);
    }
    currentClassInstances[idx].date = new Date(Date.UTC(y, m, day, h, min, 0)).toISOString();
    // Do not re-render immediately to avoid losing focus if they are just typing,
    // but date inputs usually blur on selection. Let's re-render to update the visual calendar if needed, or leave it.
    // Let's re-render the visual calendar but not the whole list so input focus isn't lost.
    setupTeacherVisualCalendar();
};

window.updateClassInstance = (idx, field, value) => {
    currentClassInstances[idx][field] = value;
    if (field === 'special_status') renderScheduleClasses();
};

window.linkYoutubeVideo = async (idx) => {
    const ci = currentClassInstances[idx];
    const className = `Clase ${idx + 1}: ${ci.topic || ci.type}`;
    
    let token = currentProfile.youtube_token;
    if (!token) {
        if (!confirm("Para vincular videos, necesitás conectar tu cuenta de YouTube. ¿Conectar ahora?")) return;
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/youtube.force-ssl');
        try {
            const res = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(res);
            token = credential.accessToken;
            await api({ action: 'updateUserProfile', payload: { userId: currentProfile.id, data: { youtube_token: token } } });
            currentProfile.youtube_token = token;
        } catch(e) {
            return alert("Error al conectar YouTube: " + e.message);
        }
    }
    
    try {
        const chanRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
            headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json());
        
        if (!chanRes.items || chanRes.items.length === 0) throw new Error("No se encontró el canal de YouTube");
        const uploadsId = chanRes.items[0].contentDetails.relatedPlaylists.uploads;
        
        const vidsRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=10`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json());
        
        if (!vidsRes.items || vidsRes.items.length === 0) throw new Error("No hay videos subidos recientes");
        
        let promptText = "Ingresá el número del video a vincular:\\n\\n";
        vidsRes.items.forEach((item, i) => {
            promptText += `${i + 1}. ${item.snippet.title}\\n`;
        });
        
        const selectedStr = prompt(promptText);
        if (!selectedStr) return;
        const selectedIdx = parseInt(selectedStr) - 1;
        if (isNaN(selectedIdx) || !vidsRes.items[selectedIdx]) return alert("Selección inválida");
        
        const videoId = vidsRes.items[selectedIdx].snippet.resourceId.videoId;
        const videoUrl = `https://youtu.be/${videoId}`;
        
        document.getElementById(`ci-rec-${idx}`).value = videoUrl;
        updateClassInstance(idx, 'recording_url', videoUrl);
        
        if (confirm(`¿Querés actualizar el título del video en YouTube a "${className}"?`)) {
            const vidDetail = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json());
            
            const snippet = vidDetail.items[0].snippet;
            snippet.title = className;
            
            const updateRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet`, {
                method: 'PUT',
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: videoId, snippet: snippet })
            });
            if (updateRes.ok) {
                alert("¡Video vinculado y título actualizado en YouTube!");
            } else {
                const err = await updateRes.json();
                console.error(err);
                alert("El video se vinculó pero falló la actualización del título. " + (err.error?.message || 'Error desconocido'));
            }
        }
        
    } catch(e) {
        alert("Error de YouTube: " + e.message);
        if (e.message && e.message.includes('401')) {
            currentProfile.youtube_token = null;
            api({ action: 'updateUserProfile', payload: { userId: currentProfile.id, data: { youtube_token: null } } });
        }
    }
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
        
        // Notify students about the updated schedule
        api({ action: 'notifyCourseStudents', payload: {
            courseId: scheduleCourseData.id,
            message: `El profesor ha actualizado el cronograma de la materia ${scheduleCourseData.name}.`,
            link: '/estudiante/catedras/clases?id=' + scheduleCourseData.id
        }}).catch(e => console.error("Error sending notification:", e));

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
        
        const enrollBtn = document.getElementById('enroll-btn');
        if (enrollBtn) enrollBtn.onclick = async () => {
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
                setTimeout(() => window.location.search = '?path=/student/perfil', 2000);
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
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <button class="secondary" onclick="navigateTo('/estudiante/catedras/clases?id=${c.id}')" style="width: 100%; font-size: 1.1em; padding: 10px; background: #ecf0f1; color: #2c3e50; border: 1px solid #bdc3c7;">📅 Ver Cronograma Completo (Por Semana)</button>
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
                
            </div>
            `;
        }).join('');
    }
    } catch(e) {
        container.innerHTML = `<p style="color: red;">Error: ${e.message}</p>`;
    }
}


document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
});

function loadProfile() {
    if (!currentProfile) return;
    document.getElementById('profile-matricula').value = currentProfile.matricula_unrn || '';
    document.getElementById('profile-cohorte').value = currentProfile.cohorte || '';

    // Emails
    document.getElementById('profile-primary-email').innerText = auth.currentUser.email || 'No disponible';
    
    window.renderAltEmails = () => {
        const list = document.getElementById('profile-alt-emails-list');
        if (!currentProfile.alternative_emails || currentProfile.alternative_emails.length === 0) {
            list.innerHTML = '<li>No tenés correos alternativos cargados.</li>';
            return;
        }
        list.innerHTML = currentProfile.alternative_emails.map((em, i) => `
            <li style="margin-bottom: 5px;">
                ${em} 
                <span onclick="removeAltEmail(${i})" style="color: #e74c3c; cursor: pointer; font-weight: bold; margin-left: 10px;" title="Eliminar">❌</span>
            </li>
        `).join('');
    };
    
    window.removeAltEmail = (index) => {
        currentProfile.alternative_emails.splice(index, 1);
        renderAltEmails();
    };
    
    document.getElementById('add-alt-email-btn').onclick = () => {
        const input = document.getElementById('new-alt-email');
        const val = input.value.trim();
        if (!val || !val.includes('@')) return alert('Ingresá un correo válido.');
        if (!currentProfile.alternative_emails) currentProfile.alternative_emails = [];
        if (currentProfile.alternative_emails.includes(val) || val === auth.currentUser.email) {
            return alert('Este correo ya está en tu lista.');
        }
        currentProfile.alternative_emails.push(val);
        input.value = '';
        renderAltEmails();
    };
    
    renderAltEmails();

    
    // Check GitHub status
    const isGithubLinked = auth.currentUser.providerData.some(p => p.providerId === 'github.com');
    const ghContainer = document.getElementById('github-link-status');
    if (isGithubLinked) {
        ghContainer.innerHTML = '<span style="color: #27ae60; font-weight: bold;">✅ Cuenta de GitHub vinculada correctamente.</span>';
        ghContainer.style.background = '#e8f8f5';
    } else {
        ghContainer.innerHTML = `
            <span style="color: #c0392b; font-weight: bold;">❌ No tenés cuenta de GitHub vinculada.</span>
            <br><button id="link-github-btn" style="background: #333; margin-top: 10px;">Vincular cuenta de GitHub ahora</button>
        `;
        document.getElementById('link-github-btn').onclick = async () => {
            const btn = document.getElementById('link-github-btn');
            btn.disabled = true;
            btn.innerText = "Vinculando...";
            try {
                await linkWithPopup(auth.currentUser, new GithubAuthProvider());
                alert("¡Cuenta de GitHub vinculada con éxito!");
                loadProfile();
            } catch (e) {
                alert("Error al vincular GitHub: " + e.message);
                btn.disabled = false;
                btn.innerText = "Reintentar vincular GitHub";
            }
        };
    }
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





window.importGradesCsv = async (assignmentId, token) => {
    const fileInput = document.getElementById(`csv-upload-${assignmentId}`);
    if (!fileInput.files.length) return alert("Por favor selecciona un archivo CSV primero.");

    const file = fileInput.files[0];
    const statusEl = document.getElementById(`sync-status-${assignmentId}`);
    if (statusEl) {
        statusEl.innerText = "⏳ Subiendo e importando notas...";
        statusEl.style.color = "#f39c12";
    }

    try {
        const text = await file.text();
        const res = await fetch(`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/importGrades?assignmentId=${assignmentId}&token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/csv' },
            body: text
        });
        
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        
        if (statusEl) {
            statusEl.innerText = `✅ Notas importadas con éxito. ${data.updatedCount || 0} registros actualizados.`;
            statusEl.style.color = "#27ae60";
        }
        setTimeout(() => loadTeacherAssignments(), 2500);
    } catch (e) {
        if (statusEl) {
            statusEl.innerText = "❌ Error: " + e.message;
            statusEl.style.color = "#c0392b";
        } else {
            alert("Error al importar: " + e.message);
        }
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


const annBtn = document.getElementById('send-announcement-btn');
if (annBtn) annBtn.onclick = async () => {
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




async function loadStudentCourseSchedule(urlParams) {
    const courseId = urlParams.get('id');
    if (!courseId) return navigateTo('/estudiante/catedras');
    
    document.getElementById('student-schedule-title').innerText = "Cargando cronograma...";
    document.getElementById('student-schedule-weeks-list').innerHTML = "";
    
    try {
        const res = await api({ action: 'getCourseDetails', payload: { courseId } });
        const course = res.course;
        const instances = res.class_instances || [];
        
        document.getElementById('student-schedule-title').innerText = `Cronograma: ${course.name}`;
        
        if (instances.length === 0) {
            document.getElementById('student-schedule-weeks-list').innerHTML = "<p>El profesor todavía no publicó el cronograma.</p>";
            return;
        }
        
        // Find start of week 1
        function getMonday(d) {
            const date = new Date(d);
            const day = date.getUTCDay();
            const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
            return new Date(date.setUTCDate(diff));
        }
        
        const firstClassDate = new Date(instances[0].date);
        firstClassDate.setUTCHours(0,0,0,0);
        const week1Monday = getMonday(firstClassDate);
        
        const weeks = {};
        instances.forEach(ci => {
            const cd = new Date(ci.date);
            cd.setUTCHours(0,0,0,0);
            const m = getMonday(cd);
            
            const diffTime = Math.abs(m - week1Monday);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            const weekNumber = Math.floor(diffDays / 7) + 1;
            
            if (!weeks[weekNumber]) weeks[weekNumber] = [];
            weeks[weekNumber].push(ci);
        });
        
        let html = '';
        for (let w = 1; w <= Math.max(...Object.keys(weeks).map(Number)); w++) {
            if (!weeks[w]) continue;
            
            const weekClasses = weeks[w];
            
            html += `
                <div class="card" style="margin-bottom: 20px; border-left: 4px solid #3498db;">
                    <h2 style="margin-top: 0; color: #2c3e50;">Semana ${w}</h2>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${weekClasses.map(ci => {
                            const d = new Date(ci.date);
                            const ds = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
                            
                            let tags = '';
                            if (ci.special_status === 'Clase Remota') tags += '<span style="background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">REMOTA</span>';
                            if (ci.special_status === 'Feriado') tags += '<span style="background: #95a5a6; color: white; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">FERIADO / CANCELADA</span>';
                            
                            let links = [];
                            if (ci.meet_url) links.push(`<a href="${ci.meet_url}" target="_blank" style="color: #e74c3c; text-decoration: underline; font-weight: bold;">Videollamada</a>`);
                            if (ci.presentation_url) links.push(`<a href="${ci.presentation_url}" target="_blank" style="color: #3498db; text-decoration: underline;">Material</a>`);
                            if (ci.recording_url) links.push(`<a href="${ci.recording_url}" target="_blank" style="color: #3498db; text-decoration: underline;">Grabación</a>`);
                            const linksStr = links.length ? ` - [ ${links.join(' | ')} ]` : '';
                            
                            const topicHtml = typeof marked !== 'undefined' ? marked.parseInline(ci.topic || ci.type) : (ci.topic || ci.type);
                            const descHtml = (ci.description && typeof marked !== 'undefined') ? `<div style="font-size: 0.9em; color: #555; background: #fff; padding: 10px; margin-top: 5px; border-left: 3px solid #ccc; border-radius: 4px;" class="markdown-body">${marked.parse(ci.description)}</div>` : '';
                            
                            return `
                            <div style="background: #fdfdfd; border: 1px solid #eee; padding: 15px; border-radius: 4px; ${ci.special_status === 'Feriado' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                                <div style="font-size: 0.85em; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">
                                    ${ds} - Clase ${ci.classNumber} ${tags}
                                </div>
                                <div style="font-size: 1.1em; color: #333;">
                                    <strong>Tema:</strong> ${topicHtml} ${linksStr}
                                </div>
                                ${descHtml}
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        document.getElementById('student-schedule-weeks-list').innerHTML = html;

        // Inject global calendar if available
        try {
            const gRes = await api({ action: 'getGlobalSettings', payload: {} });
            const gContainer = document.getElementById('global-calendar-subscribe-container');
            if (gRes.globalCalendarIcsUrl) {
                const encodedGlobalUrl = encodeURIComponent(gRes.globalCalendarIcsUrl);
                gContainer.style.display = 'block';
                gContainer.innerHTML = `<a href="https://calendar.google.com/calendar/r?cid=${encodedGlobalUrl}" target="_blank" style="display: block; padding: 15px; background: #8e44ad; color: white; text-align: center; border-radius: 8px; font-weight: bold; text-decoration: none;">📅 Suscribirse al Calendario Global de Eventos (Google Calendar)</a>`;
            } else {
                gContainer.style.display = 'none';
            }
        } catch (e) { console.error(e); }

        // Set course calendar subscribe link
        document.getElementById('subscribe-course-gcal-btn').onclick = () => {
            downloadIcsFile(course.name, instances);
        };

        // Render visual calendar
        const calendarEl = document.getElementById('student-schedule-visual-calendar');
        calendarEl.innerHTML = "";
        
        const events = instances.map(ci => {
            let color = '#3498db'; // normal
            if (ci.special_status === 'Feriado') color = '#e74c3c';
            if (ci.special_status === 'Clase Remota') color = '#f39c12';
            if (ci.special_status === 'Examen') color = '#9b59b6';
            
            return {
                title: `Clase ${ci.classNumber}: ${ci.topic || ci.type}`,
                start: ci.date,
                allDay: true,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    desc: ci.description,
                    status: ci.special_status
                }
            };
        });
        
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'es',
            events: events,
            firstDay: 1,
            buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana' },
            eventClick: function(info) {
                alert(info.event.title + "\n" + (info.event.extendedProps.desc || ""));
            }
        });
        
        // Go to start date
        if (instances.length > 0) {
            calendar.gotoDate(instances[0].date);
        }

        // Toggle logic
        const weekBtn = document.getElementById('toggle-view-weekly-btn');
        const gridBtn = document.getElementById('toggle-view-grid-btn');
        const weekView = document.getElementById('student-schedule-weeks-list');
        const gridView = document.getElementById('student-schedule-visual-calendar');
        
        weekBtn.onclick = () => {
            weekView.style.display = 'block';
            gridView.style.display = 'none';
            weekBtn.style.background = '#34495e';
            weekBtn.classList.remove('secondary');
            gridBtn.style.background = '';
            gridBtn.classList.add('secondary');
        };
        
        gridBtn.onclick = () => {
            weekView.style.display = 'none';
            gridView.style.display = 'block';
            gridBtn.style.background = '#34495e';
            gridBtn.classList.remove('secondary');
            weekBtn.style.background = '';
            weekBtn.classList.add('secondary');
            calendar.render(); // required to fix sizing
        };

        
    } catch (e) {
        document.getElementById('student-schedule-weeks-list').innerHTML = `<p style="color: red;">Error: ${e.message}</p>`;
    }
}



async function loadAdminSettings() {
    try {
        const res = await api({ action: 'getGlobalSettings', payload: {} });
        if (res.globalCalendarIcsUrl) {
            document.getElementById('admin-global-calendar-url').value = res.globalCalendarIcsUrl;
        }
    } catch (e) {
        console.error("Error cargando configuracion global:", e);
    }
}

document.getElementById('save-global-settings-btn').onclick = async () => {
    const btn = document.getElementById('save-global-settings-btn');
    const status = document.getElementById('global-settings-save-status');
    const url = document.getElementById('admin-global-calendar-url').value;
    
    btn.disabled = true;
    try {
        await api({ action: 'saveGlobalSettings', payload: { globalCalendarIcsUrl: url } });
        status.style.display = 'block';
        setTimeout(() => status.style.display = 'none', 3000);
    } catch (e) {
        alert("Error al guardar: " + e.message);
    } finally {
        btn.disabled = false;
    }
};



async function loadStudentAssignments() {
    const container = document.getElementById('student-assignments-list');
    container.innerHTML = 'Cargando tus entregas...';
    
    try {
        const res = await api({ action: 'getStudentCourses' });
        const courses = res.data || [];
        if (courses.length === 0) {
            container.innerHTML = '<p>No estás anotado en ninguna cursada.</p>';
            return;
        }
        
        const courseIds = courses.map(c => c.id);
        const aRes = await api({ action: 'getStudentAssignments', payload: { courseIds } });
        const assignments = (aRes.data && aRes.data.assignments) || [];
        const submissions = (aRes.data && aRes.data.submissions) || [];
        
        if (assignments.length === 0) {
            container.innerHTML = '<p>No tenés tareas asignadas por el momento.</p>';
            return;
        }
        
        // Group by course
        let html = '';
        courses.forEach(c => {
            const courseAssignments = assignments.filter(a => a.course_id === c.id);
            if (courseAssignments.length === 0) return;
            
            html += `<div class="card" style="margin-bottom: 25px; border-left: 4px solid #8e44ad;">`;
            html += `<h2 style="margin-top: 0; color: #8e44ad; border-bottom: 1px solid #eee; padding-bottom: 10px;">${c.name}</h2>`;
            
            html += `<div style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">`;
            
            courseAssignments.forEach(a => {
                const sub = submissions.find(s => s.assignment_id === a.id);
                if (sub) {
                    html += `
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px;">
                            <h5 style="margin: 0 0 5px 0; color: #166534; font-size: 1.1em;">✅ ${a.title}</h5>
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                                <a href="${sub.repo_url}" target="_blank" style="color: #15803d; text-decoration: none; font-weight: bold;">Ver tu repositorio en GitHub ↗</a>
                                <div style="background: white; padding: 5px 10px; border-radius: 4px; border: 1px solid #dcfce7; font-size: 0.9em;">
                                    <strong>Nota:</strong> ${sub.grade ? sub.grade : '<span style="color: #999;">Sin calificar</span>'}
                                    ${sub.feedback ? `<br><strong>Feedback:</strong> ${sub.feedback}` : ''}
                                </div>
                            </div>
                            
                            <div style="border-top: 1px solid #dcfce7; padding-top: 10px; margin-top: 10px;">
                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <button onclick="viewCommits('${sub.id}')" style="background: #10b981; border: none; font-size: 0.8em; padding: 5px 10px; border-radius: 4px;">🔍 Ver Últimos Commits</button>
                                    ${sub.status !== 'submitted' ? `<button onclick="submitAssignmentPrompt('${sub.id}')" style="background: #3b82f6; border: none; font-size: 0.8em; padding: 5px 10px; border-radius: 4px;">✅ Marcar como Entregado</button>` : `<span style="color: #2563eb; font-weight: bold; font-size: 0.9em;">🚀 Entregado</span>`}
                                </div>
                                <div id="commits-${sub.id}" style="margin-top: 10px; font-size: 0.85em; display: none; background: white; padding: 10px; border-radius: 4px; border: 1px solid #dcfce7;"></div>
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div style="background: #fff; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                            <h5 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.1em;">⏳ ${a.title}</h5>
                            <p style="font-size: 0.9em; color: #64748b; margin-top: 0;">Todavía no aceptaste esta tarea. Al aceptarla se creará tu repositorio en GitHub para que empieces a trabajar.</p>
                            <button onclick="acceptAssignment('${a.id}')" style="margin: 0; background: #3498db; padding: 8px 15px; font-size: 0.9em; border: none; font-weight: bold;" id="btn-accept-${a.id}">Aceptar Tarea en GitHub</button>
                            <p id="status-accept-${a.id}" style="margin: 5px 0 0 0; font-size: 0.85em; font-weight: bold;"></p>
                        </div>
                    `;
                }
            });
            
            html += `</div></div>`;
        });
        
        container.innerHTML = html;
        
    } catch (e) {
        container.innerHTML = `<p style="color: red;">Error cargando entregas: ${e.message}</p>`;
    }
}
window.checkStudentNotifications = async () => {
    try {
        const res = await api({ action: 'getStudentNotifications' });
        const unreadCount = res.data.filter(n => !n.read).length;
        const badge = document.getElementById('student-notif-badge');
        if (unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        console.error("Error checking notifications:", e);
    }
};

window.loadStudentNotifications = async () => {
    const container = document.getElementById('student-notifications-list');
    container.innerHTML = '<p>Cargando notificaciones...</p>';
    
    try {
        const res = await api({ action: 'getStudentNotifications' });
        const notifs = res.data || [];
        
        if (notifs.length === 0) {
            container.innerHTML = '<p>No tienes notificaciones por el momento.</p>';
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
        notifs.forEach(n => {
            const d = new Date(n.created_at._seconds * 1000 || n.created_at);
            const isRead = n.read;
            html += `
                <div class="card" style="border-left: 4px solid ${isRead ? '#95a5a6' : '#e74c3c'}; background: ${isRead ? '#fafafa' : '#fff'}; cursor: ${n.link ? 'pointer' : 'default'};" ${n.link ? `onclick="navigateTo('${n.link}')"` : ''}>
                    <div style="font-size: 0.85em; color: #888; margin-bottom: 5px;">${d.toLocaleString()} ${!isRead ? '<span style="color: #e74c3c; font-weight: bold;">(Nueva)</span>' : ''}</div>
                    <div style="font-size: 1.1em; color: #333;">${n.message}</div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        
        document.getElementById('mark-all-read-btn').onclick = async () => {
            try {
                await api({ action: 'markNotificationsRead' });
                checkStudentNotifications();
                loadStudentNotifications();
            } catch (e) {
                alert("Error: " + e.message);
            }
        };
        
    } catch (e) {
        container.innerHTML = `<p style="color: red;">Error cargando notificaciones: ${e.message}</p>`;
    }
};



window.renderWeeklyScheduleHtml = (instances) => {
    if (!instances || instances.length === 0) return '<p>No hay clases generadas.</p>';
    
    const weeks = {};
    const firstClassDate = new Date(instances[0].date);
    const dayOfWeek = firstClassDate.getUTCDay(); // 0 is Sunday, 1 is Monday
    const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const baseMonday = new Date(firstClassDate);
    baseMonday.setUTCDate(baseMonday.getUTCDate() - offsetToMonday);
    
    instances.forEach(ci => {
        const d = new Date(ci.date);
        const diffTime = Math.abs(d - baseMonday);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const weekNumber = Math.floor(diffDays / 7) + 1;
        
        if (!weeks[weekNumber]) weeks[weekNumber] = [];
        weeks[weekNumber].push(ci);
    });
    
    let html = '';
    const maxWeek = Math.max(...Object.keys(weeks).map(Number));
    if (maxWeek < 1) return '<p>Error calculando semanas.</p>';
    
    for (let w = 1; w <= maxWeek; w++) {
        if (!weeks[w]) continue;
        
        const weekClasses = weeks[w];
        
        html += `<div class="card" style="margin-bottom: 20px; border-left: 4px solid #3498db;">`;
        html += `<h2 style="margin-top: 0; color: #2c3e50;">Semana ${w}</h2>`;
        html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
        
        weekClasses.forEach(ci => {
            const d = new Date(ci.date);
            const ds = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
            
            let tags = '';
            if (ci.special_status === 'Clase Remota') tags += '<span style="background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">REMOTA</span>';
            if (ci.special_status === 'Feriado') tags += '<span style="background: #95a5a6; color: white; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">FERIADO / CANCELADA</span>';
            if (ci.special_status === 'Examen') tags += '<span style="background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">EXAMEN</span>';
            
            let links = [];
            if (ci.presentation_url) links.push(`<a href="${ci.presentation_url}" target="_blank" style="color: #3498db; text-decoration: underline;">Material</a>`);
            if (ci.recording_url) links.push(`<a href="${ci.recording_url}" target="_blank" style="color: #3498db; text-decoration: underline;">Grabación</a>`);
            const linksStr = links.length ? ` - [ ${links.join(' | ')} ]` : '';
            
            const topicHtml = typeof marked !== 'undefined' ? marked.parseInline(ci.topic || ci.type) : (ci.topic || ci.type);
            const descHtml = (ci.description && typeof marked !== 'undefined') ? `<div style="font-size: 0.9em; color: #555; background: #fff; padding: 10px; margin-top: 5px; border-left: 3px solid #ccc; border-radius: 4px;" class="markdown-body">${marked.parse(ci.description)}</div>` : '';
            
            html += `
            <div style="background: #fdfdfd; border: 1px solid #eee; padding: 15px; border-radius: 4px; ${ci.special_status === 'Feriado' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                <div style="font-size: 0.85em; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">
                    ${ds} - Clase ${ci.classNumber || ''} ${tags}
                </div>
                <div style="font-size: 1.1em; color: #333;">
                    <strong>Tema:</strong> ${topicHtml} ${linksStr}
                </div>
                ${descHtml}
            </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    return html;
};

// Setup Teacher Visual Calendar
async function setupTeacherVisualCalendar() {
    try {
        const gRes = await api({ action: 'getGlobalSettings', payload: {} });
        const gContainer = document.getElementById('teacher-global-calendar-subscribe-container');
        if (gRes.globalCalendarIcsUrl) {
            const encodedGlobalUrl = encodeURIComponent(gRes.globalCalendarIcsUrl);
            gContainer.style.display = 'block';
            gContainer.innerHTML = `<a href="https://calendar.google.com/calendar/r?cid=${encodedGlobalUrl}" target="_blank" style="display: block; padding: 15px; background: #8e44ad; color: white; text-align: center; border-radius: 8px; font-weight: bold; text-decoration: none;">📅 Suscribirse al Calendario Global de Eventos (Google Calendar)</a>`;
        } else {
            gContainer.style.display = 'none';
        }
    } catch (e) { console.error(e); }

    document.getElementById('teacher-subscribe-course-gcal-btn').onclick = () => {
        downloadIcsFile(scheduleCourseData.name, currentClassInstances);
    };

    let teacherCalendar = null;
    const listBtn = document.getElementById('toggle-teacher-view-list-btn');
    const weekBtn = document.getElementById('toggle-teacher-view-weekly-btn');
    const gridBtn = document.getElementById('toggle-teacher-view-grid-btn');
    
    const listView = document.getElementById('schedule-classes-list');
    const weekView = document.getElementById('teacher-schedule-weeks-list');
    const gridView = document.getElementById('teacher-schedule-visual-calendar');
    
    const instructionsView = document.getElementById('teacher-schedule-instructions');
    const saveBtn = document.getElementById('save-schedule-btn');

    listBtn.onclick = () => {
        listView.style.display = 'flex';
        instructionsView.style.display = 'block';
        saveBtn.style.display = 'block';
        weekView.style.display = 'none';
        gridView.style.display = 'none';
        
        listBtn.style.background = '#34495e';
        listBtn.classList.remove('secondary');
        weekBtn.style.background = '';
        weekBtn.classList.add('secondary');
        gridBtn.style.background = '';
        gridBtn.classList.add('secondary');
    };

    weekBtn.onclick = () => {
        listView.style.display = 'none';
        instructionsView.style.display = 'none';
        saveBtn.style.display = 'none';
        gridView.style.display = 'none';
        weekView.style.display = 'block';
        
        weekView.innerHTML = renderWeeklyScheduleHtml(currentClassInstances);
        
        weekBtn.style.background = '#34495e';
        weekBtn.classList.remove('secondary');
        listBtn.style.background = '';
        listBtn.classList.add('secondary');
        gridBtn.style.background = '';
        gridBtn.classList.add('secondary');
    };

    gridBtn.onclick = () => {
        listView.style.display = 'none';
        instructionsView.style.display = 'none';
        saveBtn.style.display = 'none';
        weekView.style.display = 'none';
        gridView.style.display = 'block';
        
        gridBtn.style.background = '#34495e';
        gridBtn.classList.remove('secondary');
        listBtn.style.background = '';
        listBtn.classList.add('secondary');
        weekBtn.style.background = '';
        weekBtn.classList.add('secondary');
        
        // Re-init calendar every time to catch new edits in currentClassInstances
        gridView.innerHTML = '';
        const events = currentClassInstances.map(ci => {
            let color = '#3498db'; // normal
            if (ci.special_status === 'Feriado') color = '#e74c3c';
            if (ci.special_status === 'Clase Remota') color = '#f39c12';
            if (ci.special_status === 'Examen') color = '#9b59b6';
            
            return {
                title: `Clase ${ci.classNumber || ''}: ${ci.topic || ci.type}`,
                start: ci.date,
                allDay: true,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    desc: ci.description,
                    status: ci.special_status
                }
            };
        });
        
        teacherCalendar = new FullCalendar.Calendar(gridView, {
            initialView: 'dayGridMonth',
            locale: 'es',
            events: events,
            firstDay: 1,
            buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana' },
            eventClick: function(info) {
                alert(info.event.title + "\\n" + (info.event.extendedProps.desc || ""));
            }
        });
        
        teacherCalendar.render();
        if (currentClassInstances.length > 0) {
            teacherCalendar.gotoDate(currentClassInstances[0].date);
        }
    };
}


window.viewCommits = async (submissionId) => {
    const div = document.getElementById(`commits-${submissionId}`);
    if (div.style.display === 'block') {
        div.style.display = 'none';
        return;
    }
    
    div.style.display = 'block';
    div.innerHTML = 'Cargando commits...';
    try {
        const res = await api({ action: 'getStudentCommits', payload: { submissionId } });
        if (res.length === 0) {
            div.innerHTML = 'No hay commits en este repositorio todavía.';
            return;
        }
        let html = '<ul style="margin: 0; padding-left: 20px;">';
        res.forEach(c => {
            const date = new Date(c.date).toLocaleString('es-AR');
            html += `<li><a href="${c.url}" target="_blank" style="color: #2563eb; font-family: monospace;">${c.sha.substring(0,7)}</a>: ${c.message} <span style="color: #666;">(${date})</span></li>`;
        });
        html += '</ul>';
        div.innerHTML = html;
    } catch (e) {
        div.innerHTML = `<span style="color: red;">Error: ${e.message}</span>`;
    }
};

window.submitAssignmentPrompt = async (submissionId) => {
    const msg = prompt("¿Querés dejarle algún mensaje o comentario al profesor sobre esta entrega? (Opcional)");
    if (msg === null) return; // cancelled
    
    try {
        await api({ action: 'submitAssignment', payload: { submissionId, message: msg } });
        alert("¡Entrega marcada exitosamente!");
        loadStudentAssignments();
    } catch (e) {
        alert("Error al enviar la entrega: " + e.message);
    }
};

