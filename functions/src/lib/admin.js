/**
 * firebase-admin con `admin.firestore.FieldValue` / `Timestamp` garantizados.
 *
 * El emulador de Functions (firebase-tools ≤ 15.34) envuelve el módulo en un
 * Proxy que hace `bind` de `admin.firestore`; como esa función no tiene
 * prototype, la copia enlazada pierde los estáticos y
 * `admin.firestore.FieldValue.serverTimestamp()` falla solo en el emulador.
 * En producción se devuelve el módulo tal cual.
 */
const sdk = require('firebase-admin');

function withFirestoreStatics(admin) {
    if (!admin.firestore || admin.firestore.FieldValue) return admin;
    const statics = require('firebase-admin/firestore');
    const firestore = Object.assign((...args) => admin.firestore(...args), {
        FieldValue: statics.FieldValue,
        Timestamp: statics.Timestamp,
        FieldPath: statics.FieldPath,
        GeoPoint: statics.GeoPoint,
    });
    return new Proxy(admin, { get: (target, key) => (key === 'firestore' ? firestore : target[key]) });
}

module.exports = withFirestoreStatics(sdk);
module.exports.withFirestoreStatics = withFirestoreStatics;
