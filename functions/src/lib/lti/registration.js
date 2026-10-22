/**
 * IMS LTI Dynamic Registration 1.0 (plan F3.1): la plataforma abre
 * `/api/v1/lti/register?openid_configuration=…&registration_token=…` y la
 * herramienta se registra sola, sin copiar URLs ni claves a mano.
 */
const { LtiError } = require('./jwt');
const { SCOPES } = require('./claims');

/**
 * Configuración que la herramienta publica para la plataforma.
 * `baseUrl` es la URL pública del Dojo; `courseId` queda como parámetro
 * custom para vincular cada launch con su cátedra.
 */
function toolConfiguration({ baseUrl, courseId, clientName = 'Ninja Dojo' }) {
    const url = (path) => `${baseUrl}${path}`;
    const domain = new URL(baseUrl).host;
    return {
        application_type: 'web',
        response_types: ['id_token'],
        grant_types: ['implicit', 'client_credentials'],
        initiate_login_uri: url('/api/v1/lti/login_initiations'),
        redirect_uris: [url('/api/v1/lti/launch')],
        client_name: clientName,
        jwks_uri: url('/api/v1/lti/jwks'),
        token_endpoint_auth_method: 'private_key_jwt',
        scope: [SCOPES.NRPS, SCOPES.AGS_LINEITEM, SCOPES.AGS_RESULT, SCOPES.AGS_SCORE].join(' '),
        'https://purl.imsglobal.org/spec/lti-tool-configuration': {
            domain,
            target_link_uri: url('/api/v1/lti/launch'),
            custom_parameters: { courseId },
            claims: ['iss', 'sub', 'name', 'given_name', 'family_name', 'email'],
            messages: [
                { type: 'LtiResourceLinkRequest', target_link_uri: url('/api/v1/lti/launch') },
                { type: 'LtiDeepLinkingRequest', target_link_uri: url('/api/v1/lti/launch'), label: 'Agregar actividad del Dojo' },
            ],
        },
    };
}

/**
 * Lee la configuración OpenID de la plataforma, se registra y devuelve el
 * documento de plataforma a guardar (sin estado de aprobación).
 */
/**
 * @param {{ openidConfigurationUrl: string, registrationToken?: string, baseUrl: string, courseId: string,
 *           fetchImpl?: typeof fetch, isSafeUrl?: (url: string) => boolean }} opts
 */
async function registerWithPlatform({ openidConfigurationUrl, registrationToken, baseUrl, courseId, fetchImpl = globalThis.fetch, isSafeUrl = () => true }) {
    if (!isSafeUrl(openidConfigurationUrl)) throw new LtiError('unsafe_url', 'La URL de configuración de la plataforma no es segura.');
    const configRes = await fetchImpl(openidConfigurationUrl, { headers: { Accept: 'application/json' } });
    if (!configRes.ok) throw new LtiError('platform_error', `No se pudo leer la configuración de la plataforma (HTTP ${configRes.status}).`);
    const config = await configRes.json();

    // El emisor debe ser prefijo de la URL de configuración (Dynamic Registration §3.5.1).
    if (!config.issuer || !openidConfigurationUrl.startsWith(config.issuer)) {
        throw new LtiError('invalid_platform', 'El emisor declarado no corresponde a la URL de configuración.');
    }
    for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'registration_endpoint']) {
        if (!config[key] || !isSafeUrl(config[key])) throw new LtiError('invalid_platform', `La configuración de la plataforma no tiene un ${key} válido.`);
    }

    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (registrationToken) headers.Authorization = `Bearer ${registrationToken}`;
    const regRes = await fetchImpl(config.registration_endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(toolConfiguration({ baseUrl, courseId })),
    });
    if (!regRes.ok) {
        const detail = await regRes.text().catch(() => '');
        throw new LtiError('platform_error', `La plataforma rechazó el registro (HTTP ${regRes.status}). ${detail.slice(0, 200)}`.trim());
    }
    const registration = await regRes.json();
    const toolConfig = registration['https://purl.imsglobal.org/spec/lti-tool-configuration'] || {};
    if (!registration.client_id) throw new LtiError('platform_error', 'La plataforma no devolvió un client_id.');

    return {
        issuer: config.issuer,
        client_id: String(registration.client_id),
        deployment_ids: toolConfig.deployment_id ? [String(toolConfig.deployment_id)] : [],
        auth_login_url: config.authorization_endpoint,
        auth_token_url: config.token_endpoint,
        auth_token_audience: config.authorization_server || null,
        jwks_url: config.jwks_uri,
        product: (config['https://purl.imsglobal.org/spec/lti-platform-configuration'] || {}).product_family_code || '',
    };
}

/** Cierra la ventana de registro en la plataforma (§3.6.3). */
const CLOSE_REGISTRATION_SCRIPT = "(window.opener || window.parent).postMessage({ subject: 'org.imsglobal.lti.close' }, '*');";

module.exports = { toolConfiguration, registerWithPlatform, CLOSE_REGISTRATION_SCRIPT };
