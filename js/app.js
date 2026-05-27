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
    if (sectionId === 'teacher-comms') loadTeacherCommsData();
    if (sectionId === 'student-courses') loadStudentCourses();
    if (sectionId === 'student-comms') loadStudentCommsData();
    if (sectionId === 'student-scan') startScanner();
    else stopScanner();
};

// --- Teacher Dashboard Functions ---
async function loadTeacherCommsData() {
    const { data: courses } = await supabase.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    document.getElementById('ann-course-id').innerHTML = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    // Load students for DM
    const { data: students } = await supabase.from('course_roster').select('student_id, student_email').in('course_id', courses.map(c => c.id));
    const uniqueStudents = [...new Map(students.map(item => [item.student_id, item])).values()];
    document.getElementById('dm-student-id').innerHTML = '<option value="">Select Student</option>' + 
        uniqueStudents.map(s => `<option value="${s.student_id}">${s.student_email}</option>`).join('');
}

window.postAnnouncement = async () => {
    const course_id = document.getElementById('ann-course-id').value;
    const title = document.getElementById('ann-title').value;
    const content = document.getElementById('ann-content').value;

    const { error } = await supabase.from('course_announcements').insert([{ course_id, author_id: currentUser.id, title, content }]);
    if (error) alert(error.message); else { alert("Announcement posted!"); document.getElementById('ann-content').value = ''; }
};

window.sendDirectMessage = async (role) => {
    const prefix = role === 'teacher' ? 'teacher' : 'student';
    const receiver_id = document.getElementById(role === 'teacher' ? 'dm-student-id' : 'dm-teacher-id').value;
    const content = document.getElementById(`${prefix}-dm-content`).value;

    if (!receiver_id || !content) return;

    const { error } = await supabase.from('direct_messages').insert([{ 
        sender_id: currentUser.id, 
        receiver_id, 
        content,
        course_id: null // Can be set if needed
    }]);

    if (error) alert(error.message); 
    else {
        document.getElementById(`${prefix}-dm-content`).value = '';
        if (role === 'teacher') loadChat('teacher', receiver_id);
        else loadChat('student', receiver_id);
    }
};

