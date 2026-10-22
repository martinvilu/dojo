/**
 * Servicios LTI Advantage: token OAuth2 client_credentials con aserción JWT
 * (Security Framework §4.1), NRPS 2.0 (padrón) y AGS 2.0 (calificaciones).
 *
 * Todas las URLs vienen de la plataforma (claims del launch o registro); se
 * validan contra SSRF con `isSafeUrl` antes de cada request.
 */
const { randomUUID } = require('node:crypto');
const { signJwt, LtiError } = require('./jwt');
const { SCOPES } = require('./claims');

const tokenCache = new Map();

/**
 * @param {{ fetchImpl?: typeof fetch, isSafeUrl?: (url: string) => boolean, signingKey: object, now?: () => number }} opts
 */
function createLtiServices({ fetchImpl = globalThis.fetch, isSafeUrl = () => true, signingKey, now = () => Date.now() }) {
    async function request(url, init, label) {
        if (!isSafeUrl(url)) throw new LtiError('unsafe_url', `${label}: la URL de la plataforma no es segura.`);
        const res = await fetchImpl(url, init);
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new LtiError('platform_error', `${label}: la plataforma respondió HTTP ${res.status}. ${detail.slice(0, 200)}`.trim());
        }
        return res;
    }

    /** Token de acceso para `scopes`, cacheado hasta un minuto antes de vencer. */
    async function getAccessToken(platform, scopes) {
        const scope = [...scopes].sort().join(' ');
        const cacheKey = `${platform.issuer}|${platform.client_id}|${scope}`;
        const cached = tokenCache.get(cacheKey);
        if (cached && cached.expiresAt - 60_000 > now()) return cached.token;

        const assertion = signJwt({
            iss: platform.client_id,
            sub: platform.client_id,
            aud: platform.auth_token_audience || platform.auth_token_url,
            jti: randomUUID(),
        }, signingKey);
        const res = await request(platform.auth_token_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                client_assertion: assertion,
                scope,
            }).toString(),
        }, 'Token de servicio');
        const body = await res.json();
        if (!body.access_token) throw new LtiError('platform_error', 'La plataforma no devolvió un access_token.');
        tokenCache.set(cacheKey, { token: body.access_token, expiresAt: now() + (Number(body.expires_in) || 3600) * 1000 });
        return body.access_token;
    }

    const auth = (token, accept) => ({ Authorization: `Bearer ${token}`, Accept: accept });

    /** NRPS 2.0: todos los miembros del contexto, siguiendo `Link: rel="next"`. */
    async function fetchMemberships(platform, membershipsUrl) {
        const token = await getAccessToken(platform, [SCOPES.NRPS]);
        const members = [];
        let url = membershipsUrl;
        for (let page = 0; url && page < 50; page++) {
            const res = await request(url, { headers: auth(token, 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json') }, 'NRPS');
            const body = await res.json();
            members.push(...(body.members || []));
            const link = res.headers.get('link') || '';
            const next = link.split(',').map((p) => p.trim()).find((p) => /rel="?next"?/.test(p));
            url = next ? next.slice(next.indexOf('<') + 1, next.indexOf('>')) : null;
        }
        return members;
    }

    /** Busca el line item por `resourceId` o lo crea. */
    async function ensureLineItem(platform, lineItemsUrl, { resourceId, label, scoreMaximum = 10, tag }) {
        const token = await getAccessToken(platform, [SCOPES.AGS_LINEITEM]);
        const listUrl = new URL(lineItemsUrl);
        listUrl.searchParams.set('resource_id', resourceId);
        const listRes = await request(listUrl.toString(), { headers: auth(token, 'application/vnd.ims.lis.v2.lineitemcontainer+json') }, 'AGS line items');
        const existing = (await listRes.json()).find((item) => item.resourceId === resourceId);
        if (existing) return existing;

        const createRes = await request(lineItemsUrl, {
            method: 'POST',
            headers: { ...auth(token, 'application/vnd.ims.lis.v2.lineitem+json'), 'Content-Type': 'application/vnd.ims.lis.v2.lineitem+json' },
            body: JSON.stringify({ label, scoreMaximum, resourceId, tag }),
        }, 'AGS crear line item');
        return createRes.json();
    }

    /** Publica una nota (0–10 ya escalada a `scoreMaximum`) en el line item. */
    async function publishScore(platform, lineItemUrl, { userId, scoreGiven, scoreMaximum, comment }) {
        const token = await getAccessToken(platform, [SCOPES.AGS_SCORE]);
        const url = new URL(lineItemUrl);
        url.pathname = `${url.pathname.replace(/\/$/, '')}/scores`;
        await request(url.toString(), {
            method: 'POST',
            headers: { ...auth(token, 'application/json'), 'Content-Type': 'application/vnd.ims.lis.v1.score+json' },
            body: JSON.stringify({
                userId,
                scoreGiven,
                scoreMaximum,
                comment: comment ? String(comment).slice(0, 4000) : undefined,
                activityProgress: 'Completed',
                gradingProgress: 'FullyGraded',
                timestamp: new Date(now()).toISOString(),
            }),
        }, 'AGS publicar nota');
    }

    return { getAccessToken, fetchMemberships, ensureLineItem, publishScore };
}

function clearTokenCache() {
    tokenCache.clear();
}

module.exports = { createLtiServices, clearTokenCache };
