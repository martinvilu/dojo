const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// Use a different name for the client instance to avoid shadowing the global 'supabase' from CDN
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// Auth Listeners
loginBtn.onclick = () => sb.auth.signInWithOAuth({ provider: 'github' });
logoutBtn.onclick = () => sb.auth.signOut();

window.testLogin = async (role) => {
    const emailMap = {
        'admin': 'admin@gaula.com',
        'teacher': 'teacher@gaula.com',
        'student': 'student@gaula.com'
    };
    
    loadingIndicator.classList.remove('hidden');
    const { error } = await sb.auth.signInWithPassword({
        email: emailMap[role],
        password: 'password123'
    });
    loadingIndicator.classList.add('hidden');
    
    if (error) alert("Test Login Error: " + error.message);
    else location.reload(); // Force reload to ensure clean state
};

// Initial session check
async function initApp() {
    const { data: { session } } = await sb.auth.getSession();
    handleAuthState(session);
    
    sb.auth.onAuthStateChange((event, session) => {
        handleAuthState(session);
    });
}

async function handleAuthState(session) {
    if (session) {
        currentUser = session.user;
        authOverlay.classList.add('hidden');
        const success = await fetchProfile();
        if (success) {
            setupDashboard();
        } else {
            // If profile fails (e.g. DB reset while logged in), sign out
            alert("Session error: Profile not found. Signing out.");
            sb.auth.signOut();
        }
    } else {
        currentUser = null;
        currentProfile = null;
        authOverlay.classList.remove('hidden');
        hideAllRoles();
    }
}

async function fetchProfile() {
    try {
        const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
        if (error || !data) throw error || new Error("No profile");
        
        currentProfile = data;
        userDisplay.innerText = currentProfile.full_name || currentUser.email;
        userRoleLabel.innerText = currentProfile.role;
        return true;
    } catch (e) {
        console.error("Error fetching profile:", e);
        return false;
    }
}

initApp();

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
    if (sectionId === 'admin-users') loadAdminUsers();
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

// --- Admin ---
async function loadAdminUsers() {
    const { data: users, error } = await sb.from('profiles').select('*').order('full_name');
    if (error) return alert(error.message);

    document.getElementById('admin-users-table').innerHTML = users.map(u => `
        <tr>
            <td><img src="${u.avatar_url || 'https://ui-avatars.com/api/?name='+u.full_name}" style="width: 32px; height: 32px; border-radius: 50%;"></td>
            <td>${u.full_name || 'No name'} ${u.matricula ? `<br><small style="color: #666;">${u.matricula}</small>` : ''}</td>
            <td>${u.github_username ? `<a href="https://github.com/${u.github_username}" target="_blank">@${u.github_username}</a>` : '-'}</td>
            <td>
                <select style="width: auto; padding: 2px;" onchange="updateUserRole('${u.id}', this.value)">
                    <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
                    <option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>Teacher</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>
                <button class="secondary" style="padding: 5px 10px;" onclick="editUserProfile('${u.id}')">Edit</button>
            </td>
        </tr>
    `).join('');
}

let editingUserId = null;

window.editUserProfile = async (userId) => {
    editingUserId = userId;
    const { data: u } = await sb.from('profiles').select('*').eq('id', userId).single();

    document.getElementById('edit-user-avatar').src = u.avatar_url || 'https://ui-avatars.com/api/?name='+u.full_name;
    document.getElementById('edit-user-name-title').innerText = u.full_name || 'User';
    document.getElementById('edit-user-github-display').innerText = u.github_username ? `@${u.github_username}` : 'No GitHub';

    document.getElementById('edit-user-name').value = u.full_name || '';
    document.getElementById('edit-user-matricula').value = u.matricula || '';
    document.getElementById('edit-user-emails').value = (u.secondary_emails || []).join(', ');
    document.getElementById('edit-user-github').value = u.github_username || '';

    showSection('admin-user-edit');
};

