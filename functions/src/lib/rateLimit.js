/**
 * Rate limiting de la callable `api` por usuario (mejora 3.05).
 *
 * Ventana fija por `uid` y grupo de acciones, con contadores en Firestore
 * (`rate_limits/{uid}_{grupo}_{ventana}`) para que el límite valga entre
 * instancias. Los documentos llevan `expires_at` para la política TTL.
 *
 * La clave es el uid y no la IP: la callable exige autenticación y en un aula
 * todos los alumnos salen por la misma IP (NAT), así que limitar por IP
 * bloquearía la firma de asistencia QR de una comisión entera.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');

const DEFAULT_LIMIT = { group: 'default', max: 120, windowSeconds: 60 };

const GROUPS = {
    qr: { max: 10, windowSeconds: 60, actions: ['submitQrAttendance'] },
    // El proyector consulta el código cada 15 s; holgura para varias pestañas.
    qrDisplay: { max: 30, windowSeconds: 60, actions: ['getQrSessionCode', 'startQrSession', 'stopQrSession'] },
    mail: {
        max: 30,
        windowSeconds: 3600,
        actions: ['sendGmailNotification', 'sendDirectStudentEmail', 'triggerScheduledEmailNow', 'notifyCourseStudents'],
    },
    heavy: {
        max: 10,
        windowSeconds: 600,
        actions: [
            'createSystemBackup', 'downloadSystemBackup', 'detectAssignmentPlagiarism',
            'syncMoodleCourseRoster', 'syncMoodleCourseContents', 'exportGradesToMoodleWebservice',
            'syncGradesFromSpreadsheet', 'syncGuaraniRoster', 'importAssessmentGrades', 'getAcademicConditions',
        ],
    },
};

const LIMIT_BY_ACTION = Object.fromEntries(Object.entries(GROUPS).flatMap(([group, cfg]) =>
    cfg.actions.map((action) => [action, { group, max: cfg.max, windowSeconds: cfg.windowSeconds }])));

function limitFor(action) {
    return LIMIT_BY_ACTION[action] || DEFAULT_LIMIT;
}

/**
 * Cuenta la llamada y lanza HttpsError('resource-exhausted') si supera el
 * límite. Ante un error de Firestore deja pasar la llamada (fail open): el
 * limitador protege recursos, no es una barrera de autorización.
 */
async function enforceRateLimit(db, uid, action, now = Date.now()) {
    const { group, max, windowSeconds } = limitFor(action);
    const windowMs = windowSeconds * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const ref = db.collection('rate_limits').doc(`${uid}_${group}_${windowStart}`);

    let count;
    try {
        count = await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const next = (snap.exists ? Number(snap.data().count) || 0 : 0) + 1;
            tx.set(ref, {
                uid,
                group,
                count: next,
                window_start: new Date(windowStart),
                expires_at: new Date(windowStart + windowMs * 2),
            });
            return next;
        });
    } catch (e) {
        logger.warn('[rateLimit] no se pudo registrar la llamada; se permite', { uid, action, error: e && e.message });
        return { allowed: true, count: null };
    }

    if (count > max) {
        const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
        throw new HttpsError(
            'resource-exhausted',
            `Demasiadas solicitudes. Esperá ${retryAfter} s antes de volver a intentar.`,
            { retryAfterSeconds: retryAfter }
        );
    }
    return { allowed: true, count };
}

module.exports = { enforceRateLimit, limitFor, GROUPS, DEFAULT_LIMIT };
