const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authOverlay = document.getElementById('auth-overlay');

// UI Elements
const userDisplay = document.getElementById('user-display');
const userRoleLabel = document.getElementById('user-role');
const loadingIndicator = document.getElementById('loading-indicator');

let currentUser = null;
let currentProfile = null;
let qrInterval = null;
let html5QrCode = null;

// Auth Listeners
loginBtn.onclick = () => supabase.auth.signInWithOAuth({ provider: 'github' });
logoutBtn.onclick = () => supabase.auth.signOut();

supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        currentUser = session.user;
        authOverlay.classList.add('hidden');
        await fetchProfile();
        setupDashboard();
    } else {
        currentUser = null;
        currentProfile = null;
        authOverlay.classList.remove('hidden');
        hideAllRoles();
    }
});

async function fetchProfile() {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (!error) {
        currentProfile = data;
        userDisplay.innerText = currentUser.user_metadata.full_name || currentUser.email;
        userRoleLabel.innerText = currentProfile.role;
    }
}

function setupDashboard() {
    hideAllRoles();
    const role = currentProfile.role;
    document.getElementById(`nav-${role}`).classList.remove('hidden');
    showSection(role === 'admin' ? 'admin-courses' : (role === 'teacher' ? 'teacher-courses' : 'student-courses'));
}

function hideAllRoles() {
    document.querySelectorAll('.role-nav, .content-section').forEach(el => el.classList.add('hidden'));
}

window.showSection = (sectionId) => {
    document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    
    if (sectionId === 'admin-courses') loadAdminCourses();
    if (sectionId === 'teacher-courses') loadTeacherCourses();
    if (sectionId === 'teacher-assignments') loadTeacherAssignments();
    if (sectionId === 'teacher-attendance') loadTeacherAttendanceData();
    if (sectionId === 'teacher-curriculum') loadTeacherCurriculumData();
    if (sectionId === 'student-courses') loadStudentCourses();
    if (sectionId === 'student-scan') startScanner();
    else stopScanner();
};

// --- Teacher Dashboard Functions ---
async function loadTeacherAttendanceData() {
    const { data } = await supabase.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    const html = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('schedule-course-id').innerHTML = html;
    document.getElementById('session-course-id').innerHTML = html;
}

