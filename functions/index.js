const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const crypto = require('crypto');
admin.initializeApp();

const db = admin.firestore();

exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    let role = 'student';
    if (user.email === 'admin@jutsu.com' || user.email === 'admin@gaula.com') role = 'admin';
    if (user.email === 'teacher@jutsu.com' || user.email === 'teacher@gaula.com') role = 'teacher';

    const profileData = {
        id: user.uid,
        full_name: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
        email: user.email,
        role: role,
        avatar_url: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}`,
        account_status: role === 'student' ? 'pending' : 'approved',
        created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('profiles').doc(user.uid).set(profileData);
});

exports.api = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
    const uid = context.auth.uid;
    const { action, payload } = data;
    
    // Helper to get user profile
    const getMyProfile = async () => (await db.collection('profiles').doc(uid).get()).data();
    
    try {
        if (action === 'getProfile') {
            return await getMyProfile();
        }

        if (action === 'approveUser') {
        const { targetUid } = payload;
        const myProfile = await getMyProfile();
        if (myProfile.role !== 'admin') throw new Error("Solo admins pueden aprobar usuarios");
        
        await db.collection('profiles').doc(targetUid).update({
            account_status: 'approved'
        });
        return { success: true };
    }

    if (action === 'updateUserRole') {
        const { targetUid, newRole } = payload;
        const myProfile = await getMyProfile();
        if (myProfile.role !== 'admin') throw new Error("Solo admins pueden cambiar roles de usuario");
        if (!['admin', 'teacher', 'student'].includes(newRole)) throw new Error("Rol inválido");
        
        await db.collection('profiles').doc(targetUid).update({
            role: newRole
        });
        return { success: true };
    }

    if (action === 'submitMatricula') {
            const { matricula } = payload;
            if (!matricula || !/^UNRN-\d{5,}$/.test(matricula)) {
                throw new Error("Formato de matrícula inválido. Debe ser UNRN- seguido de al menos 5 dígitos.");
            }
            await db.collection('profiles').doc(uid).update({
                matricula_unrn: matricula,
                account_status: 'approved'
            });
            return { success: true };
        }

        if (action === 'markAttendance') {
            const { courseId, classId } = payload;
            if (!courseId || !classId) throw new Error("Faltan datos de la clase");
            
            // Check enrollment
            const enrollmentRef = db.collection('enrollments').doc(`${uid}_${courseId}`);
            const doc = await enrollmentRef.get();
            if (!doc.exists) throw new Error("No estás inscripto en este curso");
            
            // Mark attendance
            const attendanceRef = db.collection('attendance').doc(`${courseId}_${classId}_${uid}`);
            await attendanceRef.set({
                course_id: courseId,
                class_id: classId,
                student_id: uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        }
        if (action === 'updateProfile') {
            await db.collection('profiles').doc(uid).update(payload);
            return { success: true };
        }
        
        if (action === 'getAdminUsers') {
            const snap = await db.collection('profiles').get();
            const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            users.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
            return users;
        }
        
        if (action === 'updateUserProfile') {
            await db.collection('profiles').doc(payload.userId).update(payload.data);
            return { success: true };
        }

        if (action === 'getAdminCourses') {
            const coursesSnap = await db.collection('courses').get();
            const courses = [];
            for (let doc of coursesSnap.docs) {
                const c = { id: doc.id, ...doc.data() };
                const teachersSnap = await db.collection('course_teachers').where('course_id', '==', c.id).get();
                c.course_teachers = [];
                for (let tdoc of teachersSnap.docs) {
                    const tdata = tdoc.data();
                    const profSnap = await db.collection('profiles').doc(tdata.teacher_id).get();
                    c.course_teachers.push({
                        teacher_id: tdata.teacher_id,
                        profiles: profSnap.data()
                    });
                }
                courses.push(c);
            }
            courses.sort((a, b) => {
                const tA = a.created_at ? (a.created_at.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at).getTime()) : 0;
                const tB = b.created_at ? (b.created_at.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at).getTime()) : 0;
                return tB - tA;
            });
            return courses;
        }

        
        if (action === 'getGlobalSettings') {
            const snap = await db.collection('globals').doc('settings').get();
            return snap.exists ? snap.data() : {};
        }

        if (action === 'saveGlobalSettings') {
            if (role !== 'admin') throw new functions.https.HttpsError('permission-denied', 'Only admin can save global settings');
            await db.collection('globals').doc('settings').set(payload, { merge: true });
            return { success: true };
        }

        if (action === 'getAdminCourseDetails') {
            const courseId = payload.courseId;
            const cSnap = await db.collection('courses').doc(courseId).get();
            if (!cSnap.exists) throw new Error("Course not found");
            const course = cSnap.data();
            course.id = courseId;
            
            // Get teachers
            const tSnap = await db.collection('course_teachers').where('course_id', '==', courseId).get();
            course.teachers = [];
            for (let doc of tSnap.docs) {
                const tdata = doc.data();
                const pSnap = await db.collection('profiles').doc(tdata.teacher_id).get();
                course.teachers.push(pSnap.data());
            }
            
            // Get students
            const rSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
            course.students = [];
            for (let doc of rSnap.docs) {
                const sdata = doc.data();
                const pSnap = await db.collection('profiles').doc(sdata.student_id).get();
                course.students.push(pSnap.data());
            }

            // Get assignments
            const aSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
            course.assignments = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            return course;
        }

        if (action === 'getCourseDetails') {
            const courseId = payload.courseId;
            const rosterSnap = await db.collection('course_roster').doc(`${courseId}_${uid}`).get();
            const teacherSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
            const enrollSnap = await db.collection('enrollments').where('course_id', '==', courseId).where('student_id', '==', uid).get();
            const myProfile = await getMyProfile();
            
            if (!rosterSnap.exists && !teacherSnap.exists && enrollSnap.empty && myProfile.role !== 'admin') {
                throw new Error("No tienes acceso a este curso");
            }
            
            const cSnap = await db.collection('courses').doc(courseId).get();
            if (!cSnap.exists) throw new Error("Curso no encontrado");
            
            return { id: cSnap.id, ...cSnap.data() };
        }

        if (action === 'enrollCourse') {
            const code = payload.code.trim();
            const snap = await db.collection('courses').where('invite_code', '==', code).get();
            if (!snap.empty) {
                const courseId = snap.docs[0].id;
                await db.collection('course_roster').doc(`${courseId}_${uid}`).set({
                    course_id: courseId,
                    student_id: uid,
                    enrolled_at: admin.firestore.FieldValue.serverTimestamp()
                });
                return { success: true };
            }

            const tSnap = await db.collection('courses').where('teacher_invite_code', '==', code).get();
            if (!tSnap.empty) {
                const courseId = tSnap.docs[0].id;
                await db.collection('course_teachers').doc(`${courseId}_${uid}`).set({
                    course_id: courseId,
                    teacher_id: uid,
                    role: 'titular'
                });
                await db.collection('profiles').doc(uid).update({ role: 'teacher', account_status: 'approved' });
                return { success: true };
            }
            
            const aSnap = await db.collection('courses').where('assistant_invite_code', '==', code).get();
            if (!aSnap.empty) {
                const courseId = aSnap.docs[0].id;
                await db.collection('course_teachers').doc(`${courseId}_${uid}`).set({
                    course_id: courseId,
                    teacher_id: uid,
                    role: 'ayudante'
                });
                // Assign teacher profile globally but course role is ayudante
                await db.collection('profiles').doc(uid).update({ role: 'teacher', account_status: 'approved' });
                return { success: true };
            }
            
            throw new Error("Course not found with that code");
        }

        if (action === 'createCourse') {
            const ref = await db.collection('courses').add({
                name: payload.name,
                github_org: payload.github_org,
                invite_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
                teacher_invite_code: 'T-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
                assistant_invite_code: 'A-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
                created_by: uid,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { id: ref.id };
        }
        
        if (action === 'updateCourseName') {
            await db.collection('courses').doc(payload.courseId).update({ name: payload.name });
            return { success: true };
        }
        
        if (action === 'getCourseTeachers') {
            const tSnap = await db.collection('course_teachers').where('course_id', '==', payload.courseId).get();
            const teachers = [];
            for (let doc of tSnap.docs) {
                const t = doc.data();
                const p = await db.collection('profiles').doc(t.teacher_id).get();
                teachers.push({ ...t, profiles: p.data() });
            }
            return teachers;
        }
        
        if (action === 'assignTeacher') {
            await db.collection('course_teachers').doc(`${payload.courseId}_${payload.teacherId}`).set({
                course_id: payload.courseId,
                teacher_id: payload.teacherId
            });
            return { success: true };
        }
        
        if (action === 'removeTeacher') {
            await db.collection('course_teachers').doc(`${payload.courseId}_${payload.teacherId}`).delete();
            return { success: true };
        }
        
        if (action === 'getTeacherCourses') {
            const snap = await db.collection('course_teachers').where('teacher_id', '==', uid).get();
            const courses = [];
            for (let doc of snap.docs) {
                const cSnap = await db.collection('courses').doc(doc.data().course_id).get();
                if(cSnap.exists) courses.push({ id: cSnap.id, course_role: doc.data().role || 'titular', ...cSnap.data() });
            }
            return courses;
        }

        if (action === 'getCourseSettings') {
            const courseId = payload.courseId;
            const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
            if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
            
            const cSnap = await db.collection('courses').doc(courseId).get();
            let data = cSnap.data();
            let needsUpdate = false;
            
            if (!data.invite_code) {
                data.invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
                needsUpdate = true;
            }
            if (!data.teacher_invite_code) {
                data.teacher_invite_code = 'T-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                needsUpdate = true;
            }
            if (!data.assistant_invite_code) {
                data.assistant_invite_code = 'A-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await db.collection('courses').doc(courseId).update({
                    invite_code: data.invite_code,
                    teacher_invite_code: data.teacher_invite_code,
                    assistant_invite_code: data.assistant_invite_code
                });
            }
            
            return { id: cSnap.id, ...data };
        }

        if (action === 'updateCourseSettings') {
            const courseId = payload.courseId;
            const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
            if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
            if (accessSnap.data().role === 'ayudante') throw new Error("Los ayudantes de cátedra no pueden modificar la planificación base.");
            
            await db.collection('courses').doc(courseId).update(payload.data);
            return { success: true };
        }

        if (action === 'notifyCourseStudents') {
            const { courseId, message, link } = payload;
            // Check teacher auth
            const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
            if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
            
            const studentsSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
            
            // Batch writes are limited to 500, but courses shouldn't have more than 500 for now. 
            // If they do, we'd need chunks, but let's keep it simple.
            const chunks = [];
            let currentBatch = db.batch();
            let count = 0;
            
            for (let doc of studentsSnap.docs) {
                const sData = doc.data();
                const studentId = sData.student_id;
                
                let is_daily_pending = false;
                const pSnap = await db.collection('profiles').doc(studentId).get();
                if (pSnap.exists && pSnap.data().notification_pref === 'daily_summary') {
                    is_daily_pending = true;
                }
                
                const ref = db.collection('notifications').doc();
                currentBatch.set(ref, {
                    student_id: studentId,
                    message,
                    link: link || null,
                    read: false,
                    is_daily_pending,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
                if (count === 490) {
                    chunks.push(currentBatch.commit());
                    currentBatch = db.batch();
                    count = 0;
                }
            }
            if (count > 0) chunks.push(currentBatch.commit());
            await Promise.all(chunks);
            return { success: true };
        }

        if (action === 'getStudentNotifications') {
            const snap = await db.collection('notifications')
                .where('student_id', '==', uid)
                .orderBy('created_at', 'desc')
                .limit(50)
                .get();
            // Filter out pending daily summaries
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(n => !n.is_daily_pending);
            return list.slice(0, 20);
        }

        if (action === 'markNotificationsRead') {
            const snap = await db.collection('notifications')
                .where('student_id', '==', uid)
                .where('read', '==', false)
                .get();
            const batch = db.batch();
            snap.docs.forEach(doc => batch.update(doc.ref, { read: true }));
            await batch.commit();
            return { success: true };
        }

        if (action === 'cloneCourseExtraData') {
            const { sourceCourseId, targetCourseId } = payload;
            const accessSource = await db.collection('course_teachers').doc(`${sourceCourseId}_${uid}`).get();
            const accessTarget = await db.collection('course_teachers').doc(`${targetCourseId}_${uid}`).get();
            if (!accessSource.exists || !accessTarget.exists) throw new Error("No tienes acceso a las materias para clonar");
            if (accessTarget.data().role === 'ayudante') throw new Error("Los ayudantes de cátedra no pueden clonar material hacia esta materia.");
            
            const aSnap = await db.collection('assignments').where('course_id', '==', sourceCourseId).get();
            for (let doc of aSnap.docs) {
                const data = doc.data();
                data.course_id = targetCourseId;
                await db.collection('assignments').add(data);
            }
            
            const anSnap = await db.collection('announcements').where('course_id', '==', sourceCourseId).get();
            for (let doc of anSnap.docs) {
                const data = doc.data();
                data.course_id = targetCourseId;
                await db.collection('announcements').add(data);
            }
            return { success: true };
        }

        
        if (action === 'archiveAssignment') {
            const assignmentSnap = await db.collection('assignments').doc(payload.assignmentId).get();
            if (!assignmentSnap.exists) throw new Error("Tarea no encontrada");
            const assignment = assignmentSnap.data();
            
            const courseSnap = await db.collection('courses').doc(assignment.course_id).get();
            const course = courseSnap.data();
            if (!course.github_org || !course.github_token) throw new Error("Falta la configuración de GitHub en la materia");
            
            const submissionsSnap = await db.collection('submissions').where('assignment_id', '==', payload.assignmentId).get();
            
            let count = 0;
            for (let doc of submissionsSnap.docs) {
                const sub = doc.data();
                if (!sub.github_url) continue;
                
                // Extract repo name from https://github.com/org/repo
                const parts = sub.github_url.split('/');
                const orgName = parts[parts.length - 2];
                const repoName = parts[parts.length - 1];
                
                // Get collaborators
                const listResp = await fetch(`https://api.github.com/repos/${orgName}/${repoName}/collaborators`, {
                    headers: {
                        'Authorization': `token ${course.github_token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (listResp.ok) {
                    const collabs = await listResp.json();
                    for (let c of collabs) {
                        // Skip admin/org owners which usually have admin rights by default
                        // We set individual students to 'push', so we downgrade to 'pull'
                        if (c.permissions && !c.permissions.admin) {
                            await fetch(`https://api.github.com/repos/${orgName}/${repoName}/collaborators/${c.login}`, {
                                method: 'PUT',
                                headers: {
                                    'Authorization': `token ${course.github_token}`,
                                    'Accept': 'application/vnd.github.v3+json',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ permission: 'pull' })
                            });
                        }
                    }
                    count++;
                }
            }
            return { success: true, count };
        }

        if (action === 'getTeacherAssignments') {
            const tSnap = await db.collection('course_teachers').where('teacher_id', '==', uid).get();
            const courseIds = tSnap.docs.map(d => d.data().course_id);
            if (courseIds.length === 0) return [];
            
            // Cannot 'in' with > 10, but assuming few courses for demo
            const aSnap = await db.collection('assignments').where('course_id', 'in', courseIds).get();
            
            const results = [];
            for (let d of aSnap.docs) {
                let data = d.data();
                if (!data.sync_secret) {
                    data.sync_secret = crypto.randomBytes(16).toString('hex');
                    await d.ref.update({ sync_secret: data.sync_secret });
                }
                results.push({ id: d.id, ...data });
            }
            return results;
        }
        
        if (action === 'createAssignment') {
            const sync_secret = crypto.randomBytes(16).toString('hex');
            await db.collection('assignments').add({
                sync_secret,
                ...payload,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }
        
        if (action === 'getAssignmentSubmissions') {
            const snap = await db.collection('submissions').where('assignment_id', '==', payload.assignmentId).get();
            const subs = [];
            for (let doc of snap.docs) {
                const s = doc.data();
                const p = await db.collection('profiles').doc(s.student_id).get();
                subs.push({ id: doc.id, ...s, profiles: p.data() });
            }
            return subs;
        }

        if (action === 'toggleAccess') {
            await db.collection('submissions').doc(payload.submissionId).update({ is_locked: payload.lock });
            return { success: true };
        }
        
        if (action === 'massToggleAccess') {
            const subs = await db.collection('submissions').where('assignment_id', '==', payload.assignmentId).get();
            const batch = db.batch();
            subs.forEach(doc => batch.update(doc.ref, { is_locked: payload.lock }));
            await batch.commit();
            return { success: true };
        }
        
        
        if (action === 'getTeacherDashboardStats') {
            const cSnap = await db.collection('course_teachers').where('teacher_id', '==', uid).get();
            const courseIds = cSnap.docs.map(d => d.data().course_id);
            if (courseIds.length === 0) return { pendingCorrections: 0 };
            
            // Note: Since Firestore "in" queries are limited to 10 elements, if a teacher has many courses we chunk it
            // For now, let's just get ALL submissions where grade == '' and see if they belong to our courses.
            // Wait, getting ALL ungraded submissions in the system is bad.
            // Better to fetch assignments for our courses, then fetch submissions for those assignments.
            let pendingCorrections = 0;
            const chunks = [];
            for (let i = 0; i < courseIds.length; i += 10) {
                chunks.push(courseIds.slice(i, i + 10));
            }
            
            for (const chunk of chunks) {
                const aSnap = await db.collection('assignments').where('course_id', 'in', chunk).get();
                const assignmentIds = aSnap.docs.map(d => d.id);
                if (assignmentIds.length === 0) continue;
                
                const aChunks = [];
                for (let j = 0; j < assignmentIds.length; j += 10) {
                    aChunks.push(assignmentIds.slice(j, j + 10));
                }
                
                for (const achunk of aChunks) {
                    const sSnap = await db.collection('submissions').where('assignment_id', 'in', achunk).where('grade', '==', '').get();
                    pendingCorrections += sSnap.size;
                }
            }
            return { pendingCorrections };
        }

        if (action === 'getCourseDashboardStats') {
            const { courseId } = payload;
            
            // Check teacher auth
            const ctSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
            if (!ctSnap.exists) throw new Error("No tienes acceso a las estadísticas de este curso");

            const courseSnap = await db.collection('courses').doc(courseId).get();
            const courseData = courseSnap.data();
            const totalClasses = courseData.class_instances ? courseData.class_instances.length : 0;
            
            const studentsSnap = await db.collection('enrollments').where('course_id', '==', courseId).get();
            const totalStudents = studentsSnap.size;

            const assignmentsSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
            const assignmentIds = assignmentsSnap.docs.map(d => d.id);
            
            let totalSubmissions = 0;
            let pendingCorrections = 0;
            let onTimeSubmissions = 0;
            
            if (assignmentIds.length > 0) {
                const chunks = [];
                for (let i = 0; i < assignmentIds.length; i += 10) {
                    chunks.push(assignmentIds.slice(i, i + 10));
                }
                for (const chunk of chunks) {
                    const sSnap = await db.collection('submissions').where('assignment_id', 'in', chunk).get();
                    totalSubmissions += sSnap.size;
                    
                    sSnap.docs.forEach(d => {
                        const sData = d.data();
                        if (!sData.grade) pendingCorrections++;
                        
                        // Check if on time
                        const assignment = assignmentsSnap.docs.find(a => a.id === sData.assignment_id).data();
                        if (sData.submitted_at && assignment.due_date) {
                            if (sData.submitted_at.toDate() <= new Date(assignment.due_date)) {
                                onTimeSubmissions++;
                            }
                        }
                    });
                }
            }

            return {
                name: courseData.name,
                totalStudents,
                totalClasses,
                totalAssignments: assignmentIds.length,
                totalSubmissions,
                pendingCorrections,
                onTimeSubmissions
            };
        }

        if (action === 'createAnnouncement') {
            await db.collection('announcements').add({
                course_id: payload.course_id,
                message: payload.message,
                teacher_id: uid,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }
        
        if (action === 'getTeacherAnnouncements') {
            const snap = await db.collection('announcements').where('teacher_id', '==', uid).orderBy('created_at', 'desc').limit(20).get();
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            return arr;
        }
        
        if (action === 'getStudentAnnouncements') {
            const courseIds = payload.courseIds || [];
            if (courseIds.length === 0) return [];
            
            const arr = [];
            const chunks = [];
            for (let i = 0; i < courseIds.length; i += 10) {
                chunks.push(courseIds.slice(i, i + 10));
            }
            
            for (const chunk of chunks) {
                const snap = await db.collection('announcements').where('course_id', 'in', chunk).orderBy('created_at', 'desc').limit(10).get();
                for (let doc of snap.docs) {
                    const data = doc.data();
                    const ackRef = db.collection('announcement_acknowledgments').doc(`${doc.id}_${uid}`);
                    const ackDoc = await ackRef.get();
                    arr.push({
                        id: doc.id,
                        ...data,
                        acknowledged: ackDoc.exists
                    });
                }
            }
            // Sort by created_at descending
            arr.sort((a, b) => {
                const da = a.created_at ? a.created_at.toMillis() : 0;
                const db2 = b.created_at ? b.created_at.toMillis() : 0;
                return db2 - da;
            });
            return arr;
        }

        if (action === 'getStudentCourses') {
            const rosterSnap = await db.collection('course_roster').where('student_id', '==', uid).get();
            const enrollSnap = await db.collection('enrollments').where('student_id', '==', uid).get();
            const courseIds = new Set();
            rosterSnap.docs.forEach(d => courseIds.add(d.data().course_id));
            enrollSnap.docs.forEach(d => courseIds.add(d.data().course_id));
            
            const courses = [];
            for (const courseId of courseIds) {
                const cSnap = await db.collection('courses').doc(courseId).get();
                if (cSnap.exists) courses.push({ id: cSnap.id, ...cSnap.data() });
            }
            return courses;
        }

        if (action === 'acknowledgeAnnouncement') {
            const { announcementId } = payload;
            await db.collection('announcement_acknowledgments').doc(`${announcementId}_${uid}`).set({
                announcement_id: announcementId,
                student_id: uid,
                acknowledged_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }

        if (action === 'getAnnouncementAcknowledgements') {
            const { announcementId } = payload;
            const snap = await db.collection('announcement_acknowledgments').where('announcement_id', '==', announcementId).get();
            const acknowledgments = [];
            for (let doc of snap.docs) {
                const data = doc.data();
                const pSnap = await db.collection('profiles').doc(data.student_id).get();
                acknowledgments.push({
                    student_id: data.student_id,
                    acknowledged_at: data.acknowledged_at,
                    profile: pSnap.data()
                });
            }
            return acknowledgments;
        }

        if (action === 'getCourseRoster') {
            const snap = await db.collection('course_roster').where('course_id', '==', payload.courseId).get();
            const students = [];
            for (let doc of snap.docs) {
                const pSnap = await db.collection('profiles').doc(doc.data().student_id).get();
                if(pSnap.exists) students.push(pSnap.data());
            }
            return students;
        }

        if (action === 'getStudentAssignments') {
            const courseIds = payload.courseIds || [];
            if (courseIds.length === 0) return { assignments: [], submissions: [] };
            
            const snap = await db.collection('assignments').where('course_id', 'in', courseIds).get();
            const assignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const subsSnap = await db.collection('submissions').where('student_id', '==', uid).get();
            const submissions = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            return { assignments, submissions };
        }

        
        if (action === 'addGroupCollaborator') {
            const subSnap = await db.collection('submissions').doc(payload.submissionId).get();
            if (!subSnap.exists) throw new Error("Entrega no encontrada");
            const sub = subSnap.data();
            
            const pSnap = await db.collection('profiles').where('email', '==', payload.email).get();
            if (pSnap.empty) throw new Error("No se encontró ningún estudiante registrado con ese correo");
            const newStudent = pSnap.docs[0].data();
            const newStudentId = pSnap.docs[0].id;
            
            if (!newStudent.github_user) throw new Error("El estudiante no configuró su usuario de GitHub en el perfil");
            
            const assignmentSnap = await db.collection('assignments').doc(payload.assignmentId).get();
            const assignment = assignmentSnap.data();
            
            const courseSnap = await db.collection('courses').doc(assignment.course_id).get();
            const course = courseSnap.data();
            
            // Add collaborator via GitHub API
            const parts = sub.github_url.split('/');
            const orgName = parts[parts.length - 2];
            const repoName = parts[parts.length - 1];
            
            const addRes = await fetch(`https://api.github.com/repos/${orgName}/${repoName}/collaborators/${newStudent.github_user}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${course.github_token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ permission: 'push' })
            });
            
            if (!addRes.ok) {
                const err = await addRes.json();
                throw new Error(`Error de GitHub: ${err.message}`);
            }
            
            // Also add a submission record for the new student so they see it in their dashboard
            await db.collection('submissions').doc(`${payload.assignmentId}_${newStudentId}`).set({
                assignment_id: payload.assignmentId,
                student_id: newStudentId,
                github_url: sub.github_url,
                grade: '',
                feedback: '',
                accepted_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        }

        if (action === 'acceptAssignment') {
            const assignmentId = payload.assignmentId;
            
            const aSnap = await db.collection('assignments').doc(assignmentId).get();
            if (!aSnap.exists) throw new Error("La tarea no existe");
            const assignment = aSnap.data();
            
            const cSnap = await db.collection('courses').doc(assignment.course_id).get();
            const course = cSnap.data();
            
            const pSnap = await db.collection('profiles').doc(uid).get();
            const profile = pSnap.data();
            if (!profile.github_user) throw new Error("Debes configurar tu usuario de GitHub en tu perfil académico antes de aceptar la tarea.");
            
            if (!course.github_token) throw new Error("El profesor aún no ha configurado el token de GitHub para esta materia.");
            if (!assignment.template_repo) throw new Error("Esta tarea no tiene un repositorio de plantilla configurado.");
            
            const repoName = `${assignment.title.replace(/\s+/g, '-')}-${profile.github_user}`;
            const orgName = course.github_org;
            
            const githubHeaders = {
                'Authorization': `token ${course.github_token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'Jutsu-Classroom'
            };
            
            const templateParts = assignment.template_repo.split('/');
            const createRes = await fetch(`https://api.github.com/repos/${templateParts[0]}/${templateParts[1]}/generate`, {
                method: 'POST',
                headers: githubHeaders,
                body: JSON.stringify({ owner: orgName, name: repoName, private: true })
            });
            
            if (!createRes.ok) {
                const errBody = await createRes.text();
                throw new Error(`Error al crear repo en GitHub: ${errBody}`);
            }
            
            await fetch(`https://api.github.com/repos/${orgName}/${repoName}/collaborators/${profile.github_user}`, {
                method: 'PUT',
                headers: githubHeaders,
                body: JSON.stringify({ permission: 'push' })
            });
            
            if (assignment.create_feedback_pr) {
                await new Promise(resolve => setTimeout(resolve, 3500));
                
                const refRes = await fetch(`https://api.github.com/repos/${orgName}/${repoName}/git/ref/heads/main`, { headers: githubHeaders });
                if (refRes.ok) {
                    const refData = await refRes.json();
                    
                    await fetch(`https://api.github.com/repos/${orgName}/${repoName}/git/refs`, {
                        method: 'POST',
                        headers: githubHeaders,
                        body: JSON.stringify({ ref: 'refs/heads/feedback', sha: refData.object.sha })
                    });
                    
                    await fetch(`https://api.github.com/repos/${orgName}/${repoName}/pulls`, {
                        method: 'POST',
                        headers: githubHeaders,
                        body: JSON.stringify({
                            title: 'Feedback Automático',
                            head: 'main',
                            base: 'feedback',
                            body: 'Este PR compara tus commits contra la plantilla inicial. Tus profes te dejarán comentarios acá.'
                        })
                    });
                }
            }
            
            
            if (course.webhook_url) {
                try {
                    fetch(course.webhook_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'submission_created',
                            assignment_id: assignmentId,
                            student_id: uid,
                            student_matricula: profile.matricula_unrn,
                            github_user: profile.github_user,
                            repo_url: `https://github.com/${orgName}/${repoName}`
                        })
                    }).catch(e => console.error("Webhook error:", e));
                } catch(e) {}
            }

            const subRef = db.collection('submissions').doc();
            await subRef.set({
                assignment_id: assignmentId,
                student_id: uid,
                repo_url: `https://github.com/${orgName}/${repoName}`,
                grade: '',
                feedback: '',
                is_locked: false,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, repoUrl: `https://github.com/${orgName}/${repoName}` };
        }

        if (action === 'getStudentCommits') {
            const sSnap = await db.collection('submissions').doc(payload.submissionId).get();
            if (!sSnap.exists || sSnap.data().student_id !== uid) throw new Error("Entrega no encontrada o no autorizada");
            const sub = sSnap.data();

            const aSnap = await db.collection('assignments').doc(sub.assignment_id).get();
            const cSnap = await db.collection('courses').doc(aSnap.data().course_id).get();
            const token = cSnap.data().github_token;
            if (!token) throw new Error("El profesor no configuró el token de GitHub.");

            const repoParts = sub.repo_url.replace('https://github.com/', '').split('/');
            
            const githubHeaders = {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'Jutsu-Classroom'
            };

            const res = await fetch(`https://api.github.com/repos/${repoParts[0]}/${repoParts[1]}/commits?per_page=5`, {
                method: 'GET',
                headers: githubHeaders
            });

            if (!res.ok) throw new Error("Error obteniendo commits: " + await res.text());
            const commits = await res.json();
            
            return commits.map(c => ({
                sha: c.sha,
                message: c.commit.message,
                date: c.commit.author.date,
                url: c.html_url
            }));
        }

        if (action === 'submitAssignment') {
            const sSnap = await db.collection('submissions').doc(payload.submissionId).get();
            if (!sSnap.exists || sSnap.data().student_id !== uid) throw new Error("Entrega no encontrada o no autorizada");
            
            await sSnap.ref.update({
                status: 'submitted',
                student_message: payload.message || '',
                submitted_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        }

        if (action === 'updateAssignment') {
            await db.collection('assignments').doc(payload.assignmentId).update(payload.data);
            return { success: true };
        }

        if (action === 'syncGradesFromSpreadsheet') {
            const assignmentId = payload.assignmentId;
            const sheetUrl = payload.sheetUrl;
            
            const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (!match) throw new Error("URL de Google Sheets inválida. Asegurate de copiar el enlace completo.");
            const docId = match[1];
            
            let gid = "0";
            const gidMatch = sheetUrl.match(/gid=([0-9]+)/);
            if (gidMatch) gid = gidMatch[1];
            
            const csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
            
            const response = await fetch(csvUrl);
            if (!response.ok) throw new Error("No se pudo acceder a la planilla. ¿Está configurada como 'Cualquier persona con el enlace puede leer'?");
            
            const csvText = await response.text();
            const rows = csvText.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
            if (rows.length < 2) throw new Error("La planilla está vacía o no tiene el formato correcto.");
            
            const headers = rows[0].map(h => h.toLowerCase());
            const matriculaIdx = headers.findIndex(h => h.includes('matricula') || h.includes('matrícula'));
            const notaIdx = headers.findIndex(h => h.includes('nota') || h.includes('calificacion'));
            const feedbackIdx = headers.findIndex(h => h.includes('feedback') || h.includes('devolucion') || h.includes('comentario'));
            
            if (matriculaIdx === -1 || notaIdx === -1) {
                throw new Error("La planilla debe tener al menos las columnas 'Matricula' y 'Nota'. Podés descargar la plantilla sugerida.");
            }
            
            let updatedCount = 0;
            const batch = db.batch();
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[matriculaIdx]) continue;
                
                const matricula = row[matriculaIdx];
                const nota = row[notaIdx] || '';
                const feedback = feedbackIdx !== -1 ? (row[feedbackIdx] || '') : '';
                
                if (!nota && !feedback) continue;
                
                const pSnap = await db.collection('profiles').where('matricula_unrn', '==', matricula).get();
                if (pSnap.empty) continue;
                
                const studentId = pSnap.docs[0].id;
                
                const sSnap = await db.collection('submissions')
                    .where('assignment_id', '==', assignmentId)
                    .where('student_id', '==', studentId)
                    .get();
                    
                if (!sSnap.empty) {
                    batch.update(sSnap.docs[0].ref, { grade: nota, feedback: feedback, graded_at: admin.firestore.FieldValue.serverTimestamp() });
                } else {
                    const newSubRef = db.collection('submissions').doc();
                    batch.set(newSubRef, {
                        assignment_id: assignmentId,
                        student_id: studentId,
                        repo_url: '',
                        grade: nota,
                        feedback: feedback,
                        is_locked: false,
                        graded_at: admin.firestore.FieldValue.serverTimestamp(),
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                updatedCount++;
            }
            
            await batch.commit();
            return { success: true, updatedCount };
        }


    } catch (e) {
        throw new functions.https.HttpsError('internal', e.message);
    }
});

exports.calendar = functions.https.onRequest(async (req, res) => {
    const courseId = req.query.id;
    if (!courseId) return res.status(400).send('Falta el ID del curso');
    
    try {
        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send('Curso no encontrado');
        
        const course = cSnap.data();
        
        let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Jutsu Classroom//ES\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:" + (course.name || "Cursada") + "\r\n";
        
        if (course.class_instances && course.class_instances.length > 0) {
            course.class_instances.forEach((ci, idx) => {
                if (ci.special_status === 'Feriado') return; // Do not emit event for cancelled/holiday classes
                
                const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                
                const startDt = new Date(ci.date);
                const endDt = new Date(startDt.getTime() + 2 * 3600000); // Assume 2 hours
                
                let title = `${course.name} - ${ci.type}`;
                if (ci.special_status === 'Examen') title = `[EXAMEN] ${title}`;
                if (ci.special_status === 'Clase Remota') title = `[REMOTA] ${title}`;
                
                let desc = ci.topic ? `Tema: ${ci.topic}\\n` : "";
                if (ci.presentation_url) desc += `Presentación: ${ci.presentation_url}\\n`;
                if (ci.recording_url) desc += `Grabación: ${ci.recording_url}\\n`;

                ics += "BEGIN:VEVENT\r\n";
                ics += `UID:course_${courseId}_ci_${idx}@jutsu.classroom\r\n`;
                ics += `DTSTAMP:${formatICSDate(new Date())}\r\n`;
                ics += `DTSTART:${formatICSDate(startDt)}\r\n`;
                ics += `DTEND:${formatICSDate(endDt)}\r\n`;
                ics += `SUMMARY:${title}\r\n`;
                if (desc) ics += `DESCRIPTION:${desc}\r\n`;
                ics += "END:VEVENT\r\n";
            });
        } else if (course.start_date && course.duration_weeks && course.schedules) {
            const startStr = course.start_date;
            const [y, m, d] = startStr.split('-').map(Number);
            const baseDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
            
            const dayMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
            const rruleDayMap = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };

            course.schedules.forEach((sch, idx) => {
                const targetDay = dayMap[sch.day];
                if (targetDay === undefined) return;
                
                let currentDay = baseDate.getUTCDay();
                let diff = targetDay - currentDay;
                if (diff < 0) diff += 7;
                
                const firstClassDate = new Date(baseDate.getTime() + diff * 86400000);
                
                const [hh, mm] = (sch.time || "00:00").split(':').map(Number);
                firstClassDate.setUTCHours(hh, mm, 0);
                
                const endDate = new Date(firstClassDate.getTime() + 2 * 3600000);

                const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                ics += "BEGIN:VEVENT\r\n";
                ics += `UID:course_${courseId}_sch_${idx}@jutsu.classroom\r\n`;
                ics += `DTSTAMP:${formatICSDate(new Date())}\r\n`;
                ics += `DTSTART:${formatICSDate(firstClassDate)}\r\n`;
                ics += `DTEND:${formatICSDate(endDate)}\r\n`;
                ics += `RRULE:FREQ=WEEKLY;COUNT=${course.duration_weeks};BYDAY=${rruleDayMap[targetDay]}\r\n`;
                ics += `SUMMARY:${course.name} - ${sch.type}\r\n`;
                ics += `DESCRIPTION:Clase ${sch.type} de ${course.name}\r\n`;
                ics += "END:VEVENT\r\n";
            });
        }
        
        if (course.external_calendars && course.external_calendars.length > 0) {
            for (let url of course.external_calendars) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        const externalIcs = await response.text();
                        // Extract everything between BEGIN:VEVENT and END:VEVENT
                        const vevents = externalIcs.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi);
                        if (vevents) {
                            vevents.forEach(ev => {
                                ics += ev + "\r\n";
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error fetching external calendar:", url, err);
                }
            }
        }
        
        ics += "END:VCALENDAR\r\n";
        
        res.set({
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="cursada_${courseId}.ics"`,
            'Access-Control-Allow-Origin': '*'
        });
        res.send(ics);
    } catch (e) {
        res.status(500).send(e.message);
    }
});


exports.webhook = functions.https.onRequest(async (req, res) => {
    // Para resolver CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { assignmentId, sync_secret, grades } = req.body;
    if (!assignmentId || !sync_secret || !grades) {
        return res.status(400).send('Faltan parametros requeridos');
    }
    
    try {
        const aSnap = await db.collection('assignments').doc(assignmentId).get();
        if (!aSnap.exists) return res.status(404).send('Assignment not found');
        const assignment = aSnap.data();
        
        if (assignment.sync_secret !== sync_secret) {
            return res.status(401).send('Invalid secret');
        }
        
        const batch = db.batch();
        let updatedCount = 0;
        
        for (const g of grades) {
            if (!g.matricula || (!g.grade && !g.feedback)) continue;
            
            const pSnap = await db.collection('profiles').where('matricula_unrn', '==', g.matricula).get();
            if (pSnap.empty) continue;
            
            const studentId = pSnap.docs[0].id;
            const sSnap = await db.collection('submissions').where('assignment_id', '==', assignmentId).where('student_id', '==', studentId).get();
            
            if (!sSnap.empty) {
                batch.update(sSnap.docs[0].ref, {
                    grade: String(g.grade || ''),
                    feedback: String(g.feedback || ''),
                    graded_at: admin.firestore.FieldValue.serverTimestamp()
                });
                updatedCount++;
            } else {
                const subRef = db.collection('submissions').doc();
                batch.set(subRef, {
                    assignment_id: assignmentId,
                    student_id: studentId,
                    repo_url: '',
                    grade: String(g.grade || ''),
                    feedback: String(g.feedback || ''),
                    is_locked: false,
                    graded_at: admin.firestore.FieldValue.serverTimestamp(),
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                updatedCount++;
            }
        }
        await batch.commit();
        res.json({ success: true, updatedCount });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});


exports.exportGradesCsv = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { courseId, token } = req.query;
        if (!courseId || !token) return res.status(400).send("Falta courseId o token");

        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send("Materia no encontrada");
        const course = cSnap.data();

        if (course.sync_secret !== token) return res.status(401).send("Token inválido");

        const aSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
        const assignmentsMap = {};
        aSnap.docs.forEach(d => assignmentsMap[d.id] = d.data());
        
        let csv = "timestamp;id_entrega;email;practica-usuario;url_repositorio;comentarios_entrega;materia;practica;usuario_github\n";
        
        for (const aId of Object.keys(assignmentsMap)) {
            const assignment = assignmentsMap[aId];
            const sSnap = await db.collection('submissions').where('assignment_id', '==', aId).get();
            
            for (const doc of sSnap.docs) {
                const sub = doc.data();
                const pSnap = await db.collection('profiles').doc(sub.student_id).get();
                const profile = pSnap.exists ? pSnap.data() : {};
                
                const timestamp = sub.created_at ? sub.created_at.toDate().toISOString() : '';
                const email = profile.contact_email || profile.email || '';
                const practicaUsuario = `${assignment.title} - ${profile.full_name || ''}`;
                const urlRepo = sub.repo_url || '';
                const comentarios = sub.feedback || '';
                const materia = course.name;
                const practica = assignment.title;
                const usuarioGithub = profile.github_username || '';

                const escapeCsv = (str) => {
                    if (typeof str !== 'string') return '';
                    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                };

                csv += `${timestamp};${doc.id};${escapeCsv(email)};${escapeCsv(practicaUsuario)};${escapeCsv(urlRepo)};${escapeCsv(comentarios)};${escapeCsv(materia)};${escapeCsv(practica)};${escapeCsv(usuarioGithub)}\n`;
            }
        }

        res.set('Content-Type', 'text/csv; charset=utf-8');
        res.set('Content-Disposition', `attachment; filename="export_${courseId}.csv"`);
        res.status(200).send(csv);

    } catch (e) {
        console.error(e);
        res.status(500).send("Error interno: " + e.message);
    }
});

exports.importGrades = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { courseId, token } = req.query;
        if (!courseId || !token) return res.status(400).send("Falta courseId o token");

        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send("Materia no encontrada");
        const course = cSnap.data();

        if (course.sync_secret !== token) return res.status(401).send("Token inválido");

        let rows = [];
        const contentType = req.headers['content-type'] || '';
        
        if (contentType.includes('application/json')) {
            rows = req.body;
            if (!Array.isArray(rows)) return res.status(400).send("JSON debe ser un array");
        } else if (contentType.includes('text/csv')) {
            const csvText = req.body.toString('utf8');
            const lines = csvText.split('\n').filter(l => l.trim().length > 0);
            if (lines.length < 2) return res.status(400).send("CSV vacío o sin encabezados");
            
            const headerLine = lines[0];
            const separator = headerLine.includes(';') ? ';' : ',';
            
            const headers = headerLine.split(separator).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
            
            const idIdx = headers.findIndex(h => h.includes('id_entrega'));
            const resIdx = headers.findIndex(h => h.includes('resultado') || h.includes('nota'));
            const comIdx = headers.findIndex(h => h.includes('comentario'));
            
            if (idIdx === -1) return res.status(400).send("El CSV debe tener columna 'id_entrega'");
            
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
                rows.push({
                    id_entrega: cols[idIdx],
                    resultado: resIdx !== -1 ? cols[resIdx] : '',
                    comentario_general: comIdx !== -1 ? cols[comIdx] : ''
                });
            }
        } else {
            return res.status(400).send("Content-Type debe ser application/json o text/csv");
        }

        const batch = db.batch();
        let updatedCount = 0;

        for (const row of rows) {
            const { id_entrega, resultado, comentario_general } = row;
            if (!id_entrega) continue;
            if (!resultado && !comentario_general) continue;

            const subRef = db.collection('submissions').doc(id_entrega);
            const subSnap = await subRef.get();
            if (subSnap.exists) {
                batch.update(subRef, {
                    grade: String(resultado || ''),
                    feedback: String(comentario_general || ''),
                    graded_at: admin.firestore.FieldValue.serverTimestamp()
                });
                
                const studentId = subSnap.data().student_id;
                let is_daily_pending = false;
                const pSnap = await db.collection('profiles').doc(studentId).get();
                if (pSnap.exists && pSnap.data().notification_pref === 'daily_summary') {
                    is_daily_pending = true;
                }
                
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    student_id: studentId,
                    message: `Tu entrega ha sido corregida. ${resultado ? 'Nota: ' + resultado : ''}`,
                    link: '/estudiante/tareas',
                    read: false,
                    is_daily_pending,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                updatedCount++;
            }
        }

        await batch.commit();
        res.status(200).send({ success: true, updatedCount });

    } catch (e) {
        console.error(e);
        res.status(500).send("Error interno: " + e.message);
    }
});

exports.sendDailySummaries = functions.pubsub.schedule('every day 20:00').timeZone('America/Argentina/Buenos_Aires').onRun(async (context) => {
    try {
        const snap = await db.collection('notifications').where('is_daily_pending', '==', true).get();
        if (snap.empty) return null;
        
        const byStudent = {};
        for (let doc of snap.docs) {
            const data = doc.data();
            const studentId = data.student_id;
            if (!byStudent[studentId]) byStudent[studentId] = [];
            byStudent[studentId].push({ id: doc.id, ...data });
        }
        
        const promises = [];
        for (const [studentId, notifs] of Object.entries(byStudent)) {
            const batch = db.batch();
            
            for (const n of notifs) {
                batch.delete(db.collection('notifications').doc(n.id));
            }
            
            const summaryRef = db.collection('notifications').doc();
            batch.set(summaryRef, {
                student_id: studentId,
                message: `Resumen Diario: Tenés ${notifs.length} nuevas actualizaciones (calificaciones, cambios de clase, etc.)`,
                link: '/estudiante/notificaciones',
                read: false,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            promises.push(batch.commit());
        }
        
        await Promise.all(promises);
        console.log(`Sent daily summaries to ${Object.keys(byStudent).length} students.`);
    } catch (e) {
        console.error('Error sending daily summaries:', e);
    }
    return null;
});
