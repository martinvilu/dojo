const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { dojoError } = require('../../lib/errors');
const { normalizeEmail } = require('../../lib/validate');
const { forgetSession } = require('../../lib/sessionGuard');
const { syncRoleClaim } = require('../../lib/claims');

const SECURITY_LOG_LIMIT = 20;

function clientIp(request) {
    const raw = request && request.rawRequest;
    if (!raw) return null;
    const forwarded = raw.headers && raw.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) || raw.ip || null;
    return ip ? String(ip).slice(0, 64) : null;
}

/** IPv4 sin el último octeto / IPv6 sin los últimos grupos, para mostrar. */
function maskIp(ip) {
    if (!ip) return null;
    if (ip.includes('.')) return ip.split('.').slice(0, 3).join('.') + '.x';
    return ip.split(':').slice(0, 3).join(':') + ':…';
}

/**
 * Registra cada inicio de sesión nuevo (un auth_time distinto al último
 * visto) en profiles/{uid}/security_log, conservando los últimos 20
 * (mejora 3.44). Nunca hace fallar el login.
 */
async function recordLogin(db, ref, profile, authUser, request) {
    const authTime = Number(authUser.auth_time) || null;
    if (!authTime || profile.last_auth_time === authTime) return;
    const headers = (request && request.rawRequest && request.rawRequest.headers) || {};
    const entry = {
        auth_time: new Date(authTime * 1000),
        provider: (authUser.firebase && authUser.firebase.sign_in_provider) || null,
        ip: clientIp(request),
        user_agent: typeof headers['user-agent'] === 'string' ? headers['user-agent'].slice(0, 300) : null,
        recorded_at: new Date()
    };
    const log = ref.collection('security_log');
    await log.doc(String(authTime)).set(entry);
    await ref.update({ last_auth_time: authTime });
    const old = await log.orderBy('auth_time', 'desc').offset(SECURITY_LOG_LIMIT).get();
    if (!old.empty) {
        const batch = db.batch();
        old.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
}

async function getProfile(payload, context) {
    const { uid, db, request } = context;
    const authUser = context.authUser || {};
    const ref = db.collection('profiles').doc(uid);
    let pSnap = await ref.get();
    // La identidad sale solo del ID token verificado: el payload lo controla
    // el cliente y no puede elegir su email (ni, por ende, auto-promoverse
    // con SEED_ADMIN_EMAILS).
    const email = normalizeEmail(authUser.email) || '';

    if (!pSnap.exists) {
        let role = 'student';
        // Auto-promoción SOLO para seeds locales: configurá SEED_ADMIN_EMAILS
        // en .env del emulador. Nunca activo en producción por defecto.
        const seedEmails = String(process.env.SEED_ADMIN_EMAILS || '')
            .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        if (email && seedEmails.includes(email)) {
            role = process.env.SEED_TEACHER_EMAILS && String(process.env.SEED_TEACHER_EMAILS)
                .split(',').map(e => e.trim().toLowerCase()).includes(email) ? 'teacher' : 'admin';
        }

        const name = typeof authUser.name === 'string' && authUser.name.trim() ? authUser.name.trim().slice(0, 120) : (email ? email.split('@')[0] : 'Usuario');
        const profileData = {
            id: uid,
            full_name: name,
            email: email,
            role: role,
            avatar_url: typeof authUser.picture === 'string' && authUser.picture.startsWith('https://') ? authUser.picture : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
            account_status: role === 'student' ? 'pending' : 'approved',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            last_login: admin.firestore.FieldValue.serverTimestamp()
        };
        await ref.set(profileData, { merge: true });
        pSnap = await ref.get();
        if (!pSnap.exists) return profileData;
    } else {
        const update = { last_login: admin.firestore.FieldValue.serverTimestamp() };
        // Perfiles creados sin email (el backend no recibía el token): se
        // completan con el email verificado del proveedor.
        if (!pSnap.data().email && email) update.email = email;
        await ref.update(update);
    }

    const data = pSnap.data();
    if (!data.email && email) data.email = email;
    try {
        await recordLogin(db, ref, data, authUser, request);
    } catch (e) {
        logger.warn('[getProfile] No se pudo registrar el inicio de sesión:', e.message);
    }
    // Autocorrección del custom claim de rol (mejora 3.34): si el token no
    // trae el rol del perfil, se actualiza y el cliente refresca su token.
    if (data.role && authUser.role !== data.role) {
        try {
            data.claims_refresh_required = await syncRoleClaim(admin.auth(), uid, data.role);
        } catch (e) {
            logger.warn('[getProfile] No se pudo sincronizar el claim de rol:', e.message);
        }
    }
    data.last_login = admin.firestore.Timestamp.now();
    return data;
}

/** Revoca todas las sesiones del usuario en todos sus dispositivos. */
async function signOutEverywhere(payload, context) {
    const { uid, admin: adminSdk } = context;
    await (adminSdk || admin).auth().revokeRefreshTokens(uid);
    forgetSession(uid);
    return { success: true };
}

async function getSecurityLog(payload, context) {
    const { uid, db } = context;
    const snap = await db.collection('profiles').doc(uid).collection('security_log')
        .orderBy('auth_time', 'desc').limit(SECURITY_LOG_LIMIT).get();
    const toIso = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : new Date(v)).toISOString();
    return snap.docs.map((d) => {
        const e = d.data();
        return {
            id: d.id,
            auth_time: e.auth_time ? toIso(e.auth_time) : null,
            provider: e.provider || null,
            ip: maskIp(e.ip),
            user_agent: e.user_agent || null
        };
    });
}