async function loadTeacherCurriculumData() {
    const { data } = await supabase.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    document.getElementById('curriculum-course-id').innerHTML = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

window.addCurriculumItem = async () => {
    const course_id = document.getElementById('curriculum-course-id').value;
    const topic_date = document.getElementById('curriculum-date').value;
    const title = document.getElementById('curriculum-title').value;
    const description = document.getElementById('curriculum-desc').value;
    const recording_url = document.getElementById('curriculum-recording').value;
    const materials_url = document.getElementById('curriculum-materials').value;

    const { error } = await supabase.from('course_plan_items').insert([{ course_id, topic_date, title, description, recording_url, materials_url }]);
    if (error) alert(error.message); else alert("Curriculum item added!");
};

window.addCourseEvent = async () => {
    const course_id = document.getElementById('curriculum-course-id').value;
    const event_date = document.getElementById('event-date').value;
    const title = document.getElementById('event-title').value;
    const is_external = document.getElementById('event-external').checked;

    const { error } = await supabase.from('course_events').insert([{ course_id, event_date, title, is_external }]);
    if (error) alert(error.message); else alert("Event added!");
};

// --- Student Dashboard Functions ---
async function loadStudentCourses() {
    const { data } = await supabase.from('courses').select(`*, course_roster!inner(student_id)`).eq('course_roster.student_id', currentUser.id);
    document.getElementById('student-courses-list').innerHTML = data.map(c => `<div class="card"><h3>${c.name}</h3><button onclick="viewCourseDetails('${c.id}', '${c.name}', '${c.description || ''}')">Open Course</button></div>`).join('');
}

window.viewCourseDetails = async (courseId, name, desc) => {
    document.getElementById('st-course-title').innerText = name;
    document.getElementById('st-course-desc').innerText = desc;
    showSection('student-course-detail');
    
    // Load Curriculum and Events combined (Timeline)
    const { data: curriculum } = await supabase.from('course_plan_items').select('*').eq('course_id', courseId).order('topic_date', { ascending: true });
    const { data: events } = await supabase.from('course_events').select('*').eq('course_id', courseId).order('event_date', { ascending: true });

    const timelineContainer = document.getElementById('student-timeline-list');
    
    let html = '<h4>Scheduled Classes</h4>';
    html += curriculum.map(item => `
        <div class="curriculum-item">
            <strong>${item.topic_date}: ${item.title}</strong>
            <p>${item.description || ''}</p>
            ${item.recording_url ? `<a href="${item.recording_url}" target="_blank">🎥 Recording</a>` : ''}
            ${item.materials_url ? ` | <a href="${item.materials_url}" target="_blank">📚 Materials</a>` : ''}
        </div>
    `).join('') || '<p>No classes scheduled yet.</p>';

    html += '<h4>Important Events</h4>';
    html += events.map(ev => `
        <div class="event-item">
            <strong>${ev.event_date}: ${ev.title}</strong>
            ${ev.is_external ? ' <span style="font-size:0.8em; background:#eee; padding:2px 5px; border-radius:3px;">External</span>' : ''}
        </div>
    `).join('') || '<p>No events found.</p>';

    timelineContainer.innerHTML = html;

    // Load Assignments
    const { data: assignments } = await supabase.from('assignments').select('*, submissions(*)').eq('course_id', courseId);
    document.getElementById('student-assignments-list').innerHTML = assignments.map(a => {
        const sub = a.submissions && a.submissions[0];
        const statusMap = { 'ok': '✅ OK', 'correcciones': '⚠️ Correcciones', 'sin_corregir': '🔆 Sin Corregir', 'rehacer': '❌ Rehacer', 'sin_entregar': '⭕ Sin entregar', 'sin_comenzar': '🚫 Sin comenzar', 'accepted': '🟢 Aceptado', 'submitted': '🔵 Enviado' };
        const statusBadge = sub ? (statusMap[sub.status] || '❓') : '🚫 Sin comenzar';
        return `<div class="card"><h4>${a.title}</h4><p>Status: ${statusBadge}</p>${sub ? `<a href="${sub.student_repo_url}" target="_blank">Repo</a>` : `<button onclick="acceptAssignment('${a.id}')">Accept</button>`}</div>`;
    }).join('');
};

// --- Reuse existing Attendance/QR Logic ---
window.startSession = async () => {
    const course_id = document.getElementById('session-course-id').value;
    const otp_secret = Math.random().toString(36).substring(2, 15);
    const { data } = await supabase.from('class_sessions').insert([{ course_id, scheduled_at: new Date().toISOString(), otp_secret }]).select().single();
    document.getElementById('qr-container').classList.remove('hidden');
    updateQR(data.id);
    qrInterval = setInterval(() => updateQR(data.id), 10000);
};

async function updateQR(sessionId) {
    const { data } = await supabase.functions.invoke('attendance-handler', { body: { action: 'GENERATE_QR_TOKEN', sessionId } });
    if (data?.token) {
        QRCode.toCanvas(document.getElementById('qr-canvas'), JSON.stringify({ s: sessionId, t: data.token }), { width: 300 });
        let timeLeft = 10;
        const timerEl = document.getElementById('qr-timer');
        const timer = setInterval(() => { timeLeft--; timerEl.innerText = timeLeft; if (timeLeft <= 0) clearInterval(timer); }, 1000);
    }
}

function startScanner() {
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (decodedText) => {
        const { s: sessionId, t: token } = JSON.parse(decodedText);
        const { error } = await supabase.functions.invoke('attendance-handler', { body: { action: 'MARK_ATTENDANCE', sessionId, token } });
        if (error) alert(error.message); else { alert("Attendance marked!"); html5QrCode.stop(); showSection('student-courses'); }
    });
}

