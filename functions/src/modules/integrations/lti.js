/**
 * LTI 1.3 Advantage desde la callable `api` (plan F3.1, F3.6–F3.8):
 * registro de plataformas por el titular, aprobación por un administrador,
 * sincronización de padrón (NRPS 2.0) y publicación de notas (AGS 2.0).
 *
 * El launch y el JWKS viven en las rutas de Next (`/api/v1/lti/*`); ambos
 * lados comparten `functions/src/lib/lti`.
 */
const { createHash, randomBytes } = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { isSafeExternalUrl } = require('../../lib/urls');
const { gradeToOutcomeScore } = require('../../lib/grades');
const { platformDocId, resolveIdentity, provisionMembership } = require('../../lib/lti/launch');
const { mapLtiRole, ROLE, SCOPES, UNRN_MATRICULA_RE } = require('../../lib/lti/claims');
const { createLtiServices } = require('../../lib/lti/services');
const { currentSigningKey } = require('../../lib/lti/keys');
const { assertCanEditRules } = require('../course/academic');

const REGISTRATION_TTL_MS = 60 * 60 * 1000;
const PLATFORM_STATUSES = ['pending', 'approved', 'disabled'];

function services() {
    return createLtiServices({ signingKey: currentSigningKey(), isSafeUrl: isSafeExternalUrl });
}

function publicPlatform(id, p) {
    return {
        id,
        issuer: p.issuer,
        client_id: p.client_id,
        deployment_ids: p.deployment_ids || [],
        status: p.status || 'pending',
        product: p.product || '',
        registered_via: p.registered_via || 'manual',
        course_ids: p.course_ids || [],
    };
}

async function assertTitular(context, courseId) {
    const profile = context.getMyProfile ? await context.getMyProfile() : null;
    try {
        await assertCanEditRules(context.db, courseId, context.uid, profile);
    } catch {
        throw new HttpsError('permission-denied', 'Solo el profesor titular puede configurar la integración con Moodle.');
    }
    return profile;
}

/** Token de un solo uso para la URL de Dynamic Registration (1 hora). */
async function createLtiRegistrationToken(payload, context) {
    const { uid, db, admin } = context;
    await assertTitular(context, payload.courseId);
    const rt = randomBytes(24).toString('base64url');
    await db.collection('lti_registrations').doc(rt).set({
        course_id: payload.courseId,
        owner_uid: uid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        expires_at: new Date(Date.now() + REGISTRATION_TTL_MS),
    });
    return { token: rt, expiresInMinutes: REGISTRATION_TTL_MS / 60000 };
}

