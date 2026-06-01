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

document.getElementById('login-github-btn').onclick = () => withLoading(() => signInWithPopup(auth, new GithubAuthProvider())).catch(e => alert("Falló el inicio con GitHub: " + e.message));
document.getElementById('login-google-btn').onclick = () => withLoading(() => signInWithPopup(auth, new GoogleAuthProvider())).catch(e => alert("Falló el inicio con Google: " + e.message));

document.getElementById('login-email-btn').onclick = async () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('password-input').value;
    try { await withLoading(() => signInWithEmailAndPassword(auth, email, pass)); }
    catch(e) { alert("Error al entrar: " + e.message); }
};

document.getElementById('signup-email-btn').onclick = async () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('password-input').value;
    try { await withLoading(() => createUserWithEmailAndPassword(auth, email, pass)); }
    catch(e) { alert("Error al registrarte: " + e.message); }
};
logoutBtn.onclick = () => signOut(auth);



const routes = {
    '/admin/courses': 'admin-courses',
    '/admin/course-detail': 'admin-course-detail',
    '/admin/users': 'admin-users',
    '/teacher/courses': 'teacher-courses',
    '/teacher/course-settings': 'teacher-course-settings',
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
    if (path === '/teacher/course-settings') {
        const urlParams = new URLSearchParams(window.location.search);
        loadTeacherCourseSettings(urlParams.get('id'));
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
        document.getElementById('teacher-settings-title').innerText = \`Configurar: \${data.name}\`;
        document.getElementById('settings-cover-text').value = data.cover_text || '';
        document.getElementById('settings-start-date').value = data.start_date || '';
        document.getElementById('settings-duration').value = data.duration_weeks || '';
        currentCourseSchedules = data.schedules || [];
        renderSchedules();
    } catch (e) {
        alert("Error cargando configuración: " + e.message);
    }
}

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

async function loadStudentCourses() {
    const res = await api({ action: 'getStudentCourses' });
    const container = document.getElementById('student-courses-list');
    
    if (!res.data || res.data.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <h3 style="color: #2c3e50;">No estás anotado en ningún curso</h3>
                <p style="color: #666; margin-bottom: 20px;">Ingresá el código de invitación que te pasó el profe para sumarte a la cursada.</p>
                <div style="display: flex; justify-content: center; gap: 10px; max-width: 400px; margin: 0 auto;">
                    <input type="text" id="enroll-code" placeholder="Código de cursada (Ej: 9A2B3C)" style="margin: 0; text-transform: uppercase;">
                    <button id="enroll-btn" style="margin: 0;">Sumarme</button>
                </div>
            </div>
        `;
        document.getElementById('enroll-btn').onclick = async () => {
            const code = document.getElementById('enroll-code').value;
            if (!code) return;
            try {
                await api({ action: 'enrollCourse', payload: { code: code.toUpperCase() } });
                loadStudentCourses();
            } catch (e) {
                alert("Uy, error al enrolarte: " + e.message);
            }
        };
    } else {
        container.innerHTML = res.data.map(c => `
            <div class="card">
                <h3>${c.name}</h3>
                <p>${c.github_org}</p>
            </div>
        `).join('');
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