window.saveUserProfile = async () => {
    const full_name = document.getElementById('edit-user-name').value;
    const matricula = document.getElementById('edit-user-matricula').value;
    const github_username = document.getElementById('edit-user-github').value;
    const emailsInput = document.getElementById('edit-user-emails').value;
    const secondary_emails = emailsInput.split(',').map(e => e.trim()).filter(e => e !== '');

    if (matricula && !/^UNRN-[0-9]+$/.test(matricula)) {
        return alert("Invalid Matricula format. Must be UNRN-n");
    }
    if (secondary_emails.length > 3) {
        return alert("Maximum 3 secondary emails allowed.");
    }

    const { error } = await sb.from('profiles').update({
        full_name, matricula, github_username, secondary_emails
    }).eq('id', editingUserId);

    if (error) alert(error.message);
    else {
        alert("Profile updated!");
        showSection('admin-users');
    }
};

window.exportUsers = async () => {
    const { data: users } = await sb.from('profiles').select('*');
    const blob = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gaula-users-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

window.importUsers = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const users = JSON.parse(e.target.result);
            // Bulk upsert profiles (assuming users already exist in auth.users or we only update profiles)
            // In a real scenario, we might need a more complex import.
            const { error } = await sb.from('profiles').upsert(users);
            if (error) alert(error.message);
            else { alert("Users imported!"); loadAdminUsers(); }
        } catch (err) { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
};
async function updateBadges() {
    if (!currentUser || !currentProfile) return;
    const role = currentProfile.role;
    if (role === 'student') {
        const { count: msgCount } = await sb.from('direct_messages').select('*', { count: 'exact', head: true }).eq('receiver_id', currentUser.id).is('read_at', null);
        updateBadgeElement('badge-student-msgs', msgCount);
        const { count: pendingCount } = await sb.from('submissions').select('*', { count: 'exact', head: true }).eq('student_id', currentUser.id).in('status', ['sin_comenzar', 'rehacer', 'accepted']);
        updateBadgeElement('badge-student-pending', pendingCount);
    }
    if (role === 'teacher') {
        const { count: msgCount } = await sb.from('direct_messages').select('*', { count: 'exact', head: true }).eq('receiver_id', currentUser.id).is('read_at', null);
        updateBadgeElement('badge-teacher-msgs', msgCount);
        const { data: courses } = await sb.from('course_teachers').select('course_id').eq('teacher_id', currentUser.id);
        const { count: toGradeCount } = await sb.from('submissions').select('*, assignments!inner(course_id)', { count: 'exact', head: true }).in('assignments.course_id', courses.map(c => c.id)).eq('status', 'sin_corregir');
        updateBadgeElement('badge-teacher-pending', toGradeCount);
    }
}
function updateBadgeElement(id, count) {
    const el = document.getElementById(id); if (!el) return;
    if (count > 0) { el.innerText = count; el.classList.remove('hidden'); } else el.classList.add('hidden');
}

// --- Admin ---
async function loadAdminCourses() {
    const { data } = await sb.from('courses').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('admin-courses-list');
    container.innerHTML = data.map(c => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 id="course-title-${c.id}">${c.name}</h3>
                <p style="color: #666; font-size: 0.9em;">
                    <a href="https://github.com/${c.github_org}" target="_blank">github.com/${c.github_org}</a>
                </p>
            </div>
            <div style="display:flex; gap:5px;">
                <button class="secondary" onclick="editCourseName('${c.id}', '${c.name}')">Edit</button>
                <button class="secondary" onclick="viewCourseTeachers('${c.id}', '${c.name}')">Teachers</button>
                <button class="secondary" onclick="exportCourse('${c.id}', '${c.name}')">Export</button>
            </div>
        </div>
    `).join('');
}

window.editCourseName = async (courseId, currentName) => {
    const newName = prompt("Enter new course name:", currentName);
    if (!newName || newName === currentName) return;

    const { error } = await sb.from('courses').update({ name: newName }).eq('id', courseId);
    if (error) alert(error.message);
    else {
        alert("Course updated!");
        loadAdminCourses();
    }
};

let adminSelectedCourseId = null;

window.viewCourseTeachers = async (courseId, courseName) => {
    adminSelectedCourseId = courseId;
    document.getElementById('admin-teacher-course-title').innerText = `Manage Teachers: ${courseName}`;
    showSection('admin-course-teachers');
    
    // Load all teachers for the dropdown
    const { data: allTeachers } = await sb.from('profiles').select('id, full_name').eq('role', 'teacher');
    document.getElementById('admin-all-teachers-list').innerHTML = '<option value="">Select Teacher</option>' + 
        allTeachers.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('');

    // Load currently assigned teachers
    loadAssignedTeachers();
};

async function loadAssignedTeachers() {
    const { data: assigned } = await sb.from('course_teachers').select('*, profiles(full_name)').eq('course_id', adminSelectedCourseId);
    document.getElementById('admin-assigned-teachers-list').innerHTML = assigned.map(a => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <span>${a.profiles.full_name}</span>
            <button class="danger" style="padding:5px 10px;" onclick="removeTeacherFromCourse('${a.teacher_id}')">Remove</button>
        </div>
    `).join('') || '<p>No teachers assigned yet.</p>';
}