/** Alta manual (cuando Moodle no ofrece registro dinámico). */
async function registerLtiPlatform(payload, context) {
    const { uid, db, admin } = context;
    await assertTitular(context, payload.courseId);
    const { issuer, clientId, deploymentId, authLoginUrl, authTokenUrl, jwksUrl } = payload;
    for (const [label, url] of [['emisor', issuer], ['login', authLoginUrl], ['token', authTokenUrl], ['JWKS', jwksUrl]]) {
        if (!isSafeExternalUrl(url)) throw new HttpsError('invalid-argument', `La URL de ${label} debe ser https y pública.`);
    }
    const id = platformDocId(issuer, clientId);
    const ref = db.collection('lti_platforms').doc(id);
    const existing = await ref.get();
    const FieldValue = admin.firestore.FieldValue;
    await ref.set({
        issuer,
        client_id: clientId,
        deployment_ids: FieldValue.arrayUnion(String(deploymentId)),
        course_ids: FieldValue.arrayUnion(payload.courseId),
        // Un registro existente conserva sus URLs: otro titular no puede redirigir el login.
        ...(existing.exists ? {} : {
            auth_login_url: authLoginUrl,
            auth_token_url: authTokenUrl,
            jwks_url: jwksUrl,
            owner_uid: uid,
            status: 'pending',
            registered_via: 'manual',
            created_at: FieldValue.serverTimestamp(),
        }),
        updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('audit_logs').add({
        action: 'lti_platform_registered', course_id: payload.courseId, actor_id: uid, platform_id: id, issuer,
        created_at: FieldValue.serverTimestamp(),
    });
    return { id, status: existing.exists ? existing.data().status : 'pending' };
}

async function getLtiPlatforms(payload, context) {
    const { db } = context;
    const snap = await db.collection('lti_platforms').where('course_ids', 'array-contains', payload.courseId).get();
    const contexts = await db.collection('lti_contexts').where('course_id', '==', payload.courseId).get();
    return {
        platforms: snap.docs.map((d) => publicPlatform(d.id, d.data())),
        contexts: contexts.docs.map((d) => {
            const c = d.data();
            return {
                id: d.id,
                platform_id: c.platform_id,
                context_title: c.context_title || c.context_id,
                nrps: Boolean(c.nrps_url),
                ags: Boolean(c.ags_lineitems_url),
                last_roster_sync: c.nrps_synced_at || null,
            };
        }),
    };
}

async function unlinkLtiPlatform(payload, context) {
    const { db, admin } = context;
    await assertTitular(context, payload.courseId);
    await db.collection('lti_platforms').doc(payload.platformId).update({
        course_ids: admin.firestore.FieldValue.arrayRemove(payload.courseId),
    });
    return { success: true };
}

async function getLtiPlatformsForReview(payload, context) {
    const snap = await context.db.collection('lti_platforms').get();
    return snap.docs.map((d) => publicPlatform(d.id, d.data()));
}

/** Aprobar habilita launches docentes y vínculo con cuentas existentes. */
async function setLtiPlatformStatus(payload, context) {
    const { uid, db, admin } = context;
    if (!PLATFORM_STATUSES.includes(payload.status)) throw new HttpsError('invalid-argument', 'Estado inválido.');
    const ref = db.collection('lti_platforms').doc(payload.platformId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Plataforma no encontrada.');
    await ref.update({ status: payload.status, reviewed_by: uid, reviewed_at: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection('audit_logs').add({
        action: 'lti_platform_status', platform_id: snap.id, previous_status: snap.data().status || 'pending',
        new_status: payload.status, actor_id: uid, created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
}

async function linkedContexts(db, courseId) {
    const snap = await db.collection('lti_contexts').where('course_id', '==', courseId).get();
    const out = [];
    for (const doc of snap.docs) {
        const ctx = doc.data();
        const p = await db.collection('lti_platforms').doc(ctx.platform_id).get();
        if (p.exists && p.data().status !== 'disabled') out.push({ ref: doc.ref, id: doc.id, ctx, platform: { id: p.id, ...p.data() } });
    }
    return out;
}

function memberToLaunch(platform, member) {
    const sourcedid = String(member.lis_person_sourcedid || '').trim().toUpperCase();
    return {
        issuer: platform.issuer,
        sub: String(member.user_id),
        role: mapLtiRole(member.roles),
        email: typeof member.email === 'string' ? member.email.trim().toLowerCase() : '',
        name: member.name || [member.given_name, member.family_name].filter(Boolean).join(' '),
        matricula: UNRN_MATRICULA_RE.test(sourcedid) ? sourcedid : '',
    };
}

/**
 * NRPS 2.0: importa alumnos y ayudantes. Un checksum del padrón evita
 * reescribir cuando no hubo altas ni bajas; las bajas de alumnos que
 * entraron por LTI quedan como `baja` (no se borran).
 */
async function syncLtiRoster(payload, context) {
    const { db, admin } = context;
    const contexts = (await linkedContexts(db, payload.courseId)).filter((c) => c.ctx.nrps_url);
    if (contexts.length === 0) {
        throw new HttpsError('failed-precondition', 'Todavía no hay un curso de Moodle vinculado con el servicio de padrón. Abrí la actividad una vez desde Moodle.');
    }
    const lti = services();
    const report = { contexts: 0, unchanged: 0, added: 0, staff: 0, removed: 0, skipped: 0 };

    for (const { ref, ctx, platform } of contexts) {
        report.contexts++;
        const members = await lti.fetchMemberships(platform, ctx.nrps_url);
        const active = members.filter((m) => (m.status || 'Active') === 'Active');
        const checksum = createHash('sha256')
            .update(active.map((m) => `${m.user_id}:${[...(m.roles || [])].sort().join(',')}`).sort().join('\n'))
            .digest('hex');
        if (checksum === ctx.nrps_checksum) {
            report.unchanged++;
            continue;
        }

        const activeLearners = new Set();
        for (const member of active) {
            const launch = memberToLaunch(platform, member);
            if (launch.role === ROLE.NONE) { report.skipped++; continue; }
            // Sin aprobación de la plataforma no se dan altas docentes (igual que en el launch).
            if ((launch.role === ROLE.INSTRUCTOR || launch.role === ROLE.TA) && platform.status !== 'approved') { report.skipped++; continue; }
            const { uid } = await resolveIdentity(db, platform, launch, admin);
            const before = await db.collection(launch.role === ROLE.LEARNER ? 'course_roster' : 'course_teachers').doc(`${payload.courseId}_${uid}`).get();
            await provisionMembership(db, { platform, launch, uid, courseId: payload.courseId, admin, touchActivity: false });
            if (launch.role === ROLE.LEARNER) activeLearners.add(uid);
            if (!before.exists) launch.role === ROLE.LEARNER ? report.added++ : report.staff++;
        }

        const roster = await db.collection('course_roster').where('course_id', '==', payload.courseId).get();
        for (const doc of roster.docs) {
            const r = doc.data();
            if (r.enrolled_via === 'lti' && r.status !== 'baja' && !activeLearners.has(r.student_id)) {
                await doc.ref.update({ status: 'baja', removed_via: 'nrps' });
                report.removed++;
            }
        }
        await ref.update({ nrps_checksum: checksum, nrps_synced_at: admin.firestore.FieldValue.serverTimestamp() });
    }
    return report;
}

/** Nota y devolución de cada alumno para un TP o un parcial. */
async function gradesFor(db, { assignmentId, assessmentId }) {
    if (assignmentId) {
        const a = await db.collection('assignments').doc(assignmentId).get();
        if (!a.exists) throw new HttpsError('not-found', 'La tarea no existe.');
        const subs = await db.collection('submissions').where('assignment_id', '==', assignmentId).get();
        return {
            courseId: a.data().course_id,
            resourceId: `assignment:${assignmentId}`,
            label: a.data().title || 'Trabajo práctico',
            rows: subs.docs.map((d) => ({ studentId: d.data().student_id, grade: d.data().grade, feedback: d.data().feedback })),
        };
    }
    const a = await db.collection('assessments').doc(assessmentId).get();
    if (!a.exists) throw new HttpsError('not-found', 'La evaluación no existe.');
    const grades = await db.collection('assessment_grades').where('assessment_id', '==', assessmentId).get();
    return {
        courseId: a.data().course_id,
        resourceId: `assessment:${assessmentId}`,
        label: a.data().label || 'Parcial',
        rows: grades.docs.map((d) => ({ studentId: d.data().student_id, grade: d.data().absent ? '' : d.data().grade, feedback: d.data().feedback })),
    };
}

async function publishRows(db, { courseId, resourceId, label, rows }) {
    const contexts = (await linkedContexts(db, courseId))
        .filter((c) => c.ctx.ags_lineitems_url && (c.ctx.ags_scopes || []).includes(SCOPES.AGS_SCORE));
    if (contexts.length === 0) return { contexts: 0, published: 0, skipped: rows.length, failed: [] };

    const lti = services();
    const report = { contexts: contexts.length, published: 0, skipped: 0, failed: /** @type {{ studentId: string, reason: string }[]} */ ([]) };
    for (const { ctx, platform } of contexts) {
        const lineItem = await lti.ensureLineItem(platform, ctx.ags_lineitems_url, { resourceId, label, scoreMaximum: 10, tag: resourceId.split(':')[0] });
        const scoreMaximum = Number(lineItem.scoreMaximum) || 10;
        for (const row of rows) {
            const ratio = gradeToOutcomeScore(row.grade);
            const profile = (await db.collection('profiles').doc(row.studentId).get()).data() || {};
            const userId = profile.lti_subs && profile.lti_subs[platform.id];
            if (ratio === null || !userId) { report.skipped++; continue; }
            try {
                // Escala 0–10 → máximo del line item en Moodle.
                await lti.publishScore(platform, lineItem.id, {
                    userId, scoreGiven: Math.round(ratio * scoreMaximum * 100) / 100, scoreMaximum, comment: row.feedback,
                });
                report.published++;
            } catch (e) {
                report.failed.push({ studentId: row.studentId, reason: e.message });
            }
        }
    }
    return report;
}

/** AGS 2.0: publica todas las notas numéricas de un TP o parcial en Moodle. */
async function publishLtiGrades(payload, context) {
    const { uid, db, admin } = context;
    if (!payload.assignmentId === !payload.assessmentId) {
        throw new HttpsError('invalid-argument', 'Indicá un trabajo práctico o un parcial.');
    }
    const item = await gradesFor(db, payload);
    if (item.courseId !== payload.courseId) throw new HttpsError('invalid-argument', 'La actividad no pertenece a esta cátedra.');
    const report = await publishRows(db, item);
    if (report.contexts === 0) {
        throw new HttpsError('failed-precondition', 'No hay un curso de Moodle vinculado con el servicio de calificaciones (AGS).');
    }
    await db.collection('audit_logs').add({
        action: 'lti_ags_publish', course_id: payload.courseId, resource_id: item.resourceId, actor_id: uid,
        published: report.published, skipped: report.skipped, failed: report.failed.length,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return report;
}

/**
 * Publicación automática de una nota recién cargada. Nunca hace fallar la
 * calificación: sin vínculo LTI o sin clave configurada, no hace nada.
 *
 * @param {any} db
 * @param {{ assignmentId?: string, assessmentId?: string, studentId: string, grade: unknown, feedback?: string }} item
 */
async function publishSingleGrade(db, { assignmentId, assessmentId, studentId, grade, feedback }) {
    try {
        const item = await gradesFor(db, { assignmentId, assessmentId });
        await publishRows(db, { ...item, rows: [{ studentId, grade, feedback }] });
    } catch (e) {
        if (e && e.code !== 'not_configured') logger.warn('[LTI] no se pudo publicar la nota en Moodle', { studentId, error: e.message });
    }
}

module.exports = {
    createLtiRegistrationToken,
    registerLtiPlatform,
    getLtiPlatforms,
    unlinkLtiPlatform,
    getLtiPlatformsForReview,
    setLtiPlatformStatus,
    syncLtiRoster,
    publishLtiGrades,
    publishSingleGrade,
};