async function updateProfile(payload, context) {
    const { uid, db } = context;
    const allowed = {};
    if (payload.full_name !== undefined) allowed.full_name = payload.full_name;
    if (payload.github_username !== undefined) allowed.github_username = payload.github_username;
    if (payload.github_user !== undefined) allowed.github_user = payload.github_user;
    if (payload.matricula_unrn !== undefined) allowed.matricula_unrn = payload.matricula_unrn;
    if (payload.cohort !== undefined) allowed.cohort = payload.cohort;

    await db.collection('profiles').doc(uid).update(allowed);
    return { success: true };
}

async function addSecondaryEmail(payload, context) {
    const { uid, db } = context;
    const email = normalizeEmail(payload.email);
    if (!email) throw dojoError('INVALID_ARGUMENT', "Email secundario inválido");

    const pRef = db.collection('profiles').doc(uid);
    const pSnap = await pRef.get();
    if (!pSnap.exists) throw dojoError('PROFILE_NOT_FOUND', "Perfil no encontrado");

    const currentSec = pSnap.data().secondary_emails || [];
    if (!currentSec.includes(email)) {
        currentSec.push(email);
        await pRef.update({ secondary_emails: currentSec });
    }
    return { success: true, secondary_emails: currentSec };
}

async function mergeProfiles(payload, context) {
    const { db, getMyProfile } = context;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw dojoError('ADMIN_ONLY', "Solo los administradores pueden fusionar perfiles");

    const { targetUid, sourceUid } = payload; // merge sourceUid into targetUid
    if (!targetUid || !sourceUid || targetUid === sourceUid) throw dojoError('INVALID_ARGUMENT', "Parámetros de fusión inválidos");

    const targetRef = db.collection('profiles').doc(targetUid);
    const sourceRef = db.collection('profiles').doc(sourceUid);

    const tSnap = await targetRef.get();
    const sSnap = await sourceRef.get();

    if (!tSnap.exists || !sSnap.exists) throw dojoError('PROFILE_NOT_FOUND', "Uno o ambos perfiles no existen");

    const sData = sSnap.data();
    const tData = tSnap.data();

    // Add source email to target's secondary emails
    const secEmails = new Set(tData.secondary_emails || []);
    if (sData.email) secEmails.add(sData.email.toLowerCase());
    if (Array.isArray(sData.secondary_emails)) {
        sData.secondary_emails.forEach(e => secEmails.add(e.toLowerCase()));
    }

    await targetRef.update({
        secondary_emails: Array.from(secEmails),
        matricula_unrn: tData.matricula_unrn || sData.matricula_unrn || '',
        github_user: tData.github_user || sData.github_user || '',
        github_username: tData.github_username || sData.github_username || ''
    });

    // Transfer course_roster
    const rSnap = await db.collection('course_roster').where('student_id', '==', sourceUid).get();
    for (let doc of rSnap.docs) {
        const d = doc.data();
        await db.collection('course_roster').doc(`${d.course_id}_${targetUid}`).set({
            ...d,
            student_id: targetUid
        }, { merge: true });
        await doc.ref.delete();
    }

    // Delete source profile doc
    await sourceRef.delete();

    return { success: true, message: `Perfil ${sourceUid} fusionado exitosamente con ${targetUid}` };
}

async function submitMatricula(payload, context) {
    const { uid, db } = context;
    const { matricula } = payload;
    if (!matricula || !/^UNRN-\d{5,}$/.test(matricula)) {
        throw dojoError('INVALID_ARGUMENT', "Formato de matrícula inválido. Debe ser UNRN- seguido de al menos 5 dígitos.");
    }
    await db.collection('profiles').doc(uid).update({
        matricula_unrn: matricula,
        account_status: 'approved'
    });
    return { success: true };
}

async function getXpLogs(payload, context) {
    const { uid, db } = context;
    const snap = await db.collection('profiles').doc(uid).collection('xp_logs').orderBy('timestamp', 'desc').get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            action: data.action,
            description: data.description,
            points: data.points,
            timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) : new Date().toISOString()
        };
    });
}

module.exports = {
    getProfile,
    getSecurityLog,
    signOutEverywhere,
    maskIp,
    updateProfile,
    addSecondaryEmail,
    mergeProfiles,
    submitMatricula,
    getXpLogs
};
