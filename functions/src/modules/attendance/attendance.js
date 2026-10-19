const logger = require("firebase-functions/logger");
const { randomBytes, randomUUID } = require('node:crypto');
const { QR_PERIOD_SECONDS, isValidQrCode } = require('../../lib/qrToken');

const MAX_DISTANCE_METERS = 150;
// La sesión de QR vive como mucho una jornada de clase; el documento se
// borra solo por TTL de Firestore sobre `expires_at` (mejora 3.17).
const QR_SESSION_TTL_MS = 4 * 60 * 60 * 1000;

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCoordinate(value, max) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

function parseClassNumber(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 1000) throw new Error("Número de clase inválido.");
    return n;
}

function toMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
}

/**
 * Inicia (o renueva) la toma de asistencia por QR de una clase. Solo el
 * equipo docente del curso. Devuelve el secreto de la sesión para que el
 * navegador del docente derive los códigos rotativos; ningún cliente puede
 * leer ni escribir `active_qr` directamente.
 */
async function startQrAttendance(payload, context) {
    const { uid, db } = context;
    const { courseId } = payload;
    const classNumber = parseClassNumber(payload.classNumber);
    const lat = parseCoordinate(payload.lat, 90);
    const lng = parseCoordinate(payload.lng, 180);
    const hasLocation = lat !== null && lng !== null;
    const now = Date.now();

    const session = {
        session_id: randomUUID(),
        secret: randomBytes(32).toString('hex'),
        classNumber,
        period: QR_PERIOD_SECONDS,
        lat: hasLocation ? lat : null,
        lng: hasLocation ? lng : null,
        started_by: uid,
        started_at: new Date(now),
        expires_at: new Date(now + QR_SESSION_TTL_MS)
    };
    await db.collection('courses').doc(courseId).collection('active_qr').doc('current').set(session);

    return {
        sessionId: session.session_id,
        secret: session.secret,
        period: QR_PERIOD_SECONDS,
        classNumber,
        hasLocation,
        serverTime: now,
        expiresAt: now + QR_SESSION_TTL_MS
    };
}

/** Cierra la toma de asistencia: el código deja de validar al instante. */
async function stopQrAttendance(payload, context) {
    const { db } = context;
    await db.collection('courses').doc(payload.courseId).collection('active_qr').doc('current').delete();
    return { success: true };
}

async function submitQrAttendance(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, token } = payload;
    if (!courseId || payload.classNumber === undefined || !token) {
        throw new Error("Faltan datos para procesar la asistencia");
    }
    const classNumber = parseClassNumber(payload.classNumber);

    const profileSnap = await db.collection('profiles').doc(uid).get();
    if (!profileSnap.exists || profileSnap.data().role !== "student") {
        throw new Error("Solo los estudiantes pueden firmar asistencia. Los profesores y administradores no registran asistencia.");
    }

    const qrDoc = await db.collection('courses').doc(courseId).collection('active_qr').doc('current').get();
    const qrData = qrDoc.exists ? qrDoc.data() : null;
    const now = Date.now();
    const expiresAt = qrData ? toMillis(qrData.expires_at) : null;
    if (!qrData || !qrData.secret || (expiresAt !== null && expiresAt <= now)) {
        throw new Error("No hay un código de asistencia activo en este momento.");
    }

    if (Number(qrData.classNumber) !== classNumber) {
        throw new Error("Este código corresponde a una clase diferente.");
    }

    if (!isValidQrCode(qrData.secret, token, now, qrData.period || QR_PERIOD_SECONDS)) {
        throw new Error("El código de asistencia ha expirado o no es válido. Por favor, escanea el código QR actual de la pantalla.");
    }

    // Si el docente fijó la ubicación del aula, la del estudiante es
    // obligatoria: sin ella el control de distancia se podía saltear.
    if (qrData.lat !== null && qrData.lat !== undefined && qrData.lng !== null && qrData.lng !== undefined) {
        const lat = parseCoordinate(payload.lat, 90);
        const lng = parseCoordinate(payload.lng, 180);
        if (lat === null || lng === null) {
            throw new Error("Esta clase requiere tu ubicación para firmar asistencia. Habilitá el GPS y el permiso de ubicación del navegador.");
        }
        const distance = haversineMeters(qrData.lat, qrData.lng, lat, lng);
        if (distance > MAX_DISTANCE_METERS) {
            throw new Error(`Estás demasiado lejos del aula para registrar asistencia. Distancia: ${Math.round(distance)}m (máximo ${MAX_DISTANCE_METERS}m).`);
        }
    }

    const attendanceDocRef = db.collection('courses').doc(courseId).collection('attendance').doc(`class_${classNumber}`);
    const attendanceDoc = await attendanceDocRef.get();
    const alreadyPresent = attendanceDoc.exists && attendanceDoc.data().records && attendanceDoc.data().records[uid] === 'present';
    if (alreadyPresent) {
        return { success: true, alreadyRegistered: true };
    }

    await attendanceDocRef.set({
        classNumber,
        records: { [uid]: 'present' },
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: 'system_qr'
    }, { merge: true });

    // +10 XP por presente, una sola vez por clase.
    try {
        await db.collection('profiles').doc(uid).collection('xp_logs').add({
            action: 'asistencia',
            description: `Asistencia firmada en Clase ${classNumber}`,
            points: 10,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) {
        logger.error("Error logging XP:", e);
    }

    return { success: true };
}

module.exports = {
    startQrAttendance,
    stopQrAttendance,
    submitQrAttendance,
    haversineMeters
};