function stopScanner() { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop(); }
window.stopSession = () => { clearInterval(qrInterval); document.getElementById('qr-container').classList.add('hidden'); };
window.acceptAssignment = async (assignmentId) => {
    const { error } = await supabase.functions.invoke('github-classroom-actions', { body: { action: 'ACCEPT_ASSIGNMENT', assignmentId } });
    if (error) alert(error.message); else location.reload();
};
// Admin Functions
async function loadAdminCourses() {
    const { data } = await supabase.from('courses').select('*');
    const container = document.getElementById('admin-courses-list');
    container.innerHTML = data.map(c => `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3>${c.name}</h3>
                <p>${c.github_org}</p>
            </div>
            <div>
                <button class="secondary" onclick="exportCourse('${c.id}', '${c.name}')">Export JSON</button>
            </div>
        </div>
    `).join('');
}

window.exportCourse = async (courseId, name) => {
    const { data: assignments } = await supabase.from('assignments').select('title, description, template_repo_url').eq('course_id', courseId);
    const { data: schedules } = await supabase.from('course_schedules').select('day_of_week, start_time, end_time').eq('course_id', courseId);
    const { data: plan } = await supabase.from('course_plan_items').select('title, description, topic_date, recording_url, materials_url').eq('course_id', courseId);
    const { data: events } = await supabase.from('course_events').select('title, description, event_date, is_external').eq('course_id', courseId);

    const exportData = { name, assignments, schedules, plan, events };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/ /g, '-')}-structure.json`;
    a.click();
};

window.importCourse = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = JSON.parse(e.target.result);
        const name = prompt("Enter new course name:", data.name + " (Copy)");
        const org = prompt("Enter GitHub Organization for the new course:");

        if (!name || !org) return;

        // 1. Create Course
        const { data: newCourse, error } = await supabase.from('courses').insert([{ name, github_org: org, created_by: currentUser.id }]).select().single();
        if (error) return alert(error.message);

        // 2. Import items
        if (data.assignments?.length) await supabase.from('assignments').insert(data.assignments.map(x => ({ ...x, course_id: newCourse.id })));
        if (data.schedules?.length) await supabase.from('schedules').insert(data.schedules.map(x => ({ ...x, course_id: newCourse.id })));
        if (data.plan?.length) await supabase.from('course_plan_items').insert(data.plan.map(x => ({ ...x, course_id: newCourse.id })));
        if (data.events?.length) await supabase.from('course_events').insert(data.events.map(x => ({ ...x, course_id: newCourse.id })));

        alert("Course imported successfully!");
        loadAdminCourses();
    };
    reader.readAsText(file);
};

window.createCourse = async () => {
    const name = document.getElementById('course-name').value;
    const org = document.getElementById('course-org').value;
    const { error } = await supabase.from('courses').insert([{ name, github_org: org, created_by: currentUser.id }]);
    if (!error) loadAdminCourses();
};
async function loadTeacherCourses() {
    const { data } = await supabase.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    document.getElementById('teacher-courses-list').innerHTML = data.map(c => `<div class="card"><h3>${c.name}</h3><button onclick="showSection('teacher-assignments')">Assignments</button></div>`).join('');
    document.getElementById('assignment-course-id').innerHTML = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
async function loadTeacherAssignments() {
    const { data } = await supabase.from('assignments').select('*, courses!inner(course_teachers!inner(teacher_id))').eq('courses.course_teachers.teacher_id', currentUser.id);
    document.getElementById('teacher-assignments-list').innerHTML = data.map(a => `<div class="card"><h4>${a.title}</h4><p>${a.template_repo_url}</p></div>`).join('');
}
window.createAssignment = async () => {
    const course_id = document.getElementById('assignment-course-id').value;
    const title = document.getElementById('assignment-title').value;
    const template = document.getElementById('assignment-template').value;
    const { error } = await supabase.from('assignments').insert([{ course_id, title, template_repo_url: template }]);
    if (!error) loadTeacherAssignments();
};
