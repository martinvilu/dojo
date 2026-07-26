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

const zlib = require('zlib');

function createTarHeader(filename, filesize, isDir = false, mtime = Math.floor(Date.now() / 1000)) {
    const buf = Buffer.alloc(512);
    buf.write(filename, 0, Math.min(filename.length, 100), "utf8");
    buf.write(isDir ? "0000755\0" : "0000644\0", 100, 8, "utf8");
    buf.write("0000000\0", 108, 8, "utf8");
    buf.write("0000000\0", 116, 8, "utf8");
    const sizeStr = isDir ? "00000000000\0" : filesize.toString(8).padStart(11, "0") + "\0";
    buf.write(sizeStr, 124, 12, "utf8");
    const mtimeStr = mtime.toString(8).padStart(11, "0") + "\0";
    buf.write(mtimeStr, 136, 12, "utf8");
    buf.write("        ", 148, 8, "utf8");
    buf.write(isDir ? "5" : "0", 156, 1, "utf8");
    buf.write("ustar\0", 257, 6, "utf8");
    buf.write("00", 263, 2, "utf8");
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += buf[i];
    buf.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf8");
    return buf;
}

function packTarGz(files) {
    const chunks = [];
    for (const file of files) {
        const dataBuf = file.isDir ? Buffer.alloc(0) : Buffer.from(file.content, "utf8");
        const header = createTarHeader(file.path, dataBuf.length, file.isDir);
        chunks.push(header);
        if (!file.isDir && dataBuf.length > 0) {
            chunks.push(dataBuf);
            const pad = (512 - (dataBuf.length % 512)) % 512;
            if (pad > 0) chunks.push(Buffer.alloc(pad));
        }
    }
    chunks.push(Buffer.alloc(1024));
    return zlib.gzipSync(Buffer.concat(chunks));
}

