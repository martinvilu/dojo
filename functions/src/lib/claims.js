/**
 * Rol del usuario como custom claim de Firebase Auth (mejora 3.34).
 *
 * Las reglas de Firestore leen `request.auth.token.role` en lugar de hacer
 * un get() del perfil en cada evaluación; el perfil sigue siendo la fuente
 * de verdad y las reglas lo usan como respaldo si el token no trae el
 * claim. El claim se actualiza al cambiar el rol y se autocorrige en cada
 * inicio de sesión (getProfile). Si el rol baja, se revocan las sesiones
 * para que ningún token conserve un rol mayor hasta su vencimiento.
 */
const ROLES = ['student', 'teacher', 'admin'];
const RANK = { student: 1, teacher: 2, admin: 3 };

/** @returns {Promise<boolean>} true si el claim cambió. */
async function syncRoleClaim(auth, uid, role, { previousRole } = {}) {
    if (!ROLES.includes(role)) return false;
    const user = await auth.getUser(uid);
    const claims = user.customClaims || {};
    if (claims.role === role) return false;
    await auth.setCustomUserClaims(uid, { ...claims, role });
    const before = previousRole || claims.role;
    if (before && RANK[before] > RANK[role]) {
        await auth.revokeRefreshTokens(uid);
    }
    return true;
}

module.exports = { ROLES, syncRoleClaim };
