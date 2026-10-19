/**
 * Otorgamiento de XP idempotente y atómico (mejora 3.26).
 *
 * Cada evento tiene una clave determinística (p. ej. la clase en la que se
 * firmó asistencia): el log `profiles/{uid}/xp_logs/{key}` y el contador
 * `profiles/{uid}.xp_total` se escriben en la misma transacción, con
 * `FieldValue.increment`, así que dos escaneos simultáneos no otorgan XP
 * dos veces ni pisan el total.
 */
const ALREADY_AWARDED = Symbol('already-awarded');

function sanitizeKey(key) {
    return String(key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);
}

/** @returns {Promise<boolean>} true si se otorgó, false si ya existía. */
async function awardXp(db, FieldValue, uid, { key, action, description, points }) {
    const profileRef = db.collection('profiles').doc(uid);
    const logRef = profileRef.collection('xp_logs').doc(sanitizeKey(key));
    try {
        await db.runTransaction(async (tx) => {
            const existing = await tx.get(logRef);
            if (existing.exists) throw ALREADY_AWARDED;
            tx.set(logRef, {
                action,
                description,
                points,
                timestamp: FieldValue.serverTimestamp()
            });
            tx.set(profileRef, { xp_total: FieldValue.increment(points) }, { merge: true });
        });
        return true;
    } catch (e) {
        if (e === ALREADY_AWARDED) return false;
        throw e;
    }
}

module.exports = { awardXp, sanitizeKey };
