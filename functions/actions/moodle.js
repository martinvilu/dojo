const fetch = require('node-fetch');

async function moodleAutoEnroll(payload, context) {
    const { uid, db, admin } = context;
    const { courseId } = payload;
    if (!courseId) throw new Error("Falta el ID del curso");
    
    const pSnap = await db.collection('profiles').doc(uid).get();
    const profile = pSnap.exists ? pSnap.data() : {};
    
    if (profile.role === 'teacher') {
        const rosterRef = db.collection('course_teachers').doc(`${courseId}_${uid}`);
        const rSnap = await rosterRef.get();
        if (!rSnap.exists) {
            await rosterRef.set({
                course_id: courseId,
                teacher_id: uid,
                role: 'auxiliar'
            });
        }
    } else {
        const rosterRef = db.collection('course_roster').doc(`${courseId}_${uid}`);
        const rSnap = await rosterRef.get();
        if (!rSnap.exists) {
            await rosterRef.set({
                course_id: courseId,
                student_id: uid,
                enrolled_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
    
    await db.collection('audit_logs').add({
        action: 'moodle_auto_enroll',
        course_id: courseId,
        student_id: uid,
        actor_id: uid,
        actor_name: profile.full_name || profile.email || uid,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
}

/**
 * Export course content, topics, and assignments to Moodle XML Backup format
 */
async function exportCourseToMoodleXml(payload, context) {
    const { db } = context;
    const { courseId } = payload;
    if (!courseId) throw new Error("ID de cátedra requerido");

    const courseSnap = await db.collection('courses').doc(courseId).get();
    if (!courseSnap.exists) throw new Error("Cátedra no encontrada");
    const course = courseSnap.data();

    const assignmentsSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
    const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const classInstances = course.class_instances || [];

    // Build Moodle XML structure
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<moodle_backup>\n`;
    xml += `  <information>\n`;
    xml += `    <name>${escapeXml(course.name || "Cátedra Dojo")}</name>\n`;
    xml += `    <moodle_version>4.2</moodle_version>\n`;
    xml += `    <original_course_fullname>${escapeXml(course.name || "")}</original_course_fullname>\n`;
    xml += `    <details>\n`;
    xml += `      <startdate>${course.start_date || ""}</startdate>\n`;
    xml += `      <duration_weeks>${course.duration_weeks || 16}</duration_weeks>\n`;
    xml += `    </details>\n`;
    xml += `  </information>\n`;
    xml += `  <contents>\n`;
    xml += `    <sections>\n`;

    // Add classes as Moodle sections
    classInstances.forEach((ci, idx) => {
        xml += `      <section id="${idx + 1}">\n`;
        xml += `        <number>${ci.classNumber || idx + 1}</number>\n`;
        xml += `        <name>${escapeXml(ci.topic || `Clase ${idx + 1}`)}</name>\n`;
        xml += `        <summary>${escapeXml(ci.description || "")}</summary>\n`;
        if (ci.presentation_url) {
            xml += `        <resource type="presentation_url">${escapeXml(ci.presentation_url)}</resource>\n`;
        }
        if (ci.recording_url) {
            xml += `        <resource type="recording_url">${escapeXml(ci.recording_url)}</resource>\n`;
        }
        xml += `      </section>\n`;
    });

    xml += `    </sections>\n`;
    xml += `    <assignments>\n`;

    // Add assignments
    assignments.forEach((asg) => {
        xml += `      <assignment id="${asg.id}">\n`;
        xml += `        <title>${escapeXml(asg.title || "")}</title>\n`;
        xml += `        <description>${escapeXml(asg.description || "")}</description>\n`;
        xml += `        <duedate>${asg.due_date || ""}</duedate>\n`;
        xml += `        <is_group>${asg.is_group ? "true" : "false"}</is_group>\n`;
        xml += `      </assignment>\n`;
    });

    xml += `    </assignments>\n`;
    xml += `  </contents>\n`;
    xml += `</moodle_backup>\n`;

    return {
        filename: `moodle_backup_${course.name ? course.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'course'}.xml`,
        xmlContent: xml
    };
}

/**
 * Sync roster from Moodle Web Services API (core_enrol_get_enrolled_users)
 */
async function syncMoodleCourseRoster(payload, context) {
    const { db, admin } = context;
    const { courseId, moodleUrl, moodleToken, moodleCourseId } = payload;

    if (!courseId || !moodleUrl || !moodleToken || !moodleCourseId) {
        throw new Error("Parámetros 'courseId', 'moodleUrl', 'moodleToken' y 'moodleCourseId' requeridos.");
    }

    const endpoint = `${moodleUrl.replace(/\/$/, '')}/webservice/rest/server.php?wstoken=${moodleToken}&wsfunction=core_enrol_get_enrolled_users&moodlewsrestformat=json&courseid=${moodleCourseId}`;

    const res = await fetch(endpoint);
    const users = await res.json();

    if (users.exception || users.errorcode) {
        throw new Error(`Error en API de Moodle: ${users.message || users.errorcode}`);
    }

    if (!Array.isArray(users)) {
        throw new Error("Respuesta inválida de Moodle Web Services");
    }

    let syncedCount = 0;
    for (let u of users) {
        if (!u.email) continue;
        const cleanEmail = u.email.trim().toLowerCase();

        // Find or create student profile
        let studentUid = null;
        const pSnap = await db.collection('profiles').where('email', '==', cleanEmail).get();
        if (!pSnap.empty) {
            studentUid = pSnap.docs[0].id;
        } else {
            // Check secondary emails
            const secSnap = await db.collection('profiles').where('secondary_emails', 'array-contains', cleanEmail).get();
            if (!secSnap.empty) {
                studentUid = secSnap.docs[0].id;
            }
        }

        if (studentUid) {
            await db.collection('course_roster').doc(`${courseId}_${studentUid}`).set({
                course_id: courseId,
                student_id: studentUid,
                moodle_user_id: u.id,
                status: 'active',
                synced_from_moodle_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            syncedCount++;
        }
    }

    return { success: true, syncedCount, totalMoodleUsers: users.length };
}

/**
 * Batch push grades to Moodle via REST API (core_grades_update_grades)
 */
async function exportGradesToMoodleWebservice(payload, context) {
    const { db } = context;
    const { courseId, moodleUrl, moodleToken, moodleCourseId, assignmentId } = payload;

    if (!courseId || !moodleUrl || !moodleToken || !moodleCourseId || !assignmentId) {
        throw new Error("Parámetros de conexión a Moodle incompletos.");
    }

    const subsSnap = await db.collection('submissions').where('assignment_id', '==', assignmentId).get();
    const submissions = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let pushedCount = 0;
    for (let sub of submissions) {
        if (!sub.grade) continue;

        const rosterSnap = await db.collection('course_roster').doc(`${courseId}_${sub.student_id}`).get();
        const moodleUserId = rosterSnap.exists ? rosterSnap.data().moodle_user_id : null;

        if (moodleUserId) {
            const endpoint = `${moodleUrl.replace(/\/$/, '')}/webservice/rest/server.php`;
            const params = new URLSearchParams({
                wstoken: moodleToken,
                wsfunction: 'core_grades_update_grades',
                moodlewsrestformat: 'json',
                source: 'ninja_dojo',
                courseid: moodleCourseId,
                itemname: `Tarea Dojo ${assignmentId}`,
                itemnum: 0,
                'grades[0][userid]': moodleUserId,
                'grades[0][rawgrade]': parseFloat(sub.grade) || 0
            });

            try {
                await fetch(endpoint, { method: 'POST', body: params });
                pushedCount++;
            } catch (e) {
                console.error(`Error enviando nota de usuario Moodle ${moodleUserId}:`, e);
            }
        }
    }

    return { success: true, pushedCount };
}

function escapeXml(unsafe) {
    if (!unsafe) return "";
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

module.exports = {
    moodleAutoEnroll,
    exportCourseToMoodleXml,
    syncMoodleCourseRoster,
    exportGradesToMoodleWebservice
};
