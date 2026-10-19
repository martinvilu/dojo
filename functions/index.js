const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentDeleted, onDocumentWritten, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

// Secretos desde Google Secret Manager (mejora 3.06). Se activa con
// DOJO_SECRETS_FROM_SECRET_MANAGER=true en functions/.env.<proyecto> una vez
// creados con scripts/setup-secrets.sh: declarar un secreto inexistente hace
// fallar el deploy. Firebase los inyecta en process.env, así que el código
// que los lee no cambia. Sin el flag se usan variables de entorno comunes.
const SECRET_NAMES = ['TOKEN_ENCRYPTION_KEY', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'LTI_TOOL_PRIVATE_KEY'];
const secrets = process.env.DOJO_SECRETS_FROM_SECRET_MANAGER === 'true'
    ? SECRET_NAMES.map((name) => defineSecret(name))
    : [];
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
admin.initializeApp();

// Los handlers reciben un "admin" con FieldValue/Timestamp de la API
// modular: el runtime del emulador de Functions envuelve el namespace
// admin.firestore y ahí admin.firestore.FieldValue queda indefinido.
const handlerAdmin = {
    auth: (...args) => admin.auth(...args),
    firestore: Object.assign((...args) => admin.firestore(...args), { FieldValue, Timestamp })
};

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const { ACTION_MODULES, loadActionHandler } = require('./src/actions');
const { authorizeAction } = require('./src/authz');
const { gradeToOutcomeScore } = require('./src/lib/grades');
const { postScore } = require('./src/lib/ltiAgs');
const { enforceRateLimit } = require('./src/lib/rateLimit');
const { dojoError, toHttpsError } = require('./src/lib/errors');
const { validatePayload } = require('./src/lib/validate');
const { assertSessionNotRevoked } = require('./src/lib/sessionGuard');

const SECRET_KEY_PATTERN = /token|secret|password|api_?key|sourcedid/i;

/** Copia del payload apta para bitácoras: oculta credenciales y tokens. */
function redactSecrets(value) {
    if (Array.isArray(value)) return value.map(redactSecrets);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, inner]) => [
            key,
            SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : redactSecrets(inner)
        ]));
    }
    return value;
}

/**
 * Publica la nota de una entrega lanzada desde Moodle con LTI Advantage AGS
 * (mejora 3.12). Las notas conceptuales no tienen equivalente numérico y no
 * se envían. Cada intento queda en audit_logs.
 */
async function syncGradeToMoodle(submission, grade, feedback) {
    if (!submission.lti_ags_lineitem || !submission.lti_user_sub) return;

    if (submission.assignment_id) {
        const assignmentDoc = await db.collection('assignments').doc(submission.assignment_id).get();
        const courseId = assignmentDoc.exists ? assignmentDoc.data().course_id : null;
        const courseDoc = courseId ? await db.collection('courses').doc(courseId).get() : null;
        if (courseDoc && courseDoc.exists && !courseDoc.data().moodle_enabled) {
            logger.info("Moodle deshabilitado para el curso: no se sincroniza la nota", submission.id);
            return;
        }
    }

    // 0..10 -> 0..1 para la auditoría; AGS recibe la nota sobre 10.
    const outcome = gradeToOutcomeScore(grade);
    if (outcome === null) {
        logger.info("Nota no numérica: no se sincroniza con Moodle:", submission.id || "unknown");
        return;
    }

    let status = null;
    let error = null;
    try {
        status = await postScore({ lineitem: submission.lti_ags_lineitem, userId: submission.lti_user_sub, score: outcome * 10, comment: feedback });
    } catch (e) {
        error = e.message;
        logger.error("Error al sincronizar nota con Moodle (AGS):", e.message);
    }
    await db.collection('audit_logs').add({
        action: 'moodle_grade_sync',
        submission_id: submission.id || '',
        status: status && status < 300 ? 'success' : 'failure',
        status_code: status,
        error,
        grade: String(grade),
        normalized_grade: outcome,
        created_at: FieldValue.serverTimestamp()
    });
    // Un error de red o de Moodle se relanza para que el trigger reintente.
    if (error || (status && status >= 500)) throw new Error(error || `Moodle respondió ${status}`);
}

