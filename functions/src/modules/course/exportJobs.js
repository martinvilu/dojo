/**
 * Exportaciones pesadas en segundo plano (mejora 3.16) con descarga por
 * URL firmada de corta duración (mejora 3.32).
 *
 * requestCourseExport crea un trabajo en export_jobs; el trigger
 * onExportJobCreated arma el reporte académico completo del curso (una fila
 * por estudiante: datos, asistencia y nota de cada tarea) con lecturas por
 * lotes, lo sube a Cloud Storage y avisa al docente con una notificación.
 * getExportDownloadUrl devuelve una URL firmada válida 15 minutos.
 *
 * Se usa un trigger de Firestore en lugar de Cloud Tasks: misma ejecución
 * en segundo plano con reintentos, sin una cola extra que configurar.
 */
const { dojoError } = require('../../lib/errors');
const { isCourseStaff } = require('../../authz');

const JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const URL_TTL_MS = 15 * 60 * 1000;
const IN_LIMIT = 30;

function escapeCsv(value) {
    const text = String(value ?? '');
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

async function getProfiles(db, ids) {
    const refs = ids.map((id) => db.collection('profiles').doc(id));
    const snaps = typeof db.getAll === 'function' && refs.length ? await db.getAll(...refs) : await Promise.all(refs.map((r) => r.get()));
    return new Map(snaps.map((s, i) => [ids[i], s.exists ? s.data() : {}]));
}

/** CSV del reporte académico completo de un curso. */
async function buildCourseReportCsv(db, courseId) {
    const courseSnap = await db.collection('courses').doc(courseId).get();
    const course = courseSnap.exists ? courseSnap.data() : {};

    const [rosterSnap, enrollSnap, assignmentsSnap, attendanceSnap] = await Promise.all([
        db.collection('course_roster').where('course_id', '==', courseId).get(),
        db.collection('enrollments').where('course_id', '==', courseId).get(),
        db.collection('assignments').where('course_id', '==', courseId).get(),
        db.collection('courses').doc(courseId).collection('attendance').get()
    ]);
    const studentIds = [...new Set([...rosterSnap.docs, ...enrollSnap.docs].map((d) => d.data().student_id).filter(Boolean))];
    const assignments = assignmentsSnap.docs.map((d) => ({ id: d.id, title: d.data().title || 'Tarea' }));

    const grades = new Map(); // `${studentId}|${assignmentId}` -> nota
    for (const group of chunk(assignments.map((a) => a.id), IN_LIMIT)) {
        const subs = await db.collection('submissions').where('assignment_id', 'in', group).get();
        subs.docs.forEach((d) => {
            const s = d.data();
            grades.set(`${s.student_id}|${s.assignment_id}`, s.grade ?? (s.status === 'submitted' ? 'Entregado' : ''));
        });
    }

    const classes = attendanceSnap.docs.map((d) => d.data().records || {});
    const profiles = await getProfiles(db, studentIds);

    const header = ['estudiante', 'email', 'matricula', 'github', 'comision', 'clases_registradas', 'presentes', 'asistencia_%', ...assignments.map((a) => a.title)];
    const rows = studentIds.map((sid) => {
        const p = profiles.get(sid) || {};
        const recorded = classes.filter((r) => r[sid]).length;
        const present = classes.filter((r) => r[sid] === 'present' || r[sid] === 'late').length;
        return [
            p.full_name || '', p.email || '', p.matricula_unrn || '', p.github_user || '',
            (p.commissions || {})[courseId] || '',
            recorded, present, recorded ? Math.round((present / recorded) * 100) : '',
            ...assignments.map((a) => grades.get(`${sid}|${a.id}`) ?? '')
        ];
    }).sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es'));

    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(';')).join('\n') + '\n';
    return { csv, courseName: course.name || courseId, students: rows.length };
}

async function requestCourseExport(payload, context) {
    const { uid, db } = context;
    const ref = await db.collection('export_jobs').add({
        course_id: payload.courseId,
        kind: 'course_report',
        requested_by: uid,
        status: 'queued',
        created_at: new Date(),
        expires_at: new Date(Date.now() + JOB_TTL_MS)
    });
    return { jobId: ref.id, status: 'queued' };
}

/** Cuerpo del trigger: genera el archivo, lo sube y notifica. */
async function processExportJob({ db, bucket, serverTimestamp }, jobId, job) {
    if (!job || job.status !== 'queued') return null;
    const jobRef = db.collection('export_jobs').doc(jobId);
    try {
        const { csv, courseName, students } = await buildCourseReportCsv(db, job.course_id);
        const path = `exports/${job.course_id}/${jobId}.csv`;
        await bucket.file(path).save(Buffer.from('﻿' + csv, 'utf8'), {
            contentType: 'text/csv; charset=utf-8',
            resumable: false,
            metadata: { contentDisposition: `attachment; filename="reporte_${String(courseName).replace(/[^\w.-]+/g, '_')}.csv"`, cacheControl: 'private, no-store' }
        });
        await jobRef.update({ status: 'ready', storage_path: path, students, finished_at: new Date() });
        await db.collection('notifications').add({
            student_id: job.requested_by,
            type: 'export_ready',
            message: `El reporte completo de ${courseName} (${students} estudiantes) está listo para descargar.`,
            link: `/dashboard?export=${encodeURIComponent(jobId)}`,
            read: false,
            is_daily_pending: false,
            created_at: serverTimestamp()
        });
        return path;
    } catch (e) {
        await jobRef.update({ status: 'failed', error: String(e.message || e).slice(0, 500), finished_at: new Date() });
        throw e;
    }
}

async function getExportDownloadUrl(payload, context) {
    const { uid, db, getMyProfile, bucket } = context;
    if (typeof payload.jobId !== 'string' || !payload.jobId) throw dojoError('INVALID_ARGUMENT', "Falta el trabajo de exportación");
    const snap = await db.collection('export_jobs').doc(payload.jobId).get();
    if (!snap.exists) throw dojoError('NOT_FOUND', "La exportación no existe o ya venció.");
    const job = snap.data();
    const profile = getMyProfile ? await getMyProfile() : null;
    const allowed = job.requested_by === uid || (profile && profile.role === 'admin') || await isCourseStaff(db, job.course_id, uid);
    if (!allowed) throw dojoError('FORBIDDEN', "No tenés acceso a esta exportación.");
    if (job.status !== 'ready') return { status: job.status, url: null };
    const [url] = await bucket.file(job.storage_path).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + URL_TTL_MS });
    return { status: 'ready', url, expiresInSeconds: URL_TTL_MS / 1000 };
}

module.exports = { buildCourseReportCsv, requestCourseExport, processExportJob, getExportDownloadUrl, escapeCsv };
