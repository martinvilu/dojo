/**
 * Flujo OIDC de LTI 1.3 (plan F3.2–F3.4): iniciación de login, launch
 * verificado y alta de identidades/inscripciones en Firestore.
 *
 * Colecciones (solo backend):
 *   lti_platforms/{id}      plataforma registrada: issuer, client_id,
 *                           deployment_ids, URLs, course_ids, status
 *   lti_states/{state}      state + nonce de un login en curso (un uso)
 *   lti_users/{hash}        (iss, sub) -> uid del Dojo
 *   lti_contexts/{hash}     contexto de Moodle -> curso + endpoints NRPS/AGS
 *   lti_handoffs/{code}     sesión de un launch a canjear por custom token
 *
 * Seguridad de cuentas: la plataforma la registra el docente, así que
 * mientras un administrador no la aprueba (`status: 'approved'`) los
 * launches no pueden entrar a una cuenta existente (por email o matrícula)
 * ni como docentes: los estudiantes reciben una cuenta propia keyed por
 * (iss, sub) y su inscripción queda pendiente.
 */
const { createHash, randomBytes } = require('node:crypto');
const { decodeJwt, verifyJwt, LtiError } = require('./jwt');
const { validateLaunchClaims, MESSAGE_TYPES, ROLE } = require('./claims');

const STATE_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 2 * 60 * 1000;
const DEEP_LINK_TTL_MS = 30 * 60 * 1000;

const hash = (...parts) => createHash('sha256').update(parts.join('\u0000')).digest('hex');
const token = () => randomBytes(24).toString('base64url');

function platformDocId(issuer, clientId) {
    return hash(issuer, clientId).slice(0, 32);
}

function contextDocId(platformId, deploymentId, contextId) {
    return hash(platformId, deploymentId, contextId).slice(0, 32);
}

function ltiUserDocId(issuer, sub) {
    return hash(issuer, sub).slice(0, 40);
}

function toMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return Number(value) || 0;
}

async function loadPlatform(db, issuer, clientId) {
    if (clientId) {
        const snap = await db.collection('lti_platforms').doc(platformDocId(issuer, clientId)).get();
        return snap.exists ? { id: snap.id, ...snap.data() } : null;
    }
    // Sin client_id solo se acepta si el emisor tiene un único registro.
    const snap = await db.collection('lti_platforms').where('issuer', '==', issuer).get();
    return snap.docs.length === 1 ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
}

function assertUsable(platform) {
    if (!platform) throw new LtiError('unknown_platform', 'La plataforma no está registrada en el Dojo.');
    if (platform.status === 'disabled') throw new LtiError('platform_disabled', 'La integración con esta plataforma está deshabilitada.');
}

/**
 * Third-party initiated login (Core §5.1.1). Devuelve la URL de
 * autorización de la plataforma y el `state` para la cookie.
 */
async function startLogin(db, params, { baseUrl, now = Date.now() }) {
    const { iss, login_hint: loginHint, target_link_uri: targetLinkUri, lti_message_hint: messageHint, client_id: clientId, lti_deployment_id: deploymentId } = params;
    if (!iss || !loginHint || !targetLinkUri) throw new LtiError('invalid_request', 'Faltan iss, login_hint o target_link_uri.');
    if (!String(targetLinkUri).startsWith(baseUrl)) throw new LtiError('invalid_request', 'El target_link_uri no apunta a esta herramienta.');

    const platform = await loadPlatform(db, iss, clientId);
    assertUsable(platform);
    if (deploymentId && !(platform.deployment_ids || []).includes(String(deploymentId))) {
        throw new LtiError('invalid_deployment', 'El deployment_id no está registrado para esta plataforma.');
    }

    const state = token();
    const nonce = token();
    await db.collection('lti_states').doc(state).set({
        platform_id: platform.id,
        nonce,
        created_at: new Date(now),
        expires_at: new Date(now + STATE_TTL_MS),
    });

    const url = new URL(platform.auth_login_url);
    const query = {
        scope: 'openid',
        response_type: 'id_token',
        response_mode: 'form_post',
        prompt: 'none',
        client_id: platform.client_id,
        redirect_uri: `${baseUrl}/api/v1/lti/launch`,
        login_hint: loginHint,
        state,
        nonce,
    };
    if (messageHint) query.lti_message_hint = messageHint;
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return { redirectUrl: url.toString(), state };
}

