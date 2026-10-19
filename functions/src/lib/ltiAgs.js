/**
 * LTI Advantage Assignment and Grade Services (mejora 3.12): publica las
 * notas en el libro de calificaciones de Moodle.
 *
 * 1. Token OAuth2 client_credentials con una aserción JWT (RS256) firmada
 *    con la clave privada de Ninja Dojo (LTI_TOOL_PRIVATE_KEY).
 * 2. POST {lineitem}/scores con application/vnd.ims.lis.v1.score+json.
 *
 * Reemplaza el envío POX de LTI 1.1, que viajaba sin firma OAuth y Moodle
 * rechazaba. Configuración: LTI_CLIENT_ID, LTI_PLATFORM_TOKEN_URL,
 * LTI_TOOL_PRIVATE_KEY y LTI_TOOL_KID (opcional).
 */
const { createPrivateKey, createSign, randomUUID } = require('node:crypto');
const { isSafeExternalUrl } = require('./urls');

const SCORE_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/score';
const MAX_GRADE = 10;

function agsConfig(env = process.env) {
    if (!env.LTI_CLIENT_ID || !env.LTI_PLATFORM_TOKEN_URL || !env.LTI_TOOL_PRIVATE_KEY) return null;
    const pem = env.LTI_TOOL_PRIVATE_KEY.includes('\\n') ? env.LTI_TOOL_PRIVATE_KEY.replace(/\\n/g, '\n') : env.LTI_TOOL_PRIVATE_KEY;
    return {
        clientId: env.LTI_CLIENT_ID,
        tokenUrl: env.LTI_PLATFORM_TOKEN_URL,
        privateKey: createPrivateKey(pem),
        kid: env.LTI_TOOL_KID || 'dojo-lti-1'
    };
}

function signJwt(payload, privateKey, kid) {
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const input = `${enc({ alg: 'RS256', typ: 'JWT', kid })}.${enc(payload)}`;
    const signer = createSign('RSA-SHA256');
    signer.update(input);
    return `${input}.${signer.sign(privateKey).toString('base64url')}`;
}

let cachedToken = null;

async function accessToken(config, fetchImpl, now = Date.now()) {
    if (cachedToken && cachedToken.expiresAt - 30000 > now && cachedToken.clientId === config.clientId) return cachedToken.value;
    const iat = Math.floor(now / 1000);
    const assertion = signJwt({ iss: config.clientId, sub: config.clientId, aud: config.tokenUrl, iat, exp: iat + 300, jti: randomUUID() }, config.privateKey, config.kid);
    const res = await fetchImpl(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: assertion,
            scope: SCORE_SCOPE
        }).toString()
    });
    if (!res.ok) throw new Error(`Moodle rechazó el token de AGS (HTTP ${res.status})`);
    const body = await res.json();
    cachedToken = { value: body.access_token, expiresAt: now + (Number(body.expires_in) || 3600) * 1000, clientId: config.clientId };
    return cachedToken.value;
}

/** URL de scores de un line item (respeta la query string del line item). */
function scoresUrl(lineitem) {
    const url = new URL(lineitem);
    url.pathname = url.pathname.replace(/\/$/, '') + '/scores';
    return url.toString();
}

/**
 * Publica la nota (0..10) de `userId` en `lineitem`. Devuelve el status HTTP.
 * Lanza si falta configuración o la URL no es segura.
 */
async function postScore({ lineitem, userId, score, comment }, { env, fetchImpl = fetch, now = Date.now() } = {}) {
    const config = agsConfig(env);
    if (!config) throw new Error('AGS no configurado');
    if (!isSafeExternalUrl(lineitem) || !isSafeExternalUrl(config.tokenUrl)) throw new Error('URL de Moodle no permitida');
    const token = await accessToken(config, fetchImpl, now);
    const res = await fetchImpl(scoresUrl(lineitem), {
        method: 'POST',
        headers: { 'Content-Type': 'application/vnd.ims.lis.v1.score+json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
            userId,
            scoreGiven: score,
            scoreMaximum: MAX_GRADE,
            comment: comment ? String(comment).slice(0, 1000) : undefined,
            timestamp: new Date(now).toISOString(),
            activityProgress: 'Completed',
            gradingProgress: 'FullyGraded'
        })
    });
    return res.status;
}

function resetTokenCache() {
    cachedToken = null;
}

module.exports = { agsConfig, postScore, scoresUrl, resetTokenCache, SCORE_SCOPE };
