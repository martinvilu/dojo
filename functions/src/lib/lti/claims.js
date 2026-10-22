/**
 * Claims de LTI 1.3 Core / Advantage y su validación (plan F3.3).
 */
const { LtiError } = require('./jwt');

const CLAIM = Object.freeze({
    MESSAGE_TYPE: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
    VERSION: 'https://purl.imsglobal.org/spec/lti/claim/version',
    DEPLOYMENT_ID: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
    TARGET_LINK_URI: 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri',
    RESOURCE_LINK: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
    ROLES: 'https://purl.imsglobal.org/spec/lti/claim/roles',
    CONTEXT: 'https://purl.imsglobal.org/spec/lti/claim/context',
    CUSTOM: 'https://purl.imsglobal.org/spec/lti/claim/custom',
    LIS: 'https://purl.imsglobal.org/spec/lti/claim/lis',
    NRPS: 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice',
    AGS: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
    DL_SETTINGS: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
    DL_CONTENT_ITEMS: 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
    DL_DATA: 'https://purl.imsglobal.org/spec/lti-dl/claim/data',
});

const MESSAGE_TYPES = Object.freeze({
    RESOURCE_LINK: 'LtiResourceLinkRequest',
    DEEP_LINKING: 'LtiDeepLinkingRequest',
    DEEP_LINKING_RESPONSE: 'LtiDeepLinkingResponse',
});

const SCOPES = Object.freeze({
    NRPS: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
    AGS_LINEITEM: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
    AGS_RESULT: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    AGS_SCORE: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
});

const ROLE = Object.freeze({ INSTRUCTOR: 'instructor', TA: 'ta', LEARNER: 'learner', NONE: 'none' });
const UNRN_MATRICULA_RE = /^UNRN-\d+$/;

/**
 * Rol del usuario dentro del curso según el claim `roles` (SPEC §2.2).
 * El administrador institucional de Moodle entra como docente del curso:
 * un launch nunca otorga el rol de administrador del Dojo.
 */
function mapLtiRole(roles) {
    const list = Array.isArray(roles) ? roles.map(String) : [];
    const has = (suffix) => list.some((r) => r === suffix || r.endsWith(`/${suffix}`) || r.endsWith(`#${suffix}`));
    if (list.some((r) => /membership\/Instructor#TeachingAssistant$/.test(r)) || has('TeachingAssistant')) return ROLE.TA;
    if (list.some((r) => /membership#Instructor$/.test(r)) || list.includes('Instructor')) return ROLE.INSTRUCTOR;
    if (list.some((r) => /institution\/person#Administrator$/.test(r) || /system\/person#Administrator$/.test(r))) return ROLE.INSTRUCTOR;
    if (list.some((r) => /membership#Learner$/.test(r)) || list.includes('Learner')) return ROLE.LEARNER;
    return ROLE.NONE;
}

function audienceIncludes(aud, clientId) {
    return Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
}

/**
 * Valida un id_token ya verificado contra la plataforma registrada y lo
 * normaliza. `expectedNonce` es el nonce guardado en la iniciación de login.
 */
function validateLaunchClaims(payload, { platform, expectedNonce }) {
    if (payload.iss !== platform.issuer) throw new LtiError('invalid_claims', 'El emisor del token no coincide con la plataforma.');
    if (!audienceIncludes(payload.aud, platform.client_id)) {
        throw new LtiError('invalid_claims', 'El token no está dirigido a esta herramienta (aud).');
    }
    if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== platform.client_id) {
        throw new LtiError('invalid_claims', 'Con varias audiencias, azp debe ser el client_id de la herramienta.');
    }
    if (!payload.nonce || payload.nonce !== expectedNonce) throw new LtiError('invalid_nonce', 'El nonce no coincide o ya fue usado.');
    if (payload[CLAIM.VERSION] !== '1.3.0') throw new LtiError('invalid_claims', 'Solo se acepta LTI 1.3.0.');

    const messageType = payload[CLAIM.MESSAGE_TYPE];
    if (messageType !== MESSAGE_TYPES.RESOURCE_LINK && messageType !== MESSAGE_TYPES.DEEP_LINKING) {
        throw new LtiError('invalid_claims', `Tipo de mensaje no soportado: ${messageType}.`);
    }
    const deploymentId = payload[CLAIM.DEPLOYMENT_ID];
    if (!deploymentId || !(platform.deployment_ids || []).includes(String(deploymentId))) {
        throw new LtiError('invalid_deployment', 'El deployment_id no está registrado para esta plataforma.');
    }
    if (!payload.sub) throw new LtiError('invalid_claims', 'El launch no identifica al usuario (sub).');
    if (messageType === MESSAGE_TYPES.RESOURCE_LINK && !(payload[CLAIM.RESOURCE_LINK] || {}).id) {
        throw new LtiError('invalid_claims', 'Falta el resource_link del launch.');
    }

    const lis = payload[CLAIM.LIS] || {};
    const sourcedid = String(lis.person_sourcedid || '').trim().toUpperCase();
    return {
        messageType,
        issuer: payload.iss,
        sub: String(payload.sub),
        deploymentId: String(deploymentId),
        role: mapLtiRole(payload[CLAIM.ROLES]),
        email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '',
        name: payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(' ') || '',
        matricula: UNRN_MATRICULA_RE.test(sourcedid) ? sourcedid : '',
        context: payload[CLAIM.CONTEXT] || null,
        resourceLink: payload[CLAIM.RESOURCE_LINK] || null,
        custom: payload[CLAIM.CUSTOM] || {},
        targetLinkUri: payload[CLAIM.TARGET_LINK_URI] || '',
        nrps: payload[CLAIM.NRPS] || null,
        ags: payload[CLAIM.AGS] || null,
        deepLinking: payload[CLAIM.DL_SETTINGS] || null,
    };
}

module.exports = { CLAIM, MESSAGE_TYPES, SCOPES, ROLE, mapLtiRole, validateLaunchClaims, UNRN_MATRICULA_RE };
