// --- Asistencia QR con código rotativo (mejora 3.18) ------------------------

const { HttpsError } = require('firebase-functions/v2/https');
const { generateSecret, currentCode, verifyCode } = require('../../lib/totp');
const { assertCourseOpen, assertCanEditStudents } = require('../../lib/courseGuards');

const QR_SESSION_TTL_MS = 5 * 60 * 1000;
const MAX_DISTANCE_METERS = 150;

function qrSessionRef(db, courseId) {
    return db.collection('courses').doc(String(courseId)).collection('active_qr').doc('current');
}

function toMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return Number(value) || 0;
}

function isValidCoordinate(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Lee la sesión vigente; null si no existe o venció. */
async function loadActiveSession(db, courseId, nowMs) {
    const snap = await qrSessionRef(db, courseId).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data.secret || toMillis(data.expires_at) <= nowMs) return null;
    return data;
}

/**
 * El docente abre (o renueva) la sesión QR de una clase. El secreto se genera
 * y queda en el backend; las coordenadas del aula fijan la geocerca.
 */
async function startQrSession(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, lat, lng } = payload;
    const classNumber = Number(payload.classNumber);
    if (!Number.isInteger(classNumber) || classNumber < 0) {
        throw new HttpsError('invalid-argument', 'Número de clase inválido.');
    }
    await assertCourseOpen(db, courseId);
    const hasLocation = isValidCoordinate(lat, lng);
    const nowMs = Date.now();
    const expiresAt = new Date(nowMs + QR_SESSION_TTL_MS);
    const secret = generateSecret();

    await qrSessionRef(db, courseId).set({
        secret,
        classNumber,
        lat: hasLocation ? lat : null,
        lng: hasLocation ? lng : null,
        started_by: uid,
        started_at: admin.firestore.FieldValue.serverTimestamp(),
        expires_at: expiresAt,
    });

    const session = currentCode(secret, nowMs);
    return {
        classNumber,
        code: session.code,
        expiresInSeconds: session.expiresInSeconds,
        sessionExpiresAt: expiresAt.toISOString(),
        geofence: hasLocation,
    };
}

/** Código vigente para el proyector; se consulta en cada rotación. */
async function getQrSessionCode(payload, context) {
    const { db } = context;
    const nowMs = Date.now();
    const session = await loadActiveSession(db, payload.courseId, nowMs);
    if (!session) return { active: false };
    const { code, expiresInSeconds } = currentCode(session.secret, nowMs);
    return {
        active: true,
        classNumber: session.classNumber,
        code,
        expiresInSeconds,
        sessionExpiresAt: new Date(toMillis(session.expires_at)).toISOString(),
        geofence: isValidCoordinate(session.lat, session.lng),
    };
}

async function stopQrSession(payload, context) {
    const { db } = context;
    await qrSessionRef(db, payload.courseId).delete();
    return { success: true };
}

async function isEnrolledStudent(db, courseId, uid) {
    const roster = await db.collection('course_roster').doc(`${courseId}_${uid}`).get();
    if (roster.exists) return !['pending', 'removed'].includes(roster.data().status);
    const enrollment = await db.collection('enrollments').doc(`${uid}_${courseId}`).get();
    return enrollment.exists && !['pending', 'removed'].includes(enrollment.data().status);
}

async function submitQrAttendance(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, token, lat, lng } = payload;
    const classNumber = Number(payload.classNumber);
    if (!courseId || !Number.isInteger(classNumber) || !token) {
        throw new HttpsError('invalid-argument', 'Faltan datos para procesar la asistencia.');
    }

    const profileSnap = await db.collection('profiles').doc(uid).get();
    if (!profileSnap.exists || profileSnap.data().role !== 'student') {
        throw new HttpsError('permission-denied', 'Solo los estudiantes pueden firmar asistencia.');
    }
    await assertCourseOpen(db, courseId);
    if (!(await isEnrolledStudent(db, courseId, uid))) {
        throw new HttpsError('permission-denied', 'No estás inscripto en este curso.');
    }

    const nowMs = Date.now();
    const session = await loadActiveSession(db, courseId, nowMs);
    if (!session) {
        throw new HttpsError('failed-precondition', 'No hay un código de asistencia activo en este momento.');
    }
    if (Number(session.classNumber) !== classNumber) {
        throw new HttpsError('invalid-argument', 'Este código corresponde a una clase diferente.');
    }
    if (!verifyCode(session.secret, token, nowMs)) {
        throw new HttpsError('invalid-argument', 'El código venció o no es válido. Escaneá el código que se ve ahora en pantalla.');
    }

    // Con geocerca configurada la ubicación del alumno es obligatoria: antes
    // bastaba con no enviarla para saltear el control de distancia.
    if (isValidCoordinate(session.lat, session.lng)) {
        if (!isValidCoordinate(lat, lng)) {
            throw new HttpsError('failed-precondition', 'Necesitamos tu ubicación para validar que estás en el aula. Habilitá el permiso de ubicación.');
        }
        const distance = haversineDistance(session.lat, session.lng, lat, lng);
        if (distance > MAX_DISTANCE_METERS) {
            throw new HttpsError('failed-precondition', `Estás demasiado lejos del aula para registrar asistencia. Distancia: ${Math.round(distance)} m (máximo ${MAX_DISTANCE_METERS} m).`);
        }
    }

    const attendanceDocRef = db.collection('courses').doc(courseId).collection('attendance').doc(`class_${classNumber}`);
    const attendanceDoc = await attendanceDocRef.get();
    const alreadyPresent = attendanceDoc.exists && (attendanceDoc.data().records || {})[uid] === 'present';

    if (!attendanceDoc.exists) {
        await attendanceDocRef.set({
            classNumber,
            records: { [uid]: 'present' },
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: 'system_qr'
        });
    } else if (!alreadyPresent) {
        await attendanceDocRef.update({
            [`records.${uid}`]: 'present',
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: 'system_qr'
        });
    }

    // Los +10 XP salen de `lib/xp.js` a partir de este registro: no se escribe XP aparte.
    return { success: true, alreadyPresent };
}

// --- Carga manual de asistencia por el docente -----------------------------

const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'justified'];

/**
 * Planilla de una clase: solo cambia los registros enviados (merge). Antes el
 * cliente escribía el documento directo en Firestore; pasa por el backend
 * para validar estados, comisión del ayudante (F0.4) y cierre de acta (F6).
 */
async function saveClassAttendance(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, records } = payload;
    const classNumber = Number(payload.classNumber);
    if (!Number.isInteger(classNumber) || classNumber < 0) {
        throw new HttpsError('invalid-argument', 'Número de clase inválido.');
    }
    const entries = Object.entries(records || {});
    const invalid = entries.find(([, status]) => !ATTENDANCE_STATUSES.includes(status));
    if (invalid) throw new HttpsError('invalid-argument', `Estado de asistencia inválido: ${invalid[1]}.`);
    await assertCanEditStudents(db, courseId, uid, entries.map(([studentId]) => studentId));

    const ref = db.collection('courses').doc(courseId).collection('attendance').doc(`class_${classNumber}`);
    const update = {
        classNumber,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: uid,
    };
    const snap = await ref.get();
    if (!snap.exists) {
        await ref.set({ ...update, records: Object.fromEntries(entries) });
    } else {
        for (const [studentId, status] of entries) update[`records.${studentId}`] = status;
        await ref.update(update);
    }
    return { success: true, updated: entries.length };
}

module.exports = {
    saveClassAttendance,
    ATTENDANCE_STATUSES,
    submitQrAttendance,
    startQrSession,
    getQrSessionCode,
    stopQrSession,
    haversineDistance,
};