/**
 * Export course content, topics, and assignments to Moodle 4.2 MBZ Backup archive
 * Referenced from actual Moodle Campus Bimodal instance backup final_julio_2025-fix.mbz
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
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const cleanCourseName = course.name || "Cátedra Ninja Dojo";

    const mbzFiles = [];

    // 1. moodle_backup.xml (matching final_julio_2025-fix.mbz metadata & versioning)
    let backupXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    backupXml += `<moodle_backup>\n`;
    backupXml += `  <information>\n`;
    backupXml += `    <name>moodle_backup_${cleanCourseName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mbz</name>\n`;
    backupXml += `    <moodle_version>2023042405.04</moodle_version>\n`;
    backupXml += `    <moodle_release>4.2.5+ (Build: 20240125)</moodle_release>\n`;
    backupXml += `    <backup_version>2023042400</backup_version>\n`;
    backupXml += `    <backup_release>4.2</backup_release>\n`;
    backupXml += `    <backup_date>${nowTimestamp}</backup_date>\n`;
    backupXml += `    <mnet_remoteusers>0</mnet_remoteusers>\n`;
    backupXml += `    <include_files>1</include_files>\n`;
    backupXml += `    <include_file_references_to_external_content>0</include_file_references_to_external_content>\n`;
    backupXml += `    <original_wwwroot>https://campusbimodal.unrn.edu.ar</original_wwwroot>\n`;
    backupXml += `    <original_site_identifier_hash>97598c527496db4888503c9e590e21f1</original_site_identifier_hash>\n`;
    backupXml += `    <original_course_id>64226</original_course_id>\n`;
    backupXml += `    <original_course_format>topics</original_course_format>\n`;
    backupXml += `    <original_course_fullname>${escapeXml(cleanCourseName)}</original_course_fullname>\n`;
    backupXml += `    <original_course_shortname>${escapeXml(cleanCourseName)}</original_course_shortname>\n`;
    backupXml += `    <original_course_startdate>${nowTimestamp}</original_course_startdate>\n`;
    backupXml += `    <details>\n`;
    backupXml += `      <detail backup_id="e4575d88643bd1862ceb9c7b3a877e03">\n`;
    backupXml += `        <type>course</type>\n`;
    backupXml += `        <format>moodle2</format>\n`;
    backupXml += `        <interactive>1</interactive>\n`;
    backupXml += `        <mode>10</mode>\n`;
    backupXml += `        <execution>1</execution>\n`;
    backupXml += `        <executiontime>0</executiontime>\n`;
    backupXml += `      </detail>\n`;
    backupXml += `    </details>\n`;
    backupXml += `    <contents>\n`;
    backupXml += `      <activities>\n`;

    let activitySeqId = 100000;
    const activityEntries = [];

    // Add labels for classes
    classInstances.forEach((ci, idx) => {
        const modId = activitySeqId++;
        const secId = 90000 + idx + 1;
        activityEntries.push({
            modId,
            secId,
            type: 'label',
            title: ci.topic || `Clase ${idx + 1}`,
            dir: `activities/label_${modId}`,
            data: ci
        });
        backupXml += `        <activity>\n`;
        backupXml += `          <moduleid>${modId}</moduleid>\n`;
        backupXml += `          <sectionid>${secId}</sectionid>\n`;
        backupXml += `          <modulename>label</modulename>\n`;
        backupXml += `          <title>${escapeXml(ci.topic || `Clase ${idx + 1}`)}</title>\n`;
        backupXml += `          <directory>activities/label_${modId}</directory>\n`;
        backupXml += `        </activity>\n`;
    });

    const appBaseUrl = payload.baseUrl || "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app";

    // 6 LTI System Modules & Target Links for Moodle Backup MBZ
    const systemLtiModules = [
        {
            targetModule: "calendar",
            title: "📅 Calendario y Cronograma de Cátedra",
            description: "Acceso interactivo al calendario, cronograma de clases y eventos de la cursada.",
            secId: 90001
        },
        {
            targetModule: "status",
            title: "📊 Estado de Cursada, Asistencia y Alertas",
            description: "Panel de control de porcentaje de presentismo, entregas y alertas tempranas.",
            secId: 90001
        },
        {
            targetModule: "announcements",
            title: "📢 Tablero de Avisos y Novedades",
            description: "Novedades oficiales, anuncios de la cátedra e información importante.",
            secId: 90001
        },
        {
            targetModule: "tutoring",
            title: "🤝 Módulo de Tutorías y Mentorías Académicas",
            description: "Espacio para solicitar mentorías entre pares y consultas académicas.",
            secId: 90001
        },
        {
            targetModule: "groups",
            title: "👥 Grupos de Estudio y Emparejamiento",
            description: "Organización de equipos de estudio y formación de grupos por afinidad horaria.",
            secId: 90001
        }
    ];

    // Add 5 System LTI activities
    systemLtiModules.forEach(mod => {
        const modId = activitySeqId++;
        activityEntries.push({
            modId,
            secId: mod.secId,
            type: 'lti',
            title: mod.title,
            dir: `activities/lti_${modId}`,
            data: {
                description: mod.description,
                toolurl: `${appBaseUrl}/api/lti/launch?targetModule=${mod.targetModule}&courseId=${courseId}`,
                customParams: `targetModule=${mod.targetModule}\ncourseId=${courseId}`
            }
        });
        backupXml += `        <activity>\n`;
        backupXml += `          <moduleid>${modId}</moduleid>\n`;
        backupXml += `          <sectionid>${mod.secId}</sectionid>\n`;
        backupXml += `          <modulename>lti</modulename>\n`;
        backupXml += `          <title>${escapeXml(mod.title)}</title>\n`;
        backupXml += `          <directory>activities/lti_${modId}</directory>\n`;
        backupXml += `        </activity>\n`;
    });

    // Add LTI activities for individual assignments
    assignments.forEach((asg, idx) => {
        const modId = activitySeqId++;
        const secId = 90001;
        activityEntries.push({
            modId,
            secId,
            type: 'lti',
            title: `📝 Actividad Individual: ${asg.title || `Tarea ${idx + 1}`}`,
            dir: `activities/lti_${modId}`,
            data: {
                description: asg.description || "",
                toolurl: `${appBaseUrl}/api/lti/launch?targetModule=activities&assignmentId=${asg.id}&courseId=${courseId}`,
                customParams: `targetModule=activities\nassignmentId=${asg.id}\ncourseId=${courseId}`
            }
        });
        backupXml += `        <activity>\n`;
        backupXml += `          <moduleid>${modId}</moduleid>\n`;
        backupXml += `          <sectionid>${secId}</sectionid>\n`;
        backupXml += `          <modulename>lti</modulename>\n`;
        backupXml += `          <title>${escapeXml(`📝 Actividad Individual: ${asg.title || `Tarea ${idx + 1}`}`)}</title>\n`;
        backupXml += `          <directory>activities/lti_${modId}</directory>\n`;
        backupXml += `        </activity>\n`;
    });

    backupXml += `      </activities>\n`;
    backupXml += `      <sections>\n`;

    const sectionEntries = [];
    classInstances.forEach((ci, idx) => {
        const secId = 90000 + idx + 1;
        sectionEntries.push({ id: secId, num: idx + 1, name: ci.topic || `Clase ${idx + 1}`, summary: ci.description || "" });
        backupXml += `        <section>\n`;
        backupXml += `          <sectionid>${secId}</sectionid>\n`;
        backupXml += `          <title>${escapeXml(ci.topic || `Clase ${idx + 1}`)}</title>\n`;
        backupXml += `          <directory>sections/section_${secId}</directory>\n`;
        backupXml += `        </section>\n`;
    });
    if (classInstances.length === 0) {
        sectionEntries.push({ id: 90001, num: 1, name: "General", summary: "" });
        backupXml += `        <section>\n`;
        backupXml += `          <sectionid>90001</sectionid>\n`;
        backupXml += `          <title>General</title>\n`;
        backupXml += `          <directory>sections/section_90001</directory>\n`;
        backupXml += `        </section>\n`;
    }

    backupXml += `      </sections>\n`;
    backupXml += `      <course>\n`;
    backupXml += `        <courseid>64226</courseid>\n`;
    backupXml += `        <title>${escapeXml(cleanCourseName)}</title>\n`;
    backupXml += `        <directory>course</directory>\n`;
    backupXml += `      </course>\n`;
    backupXml += `    </contents>\n`;
    backupXml += `    <settings>\n`;
    backupXml += `      <setting><level>root</level><name>filename</name><value>final_julio_2025-fix.mbz</value></setting>\n`;
    backupXml += `      <setting><level>root</level><name>users</name><value>0</value></setting>\n`;
    backupXml += `      <setting><level>root</level><name>activities</name><value>1</value></setting>\n`;
    backupXml += `      <setting><level>root</level><name>blocks</name><value>1</value></setting>\n`;
    backupXml += `      <setting><level>root</level><name>files</name><value>1</value></setting>\n`;
    backupXml += `    </settings>\n`;
    backupXml += `  </information>\n`;
    backupXml += `</moodle_backup>\n`;

    mbzFiles.push({ path: 'moodle_backup.xml', content: backupXml, isDir: false });

    // 2. course/course.xml
    let courseXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    courseXml += `<course id="64226" contextid="1611413">\n`;
    courseXml += `  <shortname>${escapeXml(cleanCourseName)}</shortname>\n`;
    courseXml += `  <fullname>${escapeXml(cleanCourseName)}</fullname>\n`;
    courseXml += `  <summary></summary>\n`;
    courseXml += `  <format>topics</format>\n`;
    courseXml += `  <visible>1</visible>\n`;
    courseXml += `  <startdate>${nowTimestamp}</startdate>\n`;
    courseXml += `</course>\n`;

    mbzFiles.push({ path: 'course/course.xml', content: courseXml, isDir: false });
    mbzFiles.push({ path: 'course/inforef.xml', content: `<?xml version="1.0" encoding="UTF-8"?><inforef></inforef>`, isDir: false });
    mbzFiles.push({ path: 'course/enrolments.xml', content: `<?xml version="1.0" encoding="UTF-8"?><enrolments></enrolments>`, isDir: false });
    mbzFiles.push({ path: 'course/roles.xml', content: `<?xml version="1.0" encoding="UTF-8"?><roles></roles>`, isDir: false });
    mbzFiles.push({ path: 'course/completiondefaults.xml', content: `<?xml version="1.0" encoding="UTF-8"?><completiondefaults></completiondefaults>`, isDir: false });
    mbzFiles.push({ path: 'course/contentbank.xml', content: `<?xml version="1.0" encoding="UTF-8"?><contentbank></contentbank>`, isDir: false });

    // 3. Sections
    sectionEntries.forEach(sec => {
        let secXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        secXml += `<section id="${sec.id}">\n`;
        secXml += `  <number>${sec.num}</number>\n`;
        secXml += `  <name>${escapeXml(sec.name)}</name>\n`;
        secXml += `  <summary>${escapeXml(sec.summary)}</summary>\n`;
        secXml += `  <visible>1</visible>\n`;
        secXml += `</section>\n`;
        mbzFiles.push({ path: `sections/section_${sec.id}/section.xml`, content: secXml, isDir: false });
        mbzFiles.push({ path: `sections/section_${sec.id}/inforef.xml`, content: `<?xml version="1.0" encoding="UTF-8"?><inforef></inforef>`, isDir: false });
    });

    // 4. Activities
    activityEntries.forEach(act => {
        let modXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        modXml += `<module id="${act.modId}" version="2023042400">\n`;
        modXml += `  <modulename>${act.type}</modulename>\n`;
        modXml += `  <sectionid>${act.secId}</sectionid>\n`;
        modXml += `  <visible>1</visible>\n`;
        modXml += `</module>\n`;
        mbzFiles.push({ path: `${act.dir}/module.xml`, content: modXml, isDir: false });
        mbzFiles.push({ path: `${act.dir}/inforef.xml`, content: `<?xml version="1.0" encoding="UTF-8"?><inforef></inforef>`, isDir: false });
        mbzFiles.push({ path: `${act.dir}/grade_history.xml`, content: `<?xml version="1.0" encoding="UTF-8"?><grade_history></grade_history>`, isDir: false });
        mbzFiles.push({ path: `${act.dir}/roles.xml`, content: `<?xml version="1.0" encoding="UTF-8"?><roles></roles>`, isDir: false });
        mbzFiles.push({ path: `${act.dir}/grades.xml`, content: `<?xml version="1.0" encoding="UTF-8"?><grades></grades>`, isDir: false });

        if (act.type === 'label') {
            let labelXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
            labelXml += `<activity id="${act.modId}" moduleid="${act.modId}" modulename="label">\n`;
            labelXml += `  <label id="${act.modId}">\n`;
            labelXml += `    <name>${escapeXml(act.title)}</name>\n`;
            labelXml += `    <intro>${escapeXml(act.data.description || act.title)}</intro>\n`;
            labelXml += `  </label>\n`;
            labelXml += `</activity>\n`;
            mbzFiles.push({ path: `${act.dir}/label.xml`, content: labelXml, isDir: false });
        } else if (act.type === 'assign') {
            let assignXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
            assignXml += `<activity id="${act.modId}" moduleid="${act.modId}" modulename="assign">\n`;
            assignXml += `  <assign id="${act.modId}">\n`;
            assignXml += `    <name>${escapeXml(act.title)}</name>\n`;
            assignXml += `    <intro>${escapeXml(act.data.description || "")}</intro>\n`;
            assignXml += `    <alwaysshowdescription>1</alwaysshowdescription>\n`;
            assignXml += `  </assign>\n`;
            assignXml += `</activity>\n`;
            mbzFiles.push({ path: `${act.dir}/assign.xml`, content: assignXml, isDir: false });
        } else if (act.type === 'lti') {
            let ltiXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
            ltiXml += `<activity id="${act.modId}" moduleid="${act.modId}" modulename="lti">\n`;
            ltiXml += `  <lti id="${act.modId}">\n`;
            ltiXml += `    <name>${escapeXml(act.title)}</name>\n`;
            ltiXml += `    <intro>${escapeXml(act.data.description || act.title)}</intro>\n`;
            ltiXml += `    <toolurl>${escapeXml(act.data.toolurl)}</toolurl>\n`;
            ltiXml += `    <instructorcustomparameters>${escapeXml(act.data.customParams)}</instructorcustomparameters>\n`;
            ltiXml += `    <typeid>0</typeid>\n`;
            ltiXml += `    <launchcontainer>3</launchcontainer>\n`;
            ltiXml += `  </lti>\n`;
            ltiXml += `</activity>\n`;
            mbzFiles.push({ path: `${act.dir}/lti.xml`, content: ltiXml, isDir: false });
        }
    });

    // 5. Global standard XML files
    mbzFiles.push({ path: 'files.xml', content: `<?xml version="1.0" encoding="UTF-8"?><files></files>`, isDir: false });
    mbzFiles.push({ path: 'questions.xml', content: `<?xml version="1.0" encoding="UTF-8"?><questions></questions>`, isDir: false });
    mbzFiles.push({ path: 'gradebook.xml', content: `<?xml version="1.0" encoding="UTF-8"?><gradebook></gradebook>`, isDir: false });
    mbzFiles.push({ path: 'completion.xml', content: `<?xml version="1.0" encoding="UTF-8"?><completion></completion>`, isDir: false });
    mbzFiles.push({ path: 'roles.xml', content: `<?xml version="1.0" encoding="UTF-8"?><roles></roles>`, isDir: false });
    mbzFiles.push({ path: 'scales.xml', content: `<?xml version="1.0" encoding="UTF-8"?><scales></scales>`, isDir: false });
    mbzFiles.push({ path: 'outcomes.xml', content: `<?xml version="1.0" encoding="UTF-8"?><outcomes></outcomes>`, isDir: false });
    mbzFiles.push({ path: 'groups.xml', content: `<?xml version="1.0" encoding="UTF-8"?><groups></groups>`, isDir: false });

    // Pack into .mbz tar.gz archive
    const mbzBuffer = packTarGz(mbzFiles);
    const mbzBase64 = mbzBuffer.toString('base64');
    const safeFilename = `moodle_backup_${cleanCourseName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mbz`;

    return {
        filename: safeFilename,
        xmlContent: backupXml,
        mbzBase64: mbzBase64
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

/**
 * Import course topics and activities from Moodle REST WS API (core_course_get_contents)
 */
