const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
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
        
        if (action === 'updateProfile') {
            await db.collection('profiles').doc(uid).update(payload);
            return { success: true };
        }
        
        if (action === 'getAdminUsers') {
            const snap = await db.collection('profiles').orderBy('full_name').get();
            return snap.docs.map(d => d.data());
        }
        
        if (action === 'updateUserProfile') {
            await db.collection('profiles').doc(payload.userId).update(payload.data);
            return { success: true };
        }

        if (action === 'getAdminCourses') {
            const coursesSnap = await db.collection('courses').orderBy('created_at', 'desc').get();
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
            return courses;
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

        if (action === 'enrollCourse') {
            const code = payload.code.trim();
            const snap = await db.collection('courses').where('invite_code', '==', code).get();
            if (snap.empty) throw new Error("Course not found with that code");
            const courseId = snap.docs[0].id;
            await db.collection('course_roster').doc(`${courseId}_${uid}`).set({
                course_id: courseId,
                student_id: uid,
                enrolled_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }

        if (action === 'createCourse') {
            const ref = await db.collection('courses').add({
                name: payload.name,
                github_org: payload.github_org,
                invite_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
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
                if(cSnap.exists) courses.push({ id: cSnap.id, ...cSnap.data() });
            }
            return courses;
        }

        if (action === 'getCourseSettings') {
            const courseId = payload.courseId;
            const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
            if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
            
            const cSnap = await db.collection('courses').doc(courseId).get();
            return { id: cSnap.id, ...cSnap.data() };
        }

        if (action === 'updateCourseSettings') {
            const courseId = payload.courseId;
            const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
            if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
            
            await db.collection('courses').doc(courseId).update(payload.data);
            return { success: true };
        }

        if (action === 'getTeacherAssignments') {
            const tSnap = await db.collection('course_teachers').where('teacher_id', '==', uid).get();
            const courseIds = tSnap.docs.map(d => d.data().course_id);
            if (courseIds.length === 0) return [];
            
            // Cannot 'in' with > 10, but assuming few courses for demo
            const aSnap = await db.collection('assignments').where('course_id', 'in', courseIds).get();
            return aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        if (action === 'createAssignment') {
            await db.collection('assignments').add({
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
        
        if (action === 'getStudentCourses') {
            const snap = await db.collection('course_roster').where('student_id', '==', uid).get();
            const courses = [];
            for (let doc of snap.docs) {
                const cSnap = await db.collection('courses').doc(doc.data().course_id).get();
                if(cSnap.exists) courses.push({ id: cSnap.id, ...cSnap.data() });
            }
            return courses;
        }

    } catch (e) {
        throw new functions.https.HttpsError('internal', e.message);
    }
});
