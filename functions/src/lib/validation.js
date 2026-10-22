/**
 * Validación de payloads de la callable `api` con Zod.
 *
 * Cada acción declara su esquema en `src/schemas.js`. El dispatcher valida
 * antes de autorizar, así ni la capa de authz ni los handlers reciben tipos
 * inesperados (objetos donde se esperaba un ID, strings de megabytes, etc.).
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { z } = require('zod');

/** Mensaje legible en castellano a partir de los issues de Zod. */
function describeIssues(issues) {
    return issues.slice(0, 5).map((issue) => {
        const path = issue.path.length ? issue.path.join('.') : 'payload';
        return `${path}: ${issue.message}`;
    }).join('; ');
}

/**
 * Devuelve el payload validado (con las transformaciones del esquema) o lanza
 * HttpsError('invalid-argument'). Las acciones sin esquema se rechazan, igual
 * que las acciones sin política en authz.
 */
function validatePayload(schemas, action, payload) {
    const schema = Object.prototype.hasOwnProperty.call(schemas, action) ? schemas[action] : null;
    if (!schema) {
        throw new HttpsError('invalid-argument', `La acción ${action} no tiene un esquema de validación definido.`);
    }
    const result = schema.safeParse(payload === undefined || payload === null ? {} : payload);
    if (!result.success) {
        throw new HttpsError('invalid-argument', `Datos inválidos para ${action}: ${describeIssues(result.error.issues)}`);
    }
    return result.data;
}

module.exports = { validatePayload, describeIssues, z };