window.assignTeacherToCourse = async () => {
    const teacherId = document.getElementById('admin-all-teachers-list').value;
    if (!teacherId) return;

    const { error } = await sb.from('course_teachers').insert([{ course_id: adminSelectedCourseId, teacher_id: teacherId }]);
    if (error) alert(error.message); else loadAssignedTeachers();
};

window.removeTeacherFromCourse = async (teacherId) => {
    const { error } = await sb.from('course_teachers').delete().eq('course_id', adminSelectedCourseId).eq('teacher_id', teacherId);
    if (error) alert(error.message); else loadAssignedTeachers();
};
window.createCourse = async () => {
    const name = document.getElementById('course-name').value;
    const org = document.getElementById('course-org').value;
    const { error } = await sb.from('courses').insert([{ name, github_org: org, created_by: currentUser.id }]);
    if (!error) loadAdminCourses();
};
window.exportCourse = async (courseId, name) => {
    const { data: assignments } = await sb.from('assignments').select('title, description, template_repo_url').eq('course_id', courseId);
    const { data: schedules } = await sb.from('course_schedules').select('day_of_week, start_time, end_time').eq('course_id', courseId);
    const { data: plan } = await sb.from('course_plan_items').select('title, description, topic_date, recording_url, materials_url').eq('course_id', courseId);
    const { data: events } = await sb.from('course_events').select('title, description, event_date, is_external').eq('course_id', courseId);
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
        const { data: newCourse, error } = await sb.from('courses').insert([{ name, github_org: org, created_by: currentUser.id }]).select().single();
        if (error) return alert(error.message);
        if (data.assignments?.length) await sb.from('assignments').insert(data.assignments.map(x => ({ ...x, course_id: newCourse.id })));
        if (data.schedules?.length) await sb.from('course_schedules').insert(data.schedules.map(x => ({ ...x, course_id: newCourse.id })));
        if (data.plan?.length) await sb.from('course_plan_items').insert(data.plan.map(x => ({ ...x, course_id: newCourse.id })));
        if (data.events?.length) await sb.from('course_events').insert(data.events.map(x => ({ ...x, course_id: newCourse.id })));
        alert("Imported!"); loadAdminCourses();
    };
    reader.readAsText(file);
};