/** Consume el state una sola vez; devuelve sus datos o falla. */
async function consumeState(db, state, now) {
    if (!state) throw new LtiError('invalid_state', 'Falta el state del login.');
    const ref = db.collection('lti_states').doc(String(state));
    const data = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        tx.delete(ref);
        return snap.data();
    });
    if (!data || toMillis(data.expires_at) < now) throw new LtiError('invalid_state', 'El login venció o ya fue usado. Volvé a abrir la actividad desde Moodle.');
    return data;
}

async function resolveCourse(db, platform, launch, admin) {
    const contextId = launch.context && launch.context.id ? String(launch.context.id) : null;
    const customCourseId = launch.custom.courseId || launch.custom.course_id || launch.custom.courseid || null;
    const ref = contextId ? db.collection('lti_contexts').doc(contextDocId(platform.id, launch.deploymentId, contextId)) : null;

    let courseId = null;
    if (ref) {
        const snap = await ref.get();
        if (snap.exists) courseId = snap.data().course_id;
    }
    if (!courseId && customCourseId && (platform.course_ids || []).includes(String(customCourseId))) {
        courseId = String(customCourseId);
    }
    if (!courseId) {
        throw new LtiError('unlinked_context', 'Este curso de Moodle no está vinculado a una cátedra del Dojo. El docente tiene que registrar la herramienta desde Ajustes Cátedra → Integraciones.');
    }
    const course = await db.collection('courses').doc(courseId).get();
    if (!course.exists) throw new LtiError('unlinked_context', 'La cátedra vinculada ya no existe.');

    if (ref) {
        await ref.set({
            platform_id: platform.id,
            deployment_id: launch.deploymentId,
            context_id: contextId,
            context_title: (launch.context && (launch.context.title || launch.context.label)) || '',
            course_id: courseId,
            nrps_url: launch.nrps && launch.nrps.context_memberships_url ? launch.nrps.context_memberships_url : null,
            ags_lineitems_url: launch.ags && launch.ags.lineitems ? launch.ags.lineitems : null,
            ags_scopes: launch.ags && Array.isArray(launch.ags.scope) ? launch.ags.scope : [],
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    return { courseId, course: course.data(), contextDocId: ref ? ref.id : null };
}

async function findExistingProfile(db, launch) {
    const candidates = [];
    if (launch.email) candidates.push(['email', launch.email]);
    if (launch.matricula) candidates.push(['matricula_unrn', launch.matricula]);
    for (const [field, value] of candidates) {
        const snap = await db.collection('profiles').where(field, '==', value).get();
        // Ambiguo o administrador: nunca se vincula automáticamente.
        if (snap.docs.length === 1 && snap.docs[0].data().role !== 'admin') return snap.docs[0].id;
    }
    return null;
}

/** uid del Dojo para (iss, sub), creando el vínculo si hace falta. */
async function resolveIdentity(db, platform, launch, admin) {
    const ref = db.collection('lti_users').doc(ltiUserDocId(launch.issuer, launch.sub));
    const snap = await ref.get();
    if (snap.exists) return { uid: snap.data().uid, linked: 'existing' };

    const approved = platform.status === 'approved';
    const existing = approved ? await findExistingProfile(db, launch) : null;
    const uid = existing || `lti_${ltiUserDocId(launch.issuer, launch.sub).slice(0, 24)}`;
    await ref.set({
        uid,
        issuer: launch.issuer,
        sub: launch.sub,
        platform_id: platform.id,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { uid, linked: existing ? 'matched' : 'created' };
}

/**
 * Alta o actualización de perfil e inscripción. `touchActivity` marca la
 * última actividad en Moodle (sí en un launch, no en una sincronización NRPS).
 */
async function provisionMembership(db, { platform, launch, uid, courseId, admin, touchActivity = true }) {
    const approved = platform.status === 'approved';
    const isStaffRole = launch.role === ROLE.INSTRUCTOR || launch.role === ROLE.TA;
    const ts = admin.firestore.FieldValue.serverTimestamp();

    const profileRef = db.collection('profiles').doc(uid);
    const profileSnap = await profileRef.get();
    const profile = profileSnap.exists ? profileSnap.data() : null;

    const update = { [`lti_subs.${platform.id}`]: launch.sub };
    if (touchActivity) update.ultima_actividad_moodle = ts;
    if (/^\d+$/.test(launch.sub)) update.moodle_user_id = launch.sub;
    if (!profile) {
        Object.assign(update, {
            full_name: launch.name || launch.email || 'Usuario de Moodle',
            email: launch.email || '',
            role: isStaffRole ? 'teacher' : 'student',
            account_status: approved ? 'approved' : 'pending',
            created_at: ts,
            created_via: 'lti',
        });
    } else {
        if (!profile.full_name && launch.name) update.full_name = launch.name;
        if (!profile.email && launch.email) update.email = launch.email;
        if (approved && profile.account_status === 'pending') update.account_status = 'approved';
        // Instructor en una plataforma aprobada: pasa a docente (nunca baja ni toca admins).
        if (isStaffRole && profile.role === 'student') update.role = 'teacher';
    }
    if (launch.matricula && !(profile && profile.matricula_unrn)) update.matricula_unrn = launch.matricula;
    if (profile) await profileRef.update(update);
    else await profileRef.set(expandDotted(update));

    const role = profile && profile.role === 'admin' ? 'admin' : (isStaffRole || (profile && profile.role === 'teacher') ? 'teacher' : 'student');

    if (isStaffRole) {
        const teacherRef = db.collection('course_teachers').doc(`${courseId}_${uid}`);
        if (!(await teacherRef.get()).exists) {
            await teacherRef.set({
                course_id: courseId,
                teacher_id: uid,
                role: launch.role === ROLE.TA ? 'ayudante' : 'titular',
                assigned_via: 'lti',
                assigned_at: ts,
            });
        }
    } else if (role === 'student') {
        const rosterRef = db.collection('course_roster').doc(`${courseId}_${uid}`);
        if (!(await rosterRef.get()).exists) {
            const status = approved ? 'approved' : 'pending';
            await rosterRef.set({ course_id: courseId, student_id: uid, status, enrolled_at: ts, enrolled_via: 'lti' });
            await db.collection('enrollments').doc(`${uid}_${courseId}`).set({ course_id: courseId, student_id: uid, status, enrolled_at: ts });
        }
    }
    return { role, newProfile: !profile, needsGithub: !(profile && (profile.github_user || profile.github_username)) };
}

/** Convierte claves `a.b` en objetos anidados (para `set` de documentos nuevos). */
function expandDotted(flat) {
    const out = {};
    for (const [key, value] of Object.entries(flat)) {
        const parts = key.split('.');
        let node = out;
        parts.slice(0, -1).forEach((p) => { node = node[p] = node[p] || {}; });
        node[parts[parts.length - 1]] = value;
    }
    return out;
}

/** Pestaña de destino según `custom.targetModule` (compatible con el launch anterior). */
function landingFor({ role, custom, courseId }) {
    const target = String(custom.targetModule || custom.target_module || custom.target || custom.tab || '').toLowerCase();
    const aliases = {
        schedules: 'schedules', calendar: 'schedules', assignments: 'assignments', activities: 'assignments',
        overview: 'overview', status: 'overview', alerts: 'students', students: 'students', roster: 'students',
        announcements: 'announcements', avisos: 'announcements', tutorias: 'tutorias', tutoring: 'tutorias',
        study_groups: 'study_groups', grupos: 'study_groups', cursada: 'academic', academic: 'academic',
    };
    // 'verified': la inscripción ya se hizo en el servidor (no repetir moodleAutoEnroll).
    const params = new URLSearchParams({ courseId, lti_launch: 'verified' });
    const subTab = aliases[target] || (role === 'student' ? '' : 'overview');
    if (subTab) params.set('subTab', subTab);
    if (custom.assignmentId || custom.activityId) params.set('assignmentId', String(custom.assignmentId || custom.activityId));
    return `/dashboard?${params.toString()}`;
}

/**
 * Valida el launch y provisiona usuario e inscripción. Devuelve el código de
 * handoff que la página `/lti/continuar` canjea por un custom token.
 *
 * @param deps.resolvePlatformKey (jwksUrl, kid) => JWK
 */
async function completeLaunch(db, { idToken, state, cookieState }, { admin, resolvePlatformKey, now = Date.now() }) {
    if (!idToken) throw new LtiError('invalid_request', 'Falta el id_token.');
    // Si el navegador conservó la cookie, tiene que coincidir (CSRF de login).
    if (cookieState && cookieState !== state) throw new LtiError('invalid_state', 'El state no coincide con la sesión del navegador.');
    const stateData = await consumeState(db, state, now);

    const { payload: unverified } = decodeJwt(idToken);
    const clientId = Array.isArray(unverified.aud) ? (unverified.azp || unverified.aud[0]) : unverified.aud;
    const platform = await loadPlatform(db, unverified.iss, clientId);
    assertUsable(platform);
    if (stateData.platform_id !== platform.id) throw new LtiError('invalid_state', 'El login se inició para otra plataforma.');

    const { payload } = await verifyJwt(idToken, (header) => resolvePlatformKey(platform.jwks_url, header.kid), { nowSeconds: Math.floor(now / 1000) });
    const launch = validateLaunchClaims(payload, { platform, expectedNonce: stateData.nonce });

    if (launch.role === ROLE.NONE) throw new LtiError('unsupported_role', 'Tu rol en Moodle no tiene acceso al Dojo.');
    if ((launch.role === ROLE.INSTRUCTOR || launch.role === ROLE.TA) && platform.status !== 'approved') {
        throw new LtiError('platform_pending', 'La integración todavía no fue aprobada por un administrador del Dojo; mientras tanto solo pueden ingresar estudiantes.');
    }
    if (launch.messageType === MESSAGE_TYPES.DEEP_LINKING && launch.role === ROLE.LEARNER) {
        throw new LtiError('unsupported_role', 'Solo los docentes pueden agregar actividades del Dojo.');
    }

    const { courseId } = await resolveCourse(db, platform, launch, admin);
    const { uid } = await resolveIdentity(db, platform, launch, admin);
    const membership = await provisionMembership(db, { platform, launch, uid, courseId, admin });

    let redirect = landingFor({ role: membership.role, custom: launch.custom, courseId });
    if (launch.messageType === MESSAGE_TYPES.DEEP_LINKING) {
        const session = token();
        await db.collection('lti_deep_link_sessions').doc(session).set({
            uid,
            platform_id: platform.id,
            deployment_id: launch.deploymentId,
            course_id: courseId,
            return_url: launch.deepLinking && launch.deepLinking.deep_link_return_url,
            data: (launch.deepLinking && launch.deepLinking.data) || null,
            accept_multiple: Boolean(launch.deepLinking && launch.deepLinking.accept_multiple),
            expires_at: new Date(now + DEEP_LINK_TTL_MS),
        });
        redirect = `/lti/deep-linking?session=${session}`;
    }

    const code = token();
    await db.collection('lti_handoffs').doc(code).set({ uid, redirect, expires_at: new Date(now + HANDOFF_TTL_MS) });
    await db.collection('audit_logs').add({
        action: 'lti_launch',
        course_id: courseId,
        actor_id: uid,
        platform_id: platform.id,
        lti_role: launch.role,
        message_type: launch.messageType,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { code, uid, courseId, role: membership.role, platformId: platform.id };
}

/** Canjea el código de handoff (un solo uso, 2 minutos). */
async function redeemHandoff(db, code, now = Date.now()) {
    if (!code) throw new LtiError('invalid_handoff', 'Falta el código de ingreso.');
    const ref = db.collection('lti_handoffs').doc(String(code));
    const data = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        tx.delete(ref);
        return snap.data();
    });
    if (!data || toMillis(data.expires_at) < now) throw new LtiError('invalid_handoff', 'El ingreso desde Moodle venció. Volvé a abrir la actividad.');
    return { uid: data.uid, redirect: data.redirect };
}

module.exports = {
    resolveIdentity,
    provisionMembership,
    startLogin,
    completeLaunch,
    redeemHandoff,
    loadPlatform,
    platformDocId,
    contextDocId,
    ltiUserDocId,
    landingFor,
    STATE_TTL_MS,
};