async function loadChat(role, peerId) {
    if (!peerId) return;
    
    // 1. Mark incoming messages as read
    await supabase.from('direct_messages')
        .update({ read_at: new Date().toISOString(), is_read: true })
        .eq('receiver_id', currentUser.id)
        .eq('sender_id', peerId)
        .is('read_at', null);

    // 2. Load conversation
    const { data: messages } = await supabase.from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

    const chatBox = document.getElementById(`${role}-chat-box`);
    chatBox.innerHTML = messages.map(m => {
        const isSent = m.sender_id === currentUser.id;
        const readInfo = (isSent && m.read_at) ? `<div style="font-size: 0.8em; color: #27ae60;">✔ Read: ${new Date(m.read_at).toLocaleTimeString()}</div>` : '';
        
        return `
            <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                ${m.content}
                <div style="font-size: 0.7em; text-align: right; opacity: 0.6;">
                    ${new Date(m.created_at).toLocaleTimeString()}
                </div>
                ${readInfo}
            </div>
        `;
    }).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById('dm-student-id')?.addEventListener('change', (e) => loadChat('teacher', e.target.value));
document.getElementById('dm-teacher-id')?.addEventListener('change', (e) => loadChat('student', e.target.value));

// --- Student Dashboard Functions ---
async function loadStudentCommsData() {
    // Announcements
    const { data: roster } = await supabase.from('course_roster').select('course_id').eq('student_id', currentUser.id);
    const courseIds = roster.map(r => r.course_id);
    
    const { data: announcements } = await supabase.from('course_announcements').select('*, courses(name)').in('course_id', courseIds).order('created_at', { ascending: false });
    document.getElementById('student-announcements-list').innerHTML = announcements.map(a => `
        <div class="card announcement-card">
            <small>${a.courses.name}</small>
            <h4>${a.title}</h4>
            <p>${a.content}</p>
            <div style="font-size: 0.8em; color: #666;">${new Date(a.created_at).toLocaleString()}</div>
        </div>
    `).join('') || '<p>No announcements yet.</p>';

    // Teachers for DM
    const { data: teachers } = await supabase.from('course_teachers').select('teacher_id, courses(name)').in('course_id', courseIds);
    document.getElementById('dm-teacher-id').innerHTML = '<option value="">Select Teacher</option>' + 
        teachers.map(t => `<option value="${t.teacher_id}">${t.courses.name} Professor</option>`).join('');
}

// --- Curriculum & Events ---
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

// --- Student Course Detail ---
async function loadStudentCourses() {
    const { data } = await supabase.from('courses').select(`*, course_roster!inner(student_id)`).eq('course_roster.student_id', currentUser.id);
    document.getElementById('student-courses-list').innerHTML = data.map(c => `<div class="card"><h3>${c.name}</h3><button onclick="viewCourseDetails('${c.id}', '${c.name}', '${c.description || ''}')">Open Course</button></div>`).join('');
}

window.viewCourseDetails = async (courseId, name, desc) => {
    document.getElementById('st-course-title').innerText = name;
    document.getElementById('st-course-desc').innerText = desc;
    showSection('student-course-detail');
    
    const { data: curriculum } = await supabase.from('course_plan_items').select('*').eq('course_id', courseId).order('topic_date', { ascending: true });
    const { data: events } = await supabase.from('course_events').select('*').eq('course_id', courseId).order('event_date', { ascending: true });

    const timelineContainer = document.getElementById('student-timeline-list');
    let html = '<h4>Scheduled Classes</h4>' + curriculum.map(item => `
        <div class="curriculum-item">
            <strong>${item.topic_date}: ${item.title}</strong>
            <p>${item.description || ''}</p>
            ${item.recording_url ? `<a href="${item.recording_url}" target="_blank">🎥 Recording</a>` : ''}
            ${item.materials_url ? ` | <a href="${item.materials_url}" target="_blank">📚 Materials</a>` : ''}
        </div>
    `).join('') || '<p>No classes scheduled.</p>';

    html += '<h4>Important Events</h4>' + events.map(ev => `
        <div class="event-item">
            <strong>${ev.event_date}: ${ev.title}</strong>
            ${ev.is_external ? ' <span style="font-size:0.8em; background:#eee; padding:2px 5px; border-radius:3px;">External</span>' : ''}
        </div>
    `).join('') || '<p>No events.</p>';

    timelineContainer.innerHTML = html;

    const { data: assignments } = await supabase.from('assignments').select('*, submissions(*)').eq('course_id', courseId);
    document.getElementById('student-assignments-list').innerHTML = assignments.map(a => {
        const sub = a.submissions && a.submissions[0];
        const statusMap = { 'ok': '✅ OK', 'correcciones': '⚠️ Correcciones', 'sin_corregir': '🔆 Sin Corregir', 'rehacer': '❌ Rehacer', 'sin_entregar': '⭕ Sin entregar', 'sin_comenzar': '🚫 Sin comenzar', 'accepted': '🟢 Aceptado', 'submitted': '🔵 Enviado' };
        const statusBadge = sub ? (statusMap[sub.status] || '❓') : '🚫 Sin comenzar';
        return `<div class="card"><h4>${a.title}</h4><p>Status: ${statusBadge}</p>${sub ? `<a href="${sub.student_repo_url}" target="_blank">Repo</a>` : `<button onclick="acceptAssignment('${a.id}')">Accept</button>`}</div>`;
    }).join('');
};

// --- Attendance/QR ---
async function loadTeacherAttendanceData() {
    const { data } = await supabase.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    const html = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('schedule-course-id').innerHTML = html;
    document.getElementById('session-course-id').innerHTML = html;
}

window.addSchedule = async () => {
    const course_id = document.getElementById('schedule-course-id').value;
    const day_of_week = parseInt(document.getElementById('schedule-day').value);
    const start_time = document.getElementById('schedule-start').value;
    const end_time = document.getElementById('schedule-end').value;
    const { error } = await supabase.from('course_schedules').insert([{ course_id, day_of_week, start_time, end_time }]);
    if (error) alert(error.message); else alert("Schedule added!");
};

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
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = JSON.parse(e.target.result);
        const name = prompt("New course name:", data.name + " (Copy)");
        const org = prompt("GitHub Org:");
        if (!name || !org) return;
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