// App Check (mejora 3.45): con DOJO_ENFORCE_APP_CHECK=true la callable
// rechaza llamadas que no vengan de la app oficial (token de reCAPTCHA
// Enterprise). Se activa después de registrar la app en la consola.
const enforceAppCheck = process.env.DOJO_ENFORCE_APP_CHECK === 'true';

exports.api = onCall({ secrets, enforceAppCheck }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in.');
    const uid = request.auth.uid;
    const { action, payload } = request.data;
    
    const getMyProfile = async () => {
        try {
            const snap = await db.collection('profiles').doc(uid).get();
            return (snap && typeof snap.data === 'function') ? snap.data() : null;
        } catch (e) {
            return null;
        }
    };
    
    try {
        await enforceRateLimit(action, uid, { db, logger });
        await assertSessionNotRevoked(admin.auth(), { uid, ...(request.auth.token || {}) }, { logger });

        const handler = loadActionHandler(action);
        if (handler === null) throw dojoError('UNKNOWN_ACTION', `Acción desconocida: ${action}`);
        if (!handler) {
            throw new HttpsError('internal', `El manejador para ${action} no está implementado en ${ACTION_MODULES[action]}`);
        }

        const callerProfile = await getMyProfile();
        const authorizedPayload = await authorizeAction(action, validatePayload(payload), { uid, db, profile: callerProfile });

        logger.info(`[API Call] Iniciando acción: ${action}`, { uid, payload_keys: Object.keys(payload || {}) });

        const context = {
            uid,
            // Claims del ID token ya verificado por onCall: única fuente de
            // identidad (email, nombre, foto, proveedor, auth_time).
            authUser: request.auth.token || {},
            request,
            db,
            admin: handlerAdmin,
            get bucket() { return admin.storage().bucket(); },
            getMyProfile
        };
        
        const result = await handler(authorizedPayload, context);

        // Auto log write actions in activity_logs
        if (action !== 'getProfile' && action !== 'getActivityLogs' && action !== 'getStudentNotifications' && !action.startsWith('get')) {
            try {
                const pData = callerProfile;
                await db.collection('activity_logs').add({
                    uid,
                    user_name: pData ? (pData.full_name || pData.email) : 'Usuario',
                    user_email: pData ? pData.email : '',
                    user_role: pData ? pData.role : 'student',
                    action: action,
                    details: payload ? JSON.stringify(redactSecrets(payload)).substring(0, 200) : '',
                    timestamp: FieldValue.serverTimestamp()
                });
            } catch (e) {
                logger.error("Error writing activity log:", e);
            }
        }

        logger.info(`[API Call] Acción completada: ${action}`, { uid });
        return result;
    } catch (/** @type {any} */ e) {
        const httpsError = toHttpsError(e);
        const log = httpsError.code === 'internal' ? logger.error : logger.warn;
        log(`[API Error] Error en acción: ${action}`, { uid, code: /** @type {any} */ (httpsError.details)?.code, error: e.message, stack: e.stack });
        throw httpsError;
    }
});

exports.calendar = onRequest(async (req, res) => {
    const calendarHandler = require('./src/modules/calendar/calendar').calendar;
    return calendarHandler(req, res);
});

exports.webhook = onRequest(async (req, res) => {
    const webhookHandler = require('./src/modules/github/webhook').webhook;
    return webhookHandler(req, res);
});

exports.importGrades = onRequest(async (req, res) => {
    const handler = require('./src/modules/course/export').importGrades;
    return handler(req, res);
});

exports.sendDailySummaries = onSchedule({ schedule: 'every day 20:00', timeZone: 'America/Argentina/Buenos_Aires', secrets }, async (event) => {
    const handler = require('./src/modules/notifications/notifications').sendDailySummaries;
    return handler(event);
});

