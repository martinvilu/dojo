/**
 * Rate limiting de la callable `api` (mejora 3.05).
 *
 * Dos niveles:
 *   - Global por usuario, en memoria de la instancia: corta ráfagas de
 *     llamadas (scripts, loops de useEffect) sin costo de lecturas.
 *   - Por acción sensible, persistido en Firestore (`rate_limits`): sobrevive
 *     a las instancias efímeras de Cloud Functions y limita fuerza bruta
 *     (matrículas, códigos de invitación, QR) y envíos masivos de correo.
 *
 * Ventana fija: simple, predecible y suficiente para estos volúmenes. Los
 * documentos expiran por TTL de Firestore (`expires_at`). Si el almacén
 * falla, la llamada se deja pasar: un problema de infraestructura no debe
 * bloquear a toda la cátedra.
 */
const { HttpsError } = require('firebase-functions/v2/https');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const GLOBAL_POLICY = { limit: 120, windowMs: MINUTE };

const ACTION_POLICIES = {
    submitMatricula: { limit: 5, windowMs: 10 * MINUTE },
    enrollCourse: { limit: 10, windowMs: 10 * MINUTE },
    submitQrAttendance: { limit: 12, windowMs: MINUTE },
    addSecondaryEmail: { limit: 5, windowMs: 10 * MINUTE },
    acceptAssignment: { limit: 20, windowMs: 10 * MINUTE },
    createAssignment: { limit: 30, windowMs: HOUR },
    sendDirectStudentEmail: { limit: 30, windowMs: HOUR },
    sendGmailNotification: { limit: 30, windowMs: HOUR },
    createScheduledEmail: { limit: 20, windowMs: HOUR },
    triggerScheduledEmailNow: { limit: 10, windowMs: HOUR },
    notifyCourseStudents: { limit: 10, windowMs: HOUR },
    checkAndAlertStudentsAtRisk: { limit: 10, windowMs: HOUR },
    createSystemBackup: { limit: 5, windowMs: HOUR },
    detectAssignmentPlagiarism: { limit: 10, windowMs: 10 * MINUTE },
    bookTutoringSession: { limit: 10, windowMs: HOUR },
    postStudyGroupMessage: { limit: 30, windowMs: MINUTE },
    exportMyData: { limit: 5, windowMs: HOUR },
    requestCourseExport: { limit: 10, windowMs: HOUR },
    requestAccountDeletion: { limit: 5, windowMs: HOUR },
};

/**
 * Aplica una ventana fija a un contador. Pura: recibe el estado previo y
 * devuelve el nuevo estado y si la llamada está permitida.
 */
function consumeWindow(state, policy, now) {
    const fresh = !state || typeof state.window_start !== 'number' || now - state.window_start >= policy.windowMs;
    const windowStart = fresh ? now : state.window_start;
    const count = fresh ? 0 : Number(state.count) || 0;
    if (count >= policy.limit) {
        return { allowed: false, state: { window_start: windowStart, count }, retryAfterMs: windowStart + policy.windowMs - now };
    }
    return { allowed: true, state: { window_start: windowStart, count: count + 1 }, retryAfterMs: 0 };
}

function tooManyRequests(retryAfterMs) {
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return new HttpsError('resource-exhausted', `Demasiadas solicitudes. Reintentá en ${seconds} s.`, {
        code: 'RATE_LIMITED',
        retryAfterSeconds: seconds
    });
}

const memoryWindows = new Map();
const MEMORY_MAX_KEYS = 10000;

function consumeMemory(key, policy, now) {
    const result = consumeWindow(memoryWindows.get(key), policy, now);
    if (memoryWindows.size >= MEMORY_MAX_KEYS && !memoryWindows.has(key)) {
        // Purga simple: las ventanas viejas ya no limitan a nadie.
        for (const [k, v] of memoryWindows) {
            if (now - v.window_start >= HOUR) memoryWindows.delete(k);
        }
    }
    memoryWindows.set(key, result.state);
    return result;
}

async function consumePersistent(db, key, policy, now) {
    const ref = db.collection('rate_limits').doc(key);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const result = consumeWindow(snap.exists ? snap.data() : null, policy, now);
        if (result.allowed) {
            tx.set(ref, {
                ...result.state,
                expires_at: new Date(result.state.window_start + policy.windowMs)
            });
        }
        return result;
    });
}

/**
 * Lanza `resource-exhausted` si el usuario superó el límite global o el de
 * la acción. `logger` es opcional (para no acoplar los tests).
 */
async function enforceRateLimit(action, uid, { db, logger, now = Date.now() } = {}) {
    const global = consumeMemory(`global:${uid}`, GLOBAL_POLICY, now);
    if (!global.allowed) throw tooManyRequests(global.retryAfterMs);

    const policy = Object.prototype.hasOwnProperty.call(ACTION_POLICIES, action) ? ACTION_POLICIES[action] : null;
    if (!policy) return;

    let result;
    try {
        if (!db || typeof db.runTransaction !== 'function') throw new Error('store unavailable');
        result = await consumePersistent(db, `${uid}__${action}`, policy, now);
    } catch (e) {
        if (logger) logger.warn('[rateLimit] almacén no disponible, uso memoria:', e.message);
        result = consumeMemory(`${action}:${uid}`, policy, now);
    }
    if (!result.allowed) throw tooManyRequests(result.retryAfterMs);
}

function resetMemoryRateLimits() {
    memoryWindows.clear();
}

module.exports = {
    GLOBAL_POLICY,
    ACTION_POLICIES,
    consumeWindow,
    enforceRateLimit,
    resetMemoryRateLimits
};
