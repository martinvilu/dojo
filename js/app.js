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

document.getElementById('login-github-btn').onclick = () => withLoading(() => signInWithPopup(auth, new GithubAuthProvider())).catch(e => alert("GitHub login failed: " + e.message));
document.getElementById('login-google-btn').onclick = () => withLoading(() => signInWithPopup(auth, new GoogleAuthProvider())).catch(e => alert("Google login failed: " + e.message));

document.getElementById('login-email-btn').onclick = async () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('password-input').value;
    try { await withLoading(() => signInWithEmailAndPassword(auth, email, pass)); }
    catch(e) { alert("Login failed: " + e.message); }
};

document.getElementById('signup-email-btn').onclick = async () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('password-input').value;
    try { await withLoading(() => createUserWithEmailAndPassword(auth, email, pass)); }
    catch(e) { alert("Sign up failed: " + e.message); }
};
logoutBtn.onclick = () => signOut(auth);



const routes = {
    '/admin/courses': 'admin-courses',
    '/admin/users': 'admin-users',
    '/teacher/courses': 'teacher-courses',
    '/teacher/assignments': 'teacher-assignments',
    '/student/courses': 'student-courses',
    '/student/profile': 'student-profile',
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
    if (path === '/admin/users') loadAdminUsers();
    if (path === '/teacher/courses') loadTeacherCourses();
    if (path === '/student/profile') loadStudentProfile();
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
        <div class="card">
            <h3>${c.name}</h3>
            <p>${c.github_org}</p>
        </div>
    `).join('');
}

document.getElementById('create-course-btn').onclick = async () => {
    const name = document.getElementById('course-name').value;
    const org = document.getElementById('course-org').value;
    await api({ action: 'createCourse', payload: { name, github_org: org } });
    loadAdminCourses();
};

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
        <div class="card">
            <h3>${c.name}</h3>
        </div>
    `).join('') || '<p>No courses assigned</p>';
}

function loadStudentProfile() {
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
        alert("Error saving profile: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Perfil";
    }
};
