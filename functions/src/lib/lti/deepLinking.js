/**
 * LTI Deep Linking 2.0: respuesta `LtiDeepLinkingResponse` firmada por la
 * herramienta y el formulario que la devuelve a la plataforma (plan F3.9).
 */
const { randomUUID } = require('node:crypto');
const { signJwt } = require('./jwt');
const { CLAIM, MESSAGE_TYPES } = require('./claims');

/**
 * @param {object} p
 * @param {object} p.platform      { issuer, client_id }
 * @param {string} p.deploymentId
 * @param {string} [p.data]        claim `data` recibido en el request (se devuelve tal cual)
 * @param {Array}  p.items         [{ title, text, url, custom }]
 * @param {object} p.signingKey    clave de la herramienta
 */
function buildDeepLinkingResponse({ platform, deploymentId, data, items, signingKey }) {
    const payload = {
        iss: platform.client_id,
        aud: platform.issuer,
        nonce: randomUUID(),
        [CLAIM.MESSAGE_TYPE]: MESSAGE_TYPES.DEEP_LINKING_RESPONSE,
        [CLAIM.VERSION]: '1.3.0',
        [CLAIM.DEPLOYMENT_ID]: deploymentId,
        [CLAIM.DL_CONTENT_ITEMS]: items.map((item) => ({
            type: 'ltiResourceLink',
            title: item.title,
            text: item.text || undefined,
            url: item.url,
            custom: item.custom || undefined,
        })),
    };
    if (data) payload[CLAIM.DL_DATA] = data;
    return signJwt(payload, signingKey);
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

/** Página que hace POST automático del JWT al `deep_link_return_url`. */
function autoPostForm(actionUrl, fields, message = 'Volviendo a Moodle…') {
    const inputs = Object.entries(fields)
        .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
        .join('');
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(message)}</title></head>
<body style="background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<form id="f" method="POST" action="${escapeHtml(actionUrl)}">${inputs}<noscript><button type="submit">Continuar</button></noscript></form>
<p>${escapeHtml(message)}</p><script>document.getElementById('f').submit();</script></body></html>`;
}

module.exports = { buildDeepLinkingResponse, autoPostForm, escapeHtml };