async function syncMoodleCourseContents(payload, context) {
    const { db } = context;
    const { courseId, moodleUrl, moodleToken, moodleCourseId } = payload;

    if (!courseId || !moodleUrl || !moodleToken || !moodleCourseId) {
        throw new Error("Parámetros de conexión a Moodle incompletos.");
    }

    const endpoint = `${moodleUrl.replace(/\/$/, '')}/webservice/rest/server.php?wstoken=${moodleToken}&wsfunction=core_course_get_contents&moodlewsrestformat=json&courseid=${moodleCourseId}`;

    const res = await fetch(endpoint);
    const sections = await res.json();

    if (sections.exception || sections.errorcode) {
        throw new Error(`Error en Moodle WS: ${sections.message || sections.errorcode}`);
    }

    if (!Array.isArray(sections)) {
        throw new Error("Respuesta inválida de Moodle Web Services");
    }

    const courseRef = db.collection('courses').doc(courseId);
    const cSnap = await courseRef.get();
    if (!cSnap.exists) throw new Error("Cátedra no encontrada.");

    const currentClasses = cSnap.data().class_instances || [];
    const newClasses = [...currentClasses];

    let importedSectionsCount = 0;
    sections.forEach((sec, idx) => {
        if (!sec.name || sec.name.trim() === "") return;
        const exists = newClasses.some(c => c.topic === sec.name);
        if (!exists) {
            newClasses.push({
                classNumber: newClasses.length + 1,
                topic: sec.name,
                description: sec.summary ? sec.summary.replace(/<[^>]*>?/gm, '') : `Sección Moodle ${sec.section}`,
                date: new Date().toISOString().split('T')[0],
                type: "Teórica",
                special_status: "Normal"
            });
            importedSectionsCount++;
        }
    });

    await courseRef.update({ class_instances: newClasses });

    return { success: true, importedSectionsCount, totalSections: sections.length };
}

