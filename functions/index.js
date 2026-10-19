const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentDeleted, onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const { ACTION_MODULES, loadActionHandler } = require('./src/actions');
const { authorizeAction } = require('./src/authz');
const { isSafeExternalUrl, escapeXml } = require('./src/lib/urls');
const { gradeToOutcomeScore } = require('./src/lib/grades');
const { enforceRateLimit } = require('./src/lib/rateLimit');
const { dojoError, toHttpsError } = require('./src/lib/errors');

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

async function syncGradeToMoodle(previousData, grade, feedback) {
    if (!previousData.moodle_lis_outcome_service_url || !previousData.moodle_lis_result_sourcedid) {
        logger.info("No Moodle LTI sync parameters found for submission:", previousData.id || "unknown");
        return;
    }

    // Verify if Moodle integration is enabled for this course
    if (previousData.assignment_id) {
        try {
            const assignmentDoc = await db.collection('assignments').doc(previousData.assignment_id).get();
            if (assignmentDoc.exists) {
                const assignment = assignmentDoc.data();
                const courseDoc = await db.collection('courses').doc(assignment.course_id).get();
                if (courseDoc.exists) {
                    const course = courseDoc.data();
                    if (!course.moodle_enabled) {
                        logger.info("Moodle integration is disabled for this course:", course.name);
                        return;
                    }
                }
            }
        } catch (e) {
            logger.error("Error verifying moodle_enabled setting in course:", e);
        }
    }

    const outcomeUrl = previousData.moodle_lis_outcome_service_url;
    const sourcedId = previousData.moodle_lis_result_sourcedid;

    // La URL la aporta el cliente al aceptar la tarea: nunca hacer POST a
    // hosts internos o sin TLS (SSRF).
    if (!isSafeExternalUrl(outcomeUrl)) {
        logger.warn("URL de outcome service de Moodle rechazada:", previousData.id || "unknown");
        return;
    }

    // Escala 0..10 -> 0.0..1.0. Las notas conceptuales ("Aprobado") no tienen
    // equivalente numérico: antes se enviaban como 0 y una nota 1/10 se
    // interpretaba como 100 %.
    const numericGrade = gradeToOutcomeScore(grade);
    if (numericGrade === null) {
        logger.info("Nota no numérica: no se sincroniza con Moodle:", previousData.id || "unknown");
        return;
    }

    logger.info(`Sincronizando nota ${numericGrade} con Moodle URL: ${outcomeUrl}`);

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>${Date.now()}</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <replaceResultRequest>
      <resultRecord>
        <sourcedGUID>
          <sourcedId>${escapeXml(sourcedId)}</sourcedId>
        </sourcedGUID>
        <result>
          <resultScore>
            <language>es</language>
            <textString>${numericGrade.toFixed(2)}</textString>
          </resultScore>
        </result>
      </resultRecord>
    </replaceResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>`;

    try {
        const fetch = require('node-fetch');
        const response = await fetch(outcomeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                'Authorization': 'OAuth realm=""'
            },
            body: xmlPayload
        });
        
        const resText = await response.text();
        logger.info("Respuesta de sincronización con Moodle:", response.status, resText);
        
        await db.collection('audit_logs').add({
            action: 'moodle_grade_sync',
            submission_id: previousData.id || '',
            status: response.ok ? 'success' : 'failure',
            status_code: response.status,
            grade: String(grade),
            normalized_grade: numericGrade,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        logger.error("Error al sincronizar nota con Moodle:", err);
    }
}


exports.api = onCall(async (request) => {
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

        const handler = loadActionHandler(action);
        if (handler === null) throw dojoError('UNKNOWN_ACTION', `Acción desconocida: ${action}`);
        if (!handler) {
            throw new HttpsError('internal', `El manejador para ${action} no está implementado en ${ACTION_MODULES[action]}`);
        }

        const callerProfile = await getMyProfile();
        const authorizedPayload = await authorizeAction(action, payload || {}, { uid, db, profile: callerProfile });

        logger.info(`[API Call] Iniciando acción: ${action}`, { uid, payload_keys: Object.keys(payload || {}) });

        const context = {
            uid,
            request,
            db,
            admin,
            getMyProfile,
            syncGradeToMoodle
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
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                logger.error("Error writing activity log:", e);
            }
        }

        logger.info(`[API Call] Acción completada: ${action}`, { uid });
        return result;
    } catch (e) {
        const httpsError = toHttpsError(e);
        const log = httpsError.code === 'internal' ? logger.error : logger.warn;
        log(`[API Error] Error en acción: ${action}`, { uid, code: httpsError.details && httpsError.details.code, error: e.message, stack: e.stack });
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

exports.sendDailySummaries = onSchedule({ schedule: 'every day 20:00', timeZone: 'America/Argentina/Buenos_Aires' }, async (event) => {
    const handler = require('./src/modules/notifications/notifications').sendDailySummaries;
    return handler(event);
});

// Borrado lógico de cátedras: purga en cascada las vencidas (mejora 3.21).
exports.purgeDeletedCourses = onSchedule({ schedule: 'every day 03:00', timeZone: 'America/Argentina/Buenos_Aires' }, async () => {
    const { purgeDeletedCourses } = require('./src/modules/system/cleanup');
    await purgeDeletedCourses(db, logger);
});

// Entregas y revisiones de una tarea eliminada (mejora 3.47).
exports.cleanupAssignmentData = onDocumentDeleted('assignments/{assignmentId}', async (event) => {
    const { cleanupAssignmentData } = require('./src/modules/system/cleanup');
    const counts = await cleanupAssignmentData(db, event.params.assignmentId);
    logger.info(`[cleanup] Tarea ${event.params.assignmentId} eliminada`, counts);
});

// Auditoría inmutable de toda modificación de nota o feedback (mejora 3.10).
exports.auditSubmissionGrades = onDocumentWritten('submissions/{submissionId}', async (event) => {
    const { gradeChangeAudit } = require('./src/lib/gradeAudit');
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    const entry = gradeChangeAudit(event.params.submissionId, before, after);
    if (!entry) return;
    await db.collection('audit_logs').add({ ...entry, created_at: admin.firestore.FieldValue.serverTimestamp() });
});