// Borrado lógico de cátedras: purga en cascada las vencidas (mejora 3.21).
exports.purgeDeletedCourses = onSchedule({ schedule: 'every day 03:00', timeZone: 'America/Argentina/Buenos_Aires' }, async () => {
    const { purgeDeletedCourses, purgeExpiredExports } = require('./src/modules/system/cleanup');
    await purgeDeletedCourses(db, logger);
    try {
        const removed = await purgeExpiredExports(admin.storage().bucket());
        if (removed) logger.info(`[cleanup] ${removed} exportaciones vencidas borradas`);
    } catch (e) {
        logger.warn('[cleanup] no se pudieron limpiar las exportaciones:', e.message);
    }
});

// Entregas y revisiones de una tarea eliminada (mejora 3.47).
exports.cleanupAssignmentData = onDocumentDeleted('assignments/{assignmentId}', async (event) => {
    const { cleanupAssignmentData } = require('./src/modules/system/cleanup');
    const counts = await cleanupAssignmentData(db, event.params.assignmentId);
    logger.info(`[cleanup] Tarea ${event.params.assignmentId} eliminada`, counts);
});

// Todo cambio de nota o feedback, venga de donde venga: se audita (mejora
// 3.10) y, si la entrega llegó por LTI, se sincroniza con Moodle (mejora
// 3.19). Como trigger, Firebase reintenta ante fallas transitorias.
exports.onSubmissionGradeChange = onDocumentWritten({ document: 'submissions/{submissionId}', secrets }, async (event) => {
    const { handleSubmissionGradeChange } = require('./src/lib/gradeAudit');
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    await handleSubmissionGradeChange(
        { db, serverTimestamp: () => FieldValue.serverTimestamp(), syncGradeToMoodle },
        event.params.submissionId, before, after
    );
});

// Aviso al estudiante cuando su mensaje se marca como solución (mejora 3.25).
exports.onClassCommentUpdated = onDocumentUpdated('courses/{courseId}/class_comments/{commentId}', async (event) => {
    const { notifyBestAnswer } = require('./src/modules/notifications/forum');
    await notifyBestAnswer(
        { db, serverTimestamp: () => FieldValue.serverTimestamp() },
        event.params.courseId,
        event.data.before.data(),
        event.data.after.data()
    );
});

// Reintentos con backoff exponencial de eventos de autograding que fallaron
// por errores transitorios (mejora 3.38).
exports.retryWebhookDeadLetters = onSchedule({ schedule: 'every 10 minutes', timeZone: 'America/Argentina/Buenos_Aires' }, async () => {
    const { retryDeadLetters } = require('./src/modules/github/webhook');
    const summary = await retryDeadLetters(db);
    if (summary.done || summary.retried || summary.failed) logger.info('[webhook] cola de reintentos', summary);
});

// Export diario completo de Firestore a Cloud Storage (mejora 3.22).
exports.dailyFirestoreExport = onSchedule({ schedule: 'every day 04:00', timeZone: 'America/Argentina/Buenos_Aires' }, async () => {
    const { exportFirestore } = require('./src/modules/system/firestoreExport');
    const { v1 } = require('@google-cloud/firestore');
    const projectId = process.env.GCLOUD_PROJECT || JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId;
    await exportFirestore({ projectId, bucket: process.env.BACKUP_BUCKET, client: new v1.FirestoreAdminClient(), logger });
});

// Exportaciones pesadas en segundo plano (mejoras 3.16 y 3.32).
exports.onExportJobCreated = onDocumentCreated({ document: 'export_jobs/{jobId}', timeoutSeconds: 300, memory: '512MiB' }, async (event) => {
    const { processExportJob } = require('./src/modules/course/exportJobs');
    await processExportJob(
        { db, bucket: admin.storage().bucket(), serverTimestamp: () => FieldValue.serverTimestamp() },
        event.params.jobId,
        event.data && event.data.data()
    );
});
