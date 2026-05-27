const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authOverlay = document.getElementById('auth-overlay');
const userDisplay = document.getElementById('user-display');
const userRoleLabel = document.getElementById('user-role');
const loadingIndicator = document.getElementById('loading-indicator');

let currentUser = null;
let currentProfile = null;
let qrInterval = null;
let html5QrCode = null;
let activeAssignmentId = null;

loginBtn.onclick = () => supabase.auth.signInWithOAuth({ provider: 'github' });
logoutBtn.onclick = () => supabase.auth.signOut();

window.testLogin = async (role) => {
    const emailMap = {
        'admin': 'admin@gaula.com',
        'teacher': 'teacher@gaula.com',
        'student': 'student@gaula.com'
    };
    
    loadingIndicator.classList.remove('hidden');
    const { error } = await supabase.auth.signInWithPassword({
        email: emailMap[role],
        password: 'password123'
    });
    loadingIndicator.classList.add('hidden');
    
    if (error) alert("Test Login Error: " + error.message);
};

supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        currentUser = session.user;
        authOverlay.classList.add('hidden');
        await fetchProfile();
        setupDashboard();
    } else {
        currentUser = null; currentProfile = null;
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
    updateBadges();
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
    if (sectionId === 'teacher-comms') loadTeacherCommsData();
    if (sectionId === 'student-courses') loadStudentCourses();
    if (sectionId === 'student-comms') loadStudentCommsData();
    if (sectionId === 'student-scan') startScanner();
    else stopScanner();
    updateBadges();
};

