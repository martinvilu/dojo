const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { normalizeGrade, normalizeFeedback } = require("../../lib/grades");
const { matchesSecret } = require("../../lib/secrets");
const { gradeAttribution } = require('../../lib/gradeAudit');

// Idempotencia (mejora 3.08): cada entrega identificada por cabecera se
// procesa una sola vez; el marcador expira por TTL de Firestore.
const DELIVERY_HEADERS = ['x-dojo-delivery', 'x-github-delivery'];
const DELIVERY_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const DELIVERY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ALREADY_EXISTS = 6;

function getDeliveryId(req) {
    const headers = req.headers || {};
    for (const name of DELIVERY_HEADERS) {
        const value = headers[name];
        if (typeof value === 'string' && DELIVERY_ID_RE.test(value)) return value;
    }
    return null;
}

/** Registra la entrega; devuelve false si ya había sido procesada. */
async function claimDelivery(db, assignmentId, deliveryId) {
    const ref = db.collection('processed_webhooks').doc(`${assignmentId}_${deliveryId}`);
    try {
        await ref.create({
            assignment_id: assignmentId,
            delivery_id: deliveryId,
            processed_at: FieldValue.serverTimestamp(),
            expires_at: new Date(Date.now() + DELIVERY_TTL_MS)
        });
        return { claimed: true, ref };
    } catch (e) {
        if (e && (e.code === ALREADY_EXISTS || e.code === 'already-exists')) return { claimed: false, ref };
        throw e;
    }
}

// Throttle anti fuerza bruta del sync_secret. Ventana en memoria por
// instancia: en serverless es un disuasivo best-effort (las instancias
// son efímeras), combinado con secrets de 32 hex chars hace impráctico
// adivinar el token.
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attemptsByIp = new Map();

function registerFailedAttempt(ip) {
    const now = Date.now();
    const entry = attemptsByIp.get(ip) || { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + ATTEMPT_WINDOW_MS;
    }
    entry.count += 1;
    attemptsByIp.set(ip, entry);
    return entry.count;
}

function isThrottled(ip) {
    const entry = attemptsByIp.get(ip);
    if (!entry) return false;
    if (Date.now() > entry.resetAt) {
        attemptsByIp.delete(ip);
        return false;
    }
    return entry.count >= MAX_ATTEMPTS;
}

/**
 * Aplica las notas del autograding a las entregas de la tarea. Lanza si la
 * escritura falla; la usa tanto el webhook como el reintento de la cola.
 */
async function applyAutogradingGrades(db, assignmentId, grades) {
    const batch = db.batch();
    let updatedCount = 0;
    const rejected = [];

    for (const g of grades) {
        if (!g || !g.matricula || (!g.grade && !g.feedback)) continue;
        const normalized = normalizeGrade(g.grade);
        if (!normalized.ok) {
            rejected.push({ matricula: String(g.matricula), reason: normalized.error });
            continue;
        }
        const grade = normalized.value;
        const feedback = normalizeFeedback(g.feedback);

        const pSnap = await db.collection('profiles').where('matricula_unrn', '==', String(g.matricula)).get();
        if (pSnap.empty) continue;

        const studentId = pSnap.docs[0].id;
        const sSnap = await db.collection('submissions').where('assignment_id', '==', assignmentId).where('student_id', '==', studentId).get();

        if (!sSnap.empty) {
            batch.update(sSnap.docs[0].ref, {
                grade,
                feedback,
                graded_at: FieldValue.serverTimestamp(),
                ...gradeAttribution('autograding')
            });
        } else {
            // ID determinista: un reintento sin cabecera de entrega no
            // duplica la entrega del estudiante.
            const subRef = db.collection('submissions').doc(`${assignmentId}_${studentId}`);
            batch.set(subRef, {
                assignment_id: assignmentId,
                student_id: studentId,
                repo_url: '',
                grade,
                feedback,
                ...gradeAttribution('autograding'),
                is_locked: false,
                graded_at: FieldValue.serverTimestamp(),
                created_at: FieldValue.serverTimestamp()
            });
        }
        updatedCount++;
    }
    await batch.commit();
    return { updatedCount, rejected };
}

// Cola de reintentos (dead letter queue) con backoff exponencial.
const DEAD_LETTERS = 'webhook_dead_letters';
const MAX_ATTEMPTS_DLQ = 6;
const BASE_DELAY_MS = 5 * 60 * 1000;

