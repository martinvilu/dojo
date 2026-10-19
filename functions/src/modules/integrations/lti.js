/**
 * Canje de launches LTI 1.3 verificados (mejora 3.12). /api/lti/launch
 * guarda el launch ya verificado en lti_launches y el dashboard solo recibe
 * su ID; acá se vincula al usuario de Ninja Dojo y se devuelve el contexto
 * de navegación. Nada del launch se toma de la URL ni del navegador.
 */
const { dojoError } = require('../../lib/errors');

const toMillis = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : new Date(v).getTime());

async function readOwnLaunch(db, uid, launchId, { allowExpired = false } = {}) {
    if (typeof launchId !== 'string' || !launchId) return null;
    const snap = await db.collection('lti_launches').doc(launchId).get();
    if (!snap.exists) return null;
    const launch = snap.data();
    if (launch.consumed_by && launch.consumed_by !== uid) return null;
    if (!allowExpired && toMillis(launch.expires_at) < Date.now()) return null;
    return { ref: snap.ref, launch };
}

async function consumeLtiLaunch(payload, context) {
    const { uid, db, admin } = context;
    const found = await readOwnLaunch(db, uid, payload.launchId);
    if (!found || found.launch.messageType !== 'LtiResourceLinkRequest') {
        throw dojoError('NOT_FOUND', "El inicio desde Moodle expiró o no es válido: volvé a abrir la actividad.");
    }
    const { ref, launch } = found;
    if (!launch.consumed_by) {
        await ref.update({ consumed_by: uid, consumed_at: new Date() });
        await db.collection('profiles').doc(uid).set({
            lti_identities: admin.firestore.FieldValue.arrayUnion(`${launch.issuer}|${launch.sub}`)
        }, { merge: true });
    }
    return {
        courseId: launch.courseId || null,
        assignmentId: launch.assignmentId || null,
        targetModule: launch.targetModule || null,
        isInstructor: Boolean(launch.isInstructor),
        hasGradeService: Boolean(launch.ags && launch.ags.lineitem),
        emailMatches: !launch.email || !context.authUser || !context.authUser.email
            || String(context.authUser.email).toLowerCase() === launch.email
    };
}

/** Datos AGS que se guardan en la entrega aceptada desde un launch propio. */
async function agsFieldsForSubmission(db, uid, launchId) {
    const found = await readOwnLaunch(db, uid, launchId, { allowExpired: true });
    if (!found || !found.launch.ags || !found.launch.ags.lineitem) return {};
    return {
        lti_issuer: found.launch.issuer,
        lti_user_sub: found.launch.sub,
        lti_ags_lineitem: found.launch.ags.lineitem
    };
}

module.exports = { consumeLtiLaunch, agsFieldsForSubmission };