async function updateBadges() {
    if (!currentUser || !currentProfile) return;
    const role = currentProfile.role;
    if (role === 'student') {
        const { count: msgCount } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('receiver_id', currentUser.id).is('read_at', null);
        updateBadgeElement('badge-student-msgs', msgCount);
        const { count: pendingCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('student_id', currentUser.id).in('status', ['sin_comenzar', 'rehacer', 'accepted']);
        updateBadgeElement('badge-student-pending', pendingCount);
    }
    if (role === 'teacher') {
        const { count: msgCount } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('receiver_id', currentUser.id).is('read_at', null);
        updateBadgeElement('badge-teacher-msgs', msgCount);
        const { data: courses } = await supabase.from('course_teachers').select('course_id').eq('teacher_id', currentUser.id);
        const { count: toGradeCount } = await supabase.from('submissions').select('*, assignments!inner(course_id)', { count: 'exact', head: true }).in('assignments.course_id', courses.map(c => c.id)).eq('status', 'sin_corregir');
        updateBadgeElement('badge-teacher-pending', toGradeCount);
    }
}
function updateBadgeElement(id, count) {
    const el = document.getElementById(id); if (!el) return;
    if (count > 0) { el.innerText = count; el.classList.remove('hidden'); } else el.classList.add('hidden');
}

// --- Admin ---
async function loadAdminCourses() {
    const { data } = await supabase.from('courses').select('*');
    document.getElementById('admin-courses-list').innerHTML = data.map(c => `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><div><h3>${c.name}</h3><p>${c.github_org}</p></div><button class="secondary" onclick="exportCourse('${c.id}', '${c.name}')">Export</button></div>`).join('');
}
window.createCourse = async () => {
    const name = document.getElementById('course-name').value;
    const org = document.getElementById('course-org').value;
    const { error } = await supabase.from('courses').insert([{ name, github_org: org, created_by: currentUser.id }]);
    if (!error) loadAdminCourses();
};
window.exportCourse = async (courseId, name) => {
    const { data: assignments } = await supabase.from('assignments').select('title, description, template_repo_url').eq('course_id', courseId);
    const { data: schedules } = await supabase.from('course_schedules').select('day_of_week, start_time, end_time').eq('course_id', courseId);
    const { data: plan } = await supabase.from('course_plan_items').select('title, description, topic_date, recording_url, materials_url').eq('course_id', courseId);
    const { data: events } = await supabase.from('course_events').select('title, description, event_date, is_external').eq('course_id', courseId);
    const blob = new Blob([JSON.stringify({ name, assignments, schedules, plan, events }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${name.toLowerCase().replace(/ /g, '-')}.json`; a.click();
};
window.importCourse = async (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = JSON.parse(e.target.result);
        const name = prompt("Name:", data.name + " (Copy)"); const org = prompt("GitHub Org:"); if (!name || !org) return;
        const { data: newCourse, error } = await supabase.from('courses').insert([{ name, github_org: org, created_by: currentUser.id }]).select().single();
        if (error) return alert(error.message);
        if (data.assignments?.length) await supabase.from('assignments').insert(data.assignments.map(x => ({ ...x, course_id: newCourse.id })));
        if (data.schedules?.length) await supabase.from('course_schedules').insert(data.schedules.map(x => ({ ...x, course_id: newCourse.id })));
        if (data.plan?.length) await supabase.from('course_plan_items').insert(data.plan.map(x => ({ ...x, course_id: newCourse.id })));
        if (data.events?.length) await supabase.from('course_events').insert(data.events.map(x => ({ ...x, course_id: newCourse.id })));
        alert("Imported!"); loadAdminCourses();
    };
    reader.readAsText(file);
};

// --- Teacher ---
async function loadTeacherCourses() {
    const { data } = await supabase.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    document.getElementById('teacher-courses-list').innerHTML = data.map(c => `<div class="card"><h3>${c.name}</h3><button onclick="showSection('teacher-assignments')">Assignments</button></div>`).join('');
    document.getElementById('assignment-course-id').innerHTML = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
async function loadTeacherAssignments() {
    const { data } = await supabase.from('assignments').select('*, courses!inner(course_teachers!inner(teacher_id))').eq('courses.course_teachers.teacher_id', currentUser.id);
    document.getElementById('teacher-assignments-list').innerHTML = data.map(a => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
            <div><h4>${a.title}</h4><p>${a.template_repo_url}</p></div>
            <button onclick="viewAssignmentDetails('${a.id}', '${a.title}')">Manage Access</button>
        </div>
    `).join('');
}
window.viewAssignmentDetails = async (id, title) => {
    activeAssignmentId = id;
    document.getElementById('view-assign-title').innerText = title;
    document.getElementById('assignment-detail-view').classList.remove('hidden');
    loadSubmissionsTable();
};
async function loadSubmissionsTable() {
    const { data: subs } = await supabase.from('submissions').select('*, profiles(full_name, user_metadata)').eq('assignment_id', activeAssignmentId);
    document.getElementById('student-submissions-table').innerHTML = subs.map(s => `
        <tr>
            <td>${s.profiles.full_name || s.profiles.user_metadata.full_name || 'Student'}</td>
            <td><span class="status-pill">${s.status}</span></td>
            <td>${s.is_locked ? '🔒 Read-only' : '✍️ Write'}</td>
            <td><button class="secondary" onclick="toggleAccess('${s.id}', ${!s.is_locked})">${s.is_locked ? 'Unlock' : 'Lock'}</button></td>
        </tr>
    `).join('');
}
window.toggleAccess = async (submissionId, lock) => {
    loadingIndicator.classList.remove('hidden');
    await supabase.functions.invoke('github-classroom-actions', { body: { action: 'TOGGLE_REPO_ACCESS', submissionId, lock } });
    loadingIndicator.classList.add('hidden'); loadSubmissionsTable();
};
window.massToggleAccess = async (lock) => {
    if (!confirm(`Mass ${lock ? 'LOCK' : 'UNLOCK'}?`)) return;
    loadingIndicator.classList.remove('hidden');
    await supabase.functions.invoke('github-classroom-actions', { body: { action: 'MASS_TOGGLE_ACCESS', assignmentId: activeAssignmentId, lock } });
    loadingIndicator.classList.add('hidden'); loadSubmissionsTable();
};
window.createAssignment = async () => {
    const course_id = document.getElementById('assignment-course-id').value;
    const title = document.getElementById('assignment-title').value;
    const template = document.getElementById('assignment-template').value;
    await supabase.from('assignments').insert([{ course_id, title, template_repo_url: template }]);
    loadTeacherAssignments();
};

async function loadTeacherAttendanceData() {
    const { data } = await supabase.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    const html = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('schedule-course-id').innerHTML = html;
    document.getElementById('session-course-id').innerHTML = html;
}
window.addSchedule = async () => {
    const course_id = document.getElementById('schedule-course-id').value;
    const day = parseInt(document.getElementById('schedule-day').value);
    const start = document.getElementById('schedule-start').value;
    const end = document.getElementById('schedule-end').value;
    await supabase.from('course_schedules').insert([{ course_id, day_of_week: day, start_time: start, end_time: end }]);
    alert("Added!");
};
window.startSession = async () => {
    const course_id = document.getElementById('session-course-id').value;
    const { data } = await supabase.from('class_sessions').insert([{ course_id, scheduled_at: new Date().toISOString(), otp_secret: Math.random().toString(36).substring(2, 15) }]).select().single();
    document.getElementById('qr-container').classList.remove('hidden');
    updateQR(data.id); qrInterval = setInterval(() => updateQR(data.id), 10000);
};
async function updateQR(sessionId) {
    const { data } = await supabase.functions.invoke('attendance-handler', { body: { action: 'GENERATE_QR_TOKEN', sessionId } });
    if (data?.token) {
        QRCode.toCanvas(document.getElementById('qr-canvas'), JSON.stringify({ s: sessionId, t: data.token }), { width: 300 });
        let timeLeft = 10; const timerEl = document.getElementById('qr-timer');
        const t = setInterval(() => { timeLeft--; timerEl.innerText = timeLeft; if (timeLeft <= 0) clearInterval(t); }, 1000);
    }
}
window.stopSession = () => { clearInterval(qrInterval); document.getElementById('qr-container').classList.add('hidden'); };

async function loadTeacherCurriculumData() {
    const { data } = await supabase.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    document.getElementById('curriculum-course-id').innerHTML = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
window.addCurriculumItem = async () => {
    const cid = document.getElementById('curriculum-course-id').value;
    await supabase.from('course_plan_items').insert([{ course_id: cid, topic_date: document.getElementById('curriculum-date').value, title: document.getElementById('curriculum-title').value }]);
    alert("Saved!");
};
window.addCourseEvent = async () => {
    const cid = document.getElementById('curriculum-course-id').value;
    await supabase.from('course_events').insert([{ course_id: cid, event_date: document.getElementById('event-date').value, title: document.getElementById('event-title').value }]);
    alert("Event Added!");
};

async function loadTeacherCommsData() {
    const { data: courses } = await supabase.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    document.getElementById('ann-course-id').innerHTML = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const { data: students } = await supabase.from('course_roster').select('student_id, student_email').in('course_id', courses.map(c => c.id));
    const unique = [...new Map(students.map(s => [s.student_id, s])).values()];
    document.getElementById('dm-student-id').innerHTML = '<option value="">Select Student</option>' + unique.map(s => `<option value="${s.student_id}">${s.student_email}</option>`).join('');
}
window.postAnnouncement = async () => {
    await supabase.from('course_announcements').insert([{ course_id: document.getElementById('ann-course-id').value, author_id: currentUser.id, title: document.getElementById('ann-title').value, content: document.getElementById('ann-content').value }]);
    alert("Posted!");
};
window.sendDirectMessage = async (role) => {
    const recId = document.getElementById(role === 'teacher' ? 'dm-student-id' : 'dm-teacher-id').value;
    const cont = document.getElementById(`${role}-dm-content`).value;
    await supabase.from('direct_messages').insert([{ sender_id: currentUser.id, receiver_id: recId, content: cont }]);
    document.getElementById(`${role}-dm-content`).value = ''; loadChat(role, recId);
};
async function loadChat(role, peerId) {
    if (!peerId) return;
    await supabase.from('direct_messages').update({ read_at: new Date().toISOString(), is_read: true }).eq('receiver_id', currentUser.id).eq('sender_id', peerId).is('read_at', null);
    const { data: messages } = await supabase.from('direct_messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    const chatBox = document.getElementById(`${role}-chat-box`);
    chatBox.innerHTML = messages.map(m => `<div class="message-bubble ${m.sender_id === currentUser.id ? 'sent' : 'received'}">${m.content} ${(m.sender_id === currentUser.id && m.read_at) ? '✔' : ''}</div>`).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
}
document.getElementById('dm-student-id')?.addEventListener('change', (e) => loadChat('teacher', e.target.value));
document.getElementById('dm-teacher-id')?.addEventListener('change', (e) => loadChat('student', e.target.value));

// --- Student ---
async function loadStudentCourses() {
    const { data } = await supabase.from('courses').select(`*, course_roster!inner(student_id)`).eq('course_roster.student_id', currentUser.id);
    document.getElementById('student-courses-list').innerHTML = data.map(c => `<div class="card"><h3>${c.name}</h3><button onclick="viewCourseDetails('${c.id}', '${c.name}', '')">Open</button></div>`).join('');
}
window.viewCourseDetails = async (id, name, desc) => {
    document.getElementById('st-course-title').innerText = name; showSection('student-course-detail');
    const { data: curr } = await supabase.from('course_plan_items').select('*').eq('course_id', id).order('topic_date');
    const { data: assign } = await supabase.from('assignments').select('*, submissions(*)').eq('course_id', id);
    document.getElementById('student-timeline-list').innerHTML = curr.map(i => `<div class="curriculum-item"><strong>${i.topic_date}</strong>: ${i.title}</div>`).join('');
    document.getElementById('student-assignments-list').innerHTML = assign.map(a => `<div class="card"><h4>${a.title}</h4>${a.submissions?.[0] ? 'Accepted' : `<button onclick="acceptAssignment('${a.id}')">Accept</button>`}</div>`).join('');
};
window.acceptAssignment = async (id) => { await supabase.functions.invoke('github-classroom-actions', { body: { action: 'ACCEPT_ASSIGNMENT', assignmentId: id } }); location.reload(); };
async function loadStudentCommsData() {
    const { data: roster } = await supabase.from('course_roster').select('course_id').eq('student_id', currentUser.id);
    const { data: anns } = await supabase.from('course_announcements').select('*, courses(name)').in('course_id', roster.map(r => r.course_id)).order('created_at', { ascending: false });
    document.getElementById('student-announcements-list').innerHTML = anns.map(a => `<div class="card announcement-card"><small>${a.courses.name}</small><h4>${a.title}</h4><p>${a.content}</p></div>`).join('');
    const { data: teachers } = await supabase.from('course_teachers').select('teacher_id, courses(name)').in('course_id', roster.map(r => r.course_id));
    document.getElementById('dm-teacher-id').innerHTML = '<option value="">Select Teacher</option>' + teachers.map(t => `<option value="${t.teacher_id}">${t.courses.name}</option>`).join('');
}
function startScanner() {
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
        const { s, t } = JSON.parse(txt);
        await supabase.functions.invoke('attendance-handler', { body: { action: 'MARK_ATTENDANCE', sessionId: s, token: t } });
        alert("Marked!"); html5QrCode.stop(); showSection('student-courses');
    });
}
function stopScanner() { if (html5QrCode?.isScanning) html5QrCode.stop(); }