function nextAttemptAt(attempts, now = Date.now()) {
    return new Date(now + BASE_DELAY_MS * Math.pow(2, attempts));
}

async function enqueueDeadLetter(db, { assignmentId, grades, deliveryId, error }) {
    const ref = await db.collection(DEAD_LETTERS).add({
        source: 'autograding',
        assignment_id: assignmentId,
        grades,
        delivery_id: deliveryId || null,
        status: 'pending',
        attempts: 0,
        last_error: String((error && error.message) || error).slice(0, 500),
        created_at: new Date(),
        next_attempt_at: nextAttemptAt(0)
    });
    return ref.id;
}

/** Reprocesa los eventos vencidos de la cola. Lo invoca un cron. */
async function retryDeadLetters(db, now = new Date()) {
    const snap = await db.collection(DEAD_LETTERS)
        .where('status', '==', 'pending')
        .where('next_attempt_at', '<=', now)
        .limit(50)
        .get();
    const summary = { done: 0, retried: 0, failed: 0 };
    for (const doc of snap.docs) {
        const letter = doc.data();
        try {
            const result = await applyAutogradingGrades(db, letter.assignment_id, letter.grades || []);
            await doc.ref.update({ status: 'done', processed_at: now, result });
            summary.done++;
        } catch (e) {
            const attempts = (letter.attempts || 0) + 1;
            const exhausted = attempts >= MAX_ATTEMPTS_DLQ;
            await doc.ref.update({
                attempts,
                status: exhausted ? 'failed' : 'pending',
                last_error: String(e.message || e).slice(0, 500),
                next_attempt_at: exhausted ? null : nextAttemptAt(attempts, now.getTime())
            });
            if (exhausted) {
                summary.failed++;
                logger.error("[webhook] evento descartado tras agotar reintentos:", doc.id, e.message);
            } else {
                summary.retried++;
            }
        }
    }
    return summary;
}

exports.webhook = async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Content-Type, X-Dojo-Delivery');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    if (isThrottled(req.ip || 'unknown')) {
        logger.warn("[webhook] throttled:", req.ip);
        return res.status(429).send('Demasiados intentos inválidos. Reintentá más tarde.');
    }

    
    const { assignmentId, sync_secret, grades } = req.body;
    if (!assignmentId || !sync_secret || !grades) {
        return res.status(400).send('Faltan parametros requeridos');
    }
    
    const db = getFirestore();
    
    try {
        const aSnap = await db.collection('assignments').doc(assignmentId).get();
        if (!aSnap.exists) return res.status(404).send('Assignment not found');
        const assignment = aSnap.data();
        
        if (!matchesSecret(sync_secret, assignment.sync_secret)) {
            registerFailedAttempt(req.ip || 'unknown');
            return res.status(401).send('Invalid secret');
        }
        
        if (!Array.isArray(grades)) return res.status(400).send('grades debe ser un array');

        const deliveryId = getDeliveryId(req);
        let delivery = null;
        if (deliveryId) {
            delivery = await claimDelivery(db, assignmentId, deliveryId);
            if (!delivery.claimed) {
                logger.info("[webhook] entrega duplicada ignorada:", deliveryId);
                return res.json({ success: true, duplicate: true, updatedCount: 0, rejected: [] });
            }
        }

        let result;
        try {
            result = await applyAutogradingGrades(db, assignmentId, grades);
        } catch (e) {
            // Falla transitoria (Firestore, red): el evento ya está validado,
            // así que va a la cola de reintentos en lugar de perderse
            // (mejora 3.38). El marcador de entrega queda tomado para que un
            // reintento del cliente no lo procese dos veces.
            try {
                const letterId = await enqueueDeadLetter(db, { assignmentId, grades, deliveryId, error: e });
                logger.warn("[webhook] evento encolado para reintento:", letterId, e.message);
                return res.status(202).json({ success: false, queued: true, retryId: letterId });
            } catch (queueError) {
                if (delivery) await delivery.ref.delete().catch(() => {});
                throw e;
            }
        }
        const { updatedCount, rejected } = result;
        res.json({ success: true, updatedCount, rejected });
    } catch(e) {
        logger.error("Error en webhook github:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.applyAutogradingGrades = applyAutogradingGrades;
exports.enqueueDeadLetter = enqueueDeadLetter;
exports.retryDeadLetters = retryDeadLetters;
exports.nextAttemptAt = nextAttemptAt;
exports.MAX_ATTEMPTS_DLQ = MAX_ATTEMPTS_DLQ;