/**
 * Return LTI 1.3 Deep Linking Content Items JSON structure for Moodle integration
 */
async function getMoodleLtiDeepLinkContent(payload, context) {
    const { db } = context;
    const { courseId, baseUrl } = payload;
    if (!courseId) throw new Error("Parámetro 'courseId' requerido.");

    const appBaseUrl = baseUrl || "https://jutsu-classroom-mrtin.web.app";
    const assignmentsSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
    const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const courseSnap = await db.collection('courses').doc(courseId).get();
    const course = courseSnap.exists ? courseSnap.data() : {};
    const classes = course.class_instances || [];

    const items = [
        {
            type: "ltiResourceLink",
            title: `📅 Calendario y Cronograma de Cátedra`,
            url: `${appBaseUrl}/api/lti/launch?targetModule=calendar&courseId=${courseId}`,
            custom: { targetModule: "calendar", courseId }
        },
        {
            type: "ltiResourceLink",
            title: `📊 Estado de Cursada, Asistencia y Alertas`,
            url: `${appBaseUrl}/api/lti/launch?targetModule=status&courseId=${courseId}`,
            custom: { targetModule: "status", courseId }
        },
        {
            type: "ltiResourceLink",
            title: `📢 Tablero de Avisos y Novedades`,
            url: `${appBaseUrl}/api/lti/launch?targetModule=announcements&courseId=${courseId}`,
            custom: { targetModule: "announcements", courseId }
        },
        {
            type: "ltiResourceLink",
            title: `🤝 Módulo de Tutorías y Mentorías Académicas`,
            url: `${appBaseUrl}/api/lti/launch?targetModule=tutoring&courseId=${courseId}`,
            custom: { targetModule: "tutoring", courseId }
        },
        {
            type: "ltiResourceLink",
            title: `👥 Grupos de Estudio y Emparejamiento`,
            url: `${appBaseUrl}/api/lti/launch?targetModule=groups&courseId=${courseId}`,
            custom: { targetModule: "groups", courseId }
        }
    ];

    // Add individual assignments as LTI LTIResourceLink
    assignments.forEach(asg => {
        items.push({
            type: "ltiResourceLink",
            title: `📝 Actividad Individual: ${asg.title}`,
            url: `${appBaseUrl}/api/lti/launch?targetModule=activities&assignmentId=${asg.id}&courseId=${courseId}`,
            custom: {
                targetModule: "activities",
                assignmentId: asg.id,
                courseId: courseId
            }
        });
    });

    // Add classes as LTI LTIResourceLink
    classes.forEach(ci => {
        items.push({
            type: "ltiResourceLink",
            title: `📚 Clase: ${ci.topic || `Clase ${ci.classNumber}`}`,
            url: `${appBaseUrl}/api/lti/launch?targetModule=calendar&classNumber=${ci.classNumber}&courseId=${courseId}`,
            custom: {
                targetModule: "calendar",
                classNumber: ci.classNumber,
                courseId: courseId
            }
        });
    });

    return {
        context: "http://purl.imsglobal.org/ctx/lti/v1/deeplinking",
        type: "LtiDeepLinkingResponse",
        items: items
    };
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
    exportGradesToMoodleWebservice,
    syncMoodleCourseContents,
    getMoodleLtiDeepLinkContent
};

