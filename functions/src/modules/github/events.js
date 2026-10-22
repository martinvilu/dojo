/**
 * Webhook de eventos de GitHub (plan F4.8, ex 2.7): sincroniza el estado de
 * las entregas con los Pull Requests y sus reviews.
 *
 *   pull_request opened/reopened/synchronize/ready_for_review → `submitted`
 *       (primer envío: calcula "Fuera de término"; tras cambios pedidos: reentrega)
 *   push → registra actividad; si había cambios pedidos, vuelve a `submitted`
 *   pull_request_review submitted: changes_requested → `changes_requested`,
 *       approved → `approved` (Check Verde)
 *
 * Seguridad: firma HMAC-SHA256 (`X-Hub-Signature-256`) sobre el cuerpo crudo
 * con GITHUB_WEBHOOK_SECRET, e idempotencia por `X-GitHub-Delivery` en
 * `processed_webhooks` (TTL 30 días). Cada cambio de estado queda en
 * `audit_logs`.
 */
const { createHmac, timingSafeEqual } = require('node:crypto');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const { submissionLateness } = require('./assignments');

const DELIVERY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PR_SUBMIT_ACTIONS = new Set(['opened', 'reopened', 'synchronize', 'ready_for_review']);

function verifySignature(rawBody, header, secret) {
    if (!secret || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
    const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`);
    const given = Buffer.from(header);
    return expected.length === given.length && timingSafeEqual(expected, given);
}

async function findSubmission(db, fullName) {
    if (!fullName) return null;
    for (const url of new Set([`https://github.com/${fullName}`, `https://github.com/${fullName}`.toLowerCase()])) {
        const snap = await db.collection('submissions').where('repo_url', '==', url).get();
        if (!snap.empty) return snap.docs[0];
    }
    return null;
}

/**
 * Decide el cambio de estado para un evento; null si no aplica. Pura.
 * @returns {{ update: Record<string, any>, firstSubmission: boolean, label: string } | null}
 */
function transitionFor(event, body, submission, nowMs) {
    const status = submission.status || '';
    if (event === 'pull_request' && PR_SUBMIT_ACTIONS.has(body.action)) {
        if (status === 'approved') return null;
        const pr = body.pull_request || {};
        const update = { status: 'submitted', pr_url: pr.html_url || null, pr_number: pr.number || null, last_activity_at: new Date(nowMs) };
        if (status === 'changes_requested') update.resubmitted_at = new Date(nowMs);
        return { update, firstSubmission: !submission.submitted_at, label: status === 'changes_requested' ? 'resubmitted' : 'submitted' };
    }
    if (event === 'push') {
        const update = { last_push_at: new Date(nowMs) };
        if (status === 'changes_requested') Object.assign(update, { status: 'submitted', resubmitted_at: new Date(nowMs) });
        return { update, firstSubmission: false, label: update.status ? 'resubmitted' : 'push' };
    }
    if (event === 'pull_request_review' && body.action === 'submitted') {
        const review = body.review || {};
        const state = String(review.state || '').toLowerCase();
        const lastReview = { by: (review.user && review.user.login) || '', state, body: String(review.body || '').slice(0, 5000), at: new Date(nowMs).toISOString() };
        if (state === 'changes_requested') return { update: { status: 'changes_requested', last_review: lastReview }, firstSubmission: false, label: 'changes_requested' };
        if (state === 'approved') return { update: { status: 'approved', last_review: lastReview }, firstSubmission: false, label: 'approved' };
    }
    return null;
}

/**
 * @param {any} req
 * @param {any} res
 * @param {{ secret?: string, db?: any, nowMs?: number }} [opts]
 */
async function handleGithubEvent(req, res, { secret, db = getFirestore(), nowMs = Date.now() } = {}) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    if (!verifySignature(raw, req.headers['x-hub-signature-256'], secret)) return res.status(401).send('Firma inválida');

    const event = req.headers['x-github-event'];
    if (event === 'ping') return res.status(200).json({ ok: true });
    const deliveryId = req.headers['x-github-delivery'];
    if (!deliveryId || !/^[A-Za-z0-9-]{1,128}$/.test(deliveryId)) return res.status(400).send('Falta X-GitHub-Delivery');

    const marker = db.collection('processed_webhooks').doc(`gh_${deliveryId}`);
    try {
        await marker.create({ source: 'github_events', event, processed_at: FieldValue.serverTimestamp(), expires_at: new Date(nowMs + DELIVERY_TTL_MS) });
    } catch (e) {
        if (e && (e.code === 6 || e.code === 'already-exists')) return res.status(200).json({ duplicate: true });
        throw e;
    }

    try {
        const body = req.body || {};
        const submissionDoc = await findSubmission(db, body.repository && body.repository.full_name);
        if (!submissionDoc) return res.status(202).json({ ignored: 'repositorio sin entrega en el Dojo' });
        const submission = submissionDoc.data();
        const transition = transitionFor(event, body, submission, nowMs);
        if (!transition) return res.status(202).json({ ignored: `evento ${event}/${body.action || ''}` });

        const update = { ...transition.update };
        if (transition.firstSubmission) {
            const { late, lateByHours } = await submissionLateness(db, submission.assignment_id, submission.student_id, nowMs);
            Object.assign(update, { submitted_at: new Date(nowMs), late, late_by_hours: lateByHours });
        }
        await submissionDoc.ref.update(update);
        if (update.status && update.status !== submission.status) {
            await db.collection('audit_logs').add({
                action: 'github_submission_status',
                submission_id: submissionDoc.id,
                assignment_id: submission.assignment_id,
                student_id: submission.student_id,
                previous_status: submission.status || '',
                new_status: update.status,
                github_event: `${event}:${body.action || ''}`,
                github_actor: (body.sender && body.sender.login) || '',
                created_at: FieldValue.serverTimestamp(),
            });
        }
        return res.status(200).json({ updated: submissionDoc.id, transition: transition.label });
    } catch (e) {
        await marker.delete().catch(() => {});
        logger.error('[githubEvents] error procesando evento', { event, error: e.message });
        return res.status(500).json({ error: 'No se pudo procesar el evento' });
    }
}

module.exports = { handleGithubEvent, verifySignature, transitionFor };