// --- Teacher ---
async function loadTeacherCourses() {
    const { data } = await sb.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    document.getElementById('teacher-courses-list').innerHTML = data.map(c => `<div class="card"><h3>${c.name}</h3><button onclick="showSection('teacher-assignments')">Assignments</button></div>`).join('');
    document.getElementById('assignment-course-id').innerHTML = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
async function loadTeacherAssignments() {
    const { data } = await sb.from('assignments').select('*, courses!inner(course_teachers!inner(teacher_id))').eq('courses.course_teachers.teacher_id', currentUser.id);
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
    const { data: subs } = await sb.from('submissions').select('*, profiles(full_name, user_metadata)').eq('assignment_id', activeAssignmentId);
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
    await sb.functions.invoke('github-classroom-actions', { body: { action: 'TOGGLE_REPO_ACCESS', submissionId, lock } });
    loadingIndicator.classList.add('hidden'); loadSubmissionsTable();
};
window.massToggleAccess = async (lock) => {
    if (!confirm(`Mass ${lock ? 'LOCK' : 'UNLOCK'}?`)) return;
    loadingIndicator.classList.remove('hidden');
    await sb.functions.invoke('github-classroom-actions', { body: { action: 'MASS_TOGGLE_ACCESS', assignmentId: activeAssignmentId, lock } });
    loadingIndicator.classList.add('hidden'); loadSubmissionsTable();
};
window.createAssignment = async () => {
    const course_id = document.getElementById('assignment-course-id').value;
    const title = document.getElementById('assignment-title').value;
    const template = document.getElementById('assignment-template').value;
    await sb.from('assignments').insert([{ course_id, title, template_repo_url: template }]);
    loadTeacherAssignments();
};

async function loadTeacherAttendanceData() {
    const { data } = await sb.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    const html = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('schedule-course-id').innerHTML = html;
    document.getElementById('session-course-id').innerHTML = html;
}
window.addSchedule = async () => {
    const course_id = document.getElementById('schedule-course-id').value;
    const day = parseInt(document.getElementById('schedule-day').value);
    const start = document.getElementById('schedule-start').value;
    const end = document.getElementById('schedule-end').value;
    await sb.from('course_schedules').insert([{ course_id, day_of_week: day, start_time: start, end_time: end }]);
    alert("Added!");
};
window.startSession = async () => {
    const course_id = document.getElementById('session-course-id').value;
    const { data } = await sb.from('class_sessions').insert([{ course_id, scheduled_at: new Date().toISOString(), otp_secret: Math.random().toString(36).substring(2, 15) }]).select().single();
    document.getElementById('qr-container').classList.remove('hidden');
    updateQR(data.id); qrInterval = setInterval(() => updateQR(data.id), 10000);
};
async function updateQR(sessionId) {
    const { data } = await sb.functions.invoke('attendance-handler', { body: { action: 'GENERATE_QR_TOKEN', sessionId } });
    if (data?.token) {
        QRCode.toCanvas(document.getElementById('qr-canvas'), JSON.stringify({ s: sessionId, t: data.token }), { width: 300 });
        let timeLeft = 10; const timerEl = document.getElementById('qr-timer');
        const t = setInterval(() => { timeLeft--; timerEl.innerText = timeLeft; if (timeLeft <= 0) clearInterval(t); }, 1000);
    }
}
window.stopSession = () => { clearInterval(qrInterval); document.getElementById('qr-container').classList.add('hidden'); };

async function loadTeacherCurriculumData() {
    const { data } = await sb.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    document.getElementById('curriculum-course-id').innerHTML = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
window.addCurriculumItem = async () => {
    const cid = document.getElementById('curriculum-course-id').value;
    await sb.from('course_plan_items').insert([{ course_id: cid, topic_date: document.getElementById('curriculum-date').value, title: document.getElementById('curriculum-title').value }]);
    alert("Saved!");
};
window.addCourseEvent = async () => {
    const cid = document.getElementById('curriculum-course-id').value;
    await sb.from('course_events').insert([{ course_id: cid, event_date: document.getElementById('event-date').value, title: document.getElementById('event-title').value }]);
    alert("Event Added!");
};

async function loadTeacherCommsData() {
    const { data: courses } = await sb.from('courses').select(`*, course_teachers!inner(teacher_id)`).eq('course_teachers.teacher_id', currentUser.id);
    document.getElementById('ann-course-id').innerHTML = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const { data: students } = await sb.from('course_roster').select('student_id, student_email').in('course_id', courses.map(c => c.id));
    const unique = [...new Map(students.map(s => [s.student_id, s])).values()];
    document.getElementById('dm-student-id').innerHTML = '<option value="">Select Student</option>' + unique.map(s => `<option value="${s.student_id}">${s.student_email}</option>`).join('');
}
window.postAnnouncement = async () => {
    await sb.from('course_announcements').insert([{ course_id: document.getElementById('ann-course-id').value, author_id: currentUser.id, title: document.getElementById('ann-title').value, content: document.getElementById('ann-content').value }]);
    alert("Posted!");
};
window.sendDirectMessage = async (role) => {
    const recId = document.getElementById(role === 'teacher' ? 'dm-student-id' : 'dm-teacher-id').value;
    const cont = document.getElementById(`${role}-dm-content`).value;
    await sb.from('direct_messages').insert([{ sender_id: currentUser.id, receiver_id: recId, content: cont }]);
    document.getElementById(`${role}-dm-content`).value = ''; loadChat(role, recId);
};
async function loadChat(role, peerId) {
    if (!peerId) return;
    await sb.from('direct_messages').update({ read_at: new Date().toISOString(), is_read: true }).eq('receiver_id', currentUser.id).eq('sender_id', peerId).is('read_at', null);
    const { data: messages } = await sb.from('direct_messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    const chatBox = document.getElementById(`${role}-chat-box`);
    chatBox.innerHTML = messages.map(m => `<div class="message-bubble ${m.sender_id === currentUser.id ? 'sent' : 'received'}">${m.content} ${(m.sender_id === currentUser.id && m.read_at) ? '✔' : ''}</div>`).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
}
document.getElementById('dm-student-id')?.addEventListener('change', (e) => loadChat('teacher', e.target.value));
document.getElementById('dm-teacher-id')?.addEventListener('change', (e) => loadChat('student', e.target.value));

// --- Student ---
async function loadStudentCourses() {
    const { data } = await sb.from('courses').select(`*, course_roster!inner(student_id)`).eq('course_roster.student_id', currentUser.id);
    document.getElementById('student-courses-list').innerHTML = data.map(c => `<div class="card"><h3>${c.name}</h3><button onclick="viewCourseDetails('${c.id}', '${c.name}', '')">Open</button></div>`).join('');
}
window.viewCourseDetails = async (id, name, desc) => {
    document.getElementById('st-course-title').innerText = name; showSection('student-course-detail');
    const { data: curr } = await sb.from('course_plan_items').select('*').eq('course_id', id).order('topic_date');
    const { data: assign } = await sb.from('assignments').select('*, submissions(*)').eq('course_id', id);
    document.getElementById('student-timeline-list').innerHTML = curr.map(i => `<div class="curriculum-item"><strong>${i.topic_date}</strong>: ${i.title}</div>`).join('');
    document.getElementById('student-assignments-list').innerHTML = assign.map(a => `<div class="card"><h4>${a.title}</h4>${a.submissions?.[0] ? 'Accepted' : `<button onclick="acceptAssignment('${a.id}')">Accept</button>`}</div>`).join('');
};
window.acceptAssignment = async (id) => { await sb.functions.invoke('github-classroom-actions', { body: { action: 'ACCEPT_ASSIGNMENT', assignmentId: id } }); location.reload(); };
async function loadStudentCommsData() {
    const { data: roster } = await sb.from('course_roster').select('course_id').eq('student_id', currentUser.id);
    const { data: anns } = await sb.from('course_announcements').select('*, courses(name)').in('course_id', roster.map(r => r.course_id)).order('created_at', { ascending: false });
    document.getElementById('student-announcements-list').innerHTML = anns.map(a => `<div class="card announcement-card"><small>${a.courses.name}</small><h4>${a.title}</h4><p>${a.content}</p></div>`).join('');
    const { data: teachers } = await sb.from('course_teachers').select('teacher_id, courses(name)').in('course_id', roster.map(r => r.course_id));
    document.getElementById('dm-teacher-id').innerHTML = '<option value="">Select Teacher</option>' + teachers.map(t => `<option value="${t.teacher_id}">${t.courses.name}</option>`).join('');
}
function startScanner() {
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
        const { s, t } = JSON.parse(txt);
        await sb.functions.invoke('attendance-handler', { body: { action: 'MARK_ATTENDANCE', sessionId: s, token: t } });
        alert("Marked!"); html5QrCode.stop(); showSection('student-courses');
    });
}
function stopScanner() { if (html5QrCode?.isScanning) html5QrCode.stop(); }
