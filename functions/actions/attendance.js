async function markAttendance(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, classId } = payload;
    if (!courseId || !classId) throw new Error("Faltan datos de la clase");
    
    // Check enrollment
    const enrollmentRef = db.collection('enrollments').doc(`${uid}_${courseId}`);
    const doc = await enrollmentRef.get();
    if (!doc.exists) throw new Error("No estás inscripto en este curso");
    
    // Mark attendance
    const attendanceRef = db.collection('attendance').doc(`${courseId}_${classId}_${uid}`);
    await attendanceRef.set({
        course_id: courseId,
        class_id: classId,
        student_id: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
}

async function submitQrAttendance(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, classNumber, token, lat, lng } = payload;
    if (!courseId || classNumber === undefined || !token) {
        throw new Error("Faltan datos para procesar la asistencia");
    }

    const profileSnap = await db.collection('profiles').doc(uid).get();
    if (profileSnap.exists && profileSnap.data().role !== "student") {
        throw new Error("Solo los estudiantes pueden firmar asistencia. Los profesores y administradores no registran asistencia.");
    }
    
    const qrRef = db.collection('courses').doc(courseId).collection('active_qr').doc('current');
    const qrDoc = await qrRef.get();
    if (!qrDoc.exists) {
        throw new Error("No hay un código de asistencia activo en este momento.");
    }
    
    const qrData = qrDoc.data();
    
    if (qrData.token.toLowerCase() !== token.toLowerCase()) {
        throw new Error("El código de asistencia ingresado no es válido.");
    }
    
    if (Number(qrData.classNumber) !== Number(classNumber)) {
        throw new Error("Este código corresponde a una clase diferente.");
    }
    
    const created = qrData.created_at.toDate();
    const now = new Date();
    const diffSeconds = (now - created) / 1000;
    if (diffSeconds > 45) {
        throw new Error("El código de asistencia ha expirado. Por favor, escanea el código QR actual de la pantalla.");
    }
    
    if (qrData.lat && qrData.lng && lat && lng) {
        const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371000;
            const phi1 = lat1 * Math.PI / 180;
            const phi2 = lat2 * Math.PI / 180;
            const deltaPhi = (lat2 - lat1) * Math.PI / 180;
            const deltaLambda = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                      Math.cos(phi1) * Math.cos(phi2) *
                      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };
        
        const distance = getHaversineDistance(qrData.lat, qrData.lng, lat, lng);
        if (distance > 150) {
            throw new Error(`Estás demasiado lejos del aula para registrar asistencia. Distancia: ${Math.round(distance)}m (máximo 150m).`);
        }
    }
    
    const attendanceDocRef = db.collection('courses').doc(courseId).collection('attendance').doc(`class_${classNumber}`);
    const attendanceDoc = await attendanceDocRef.get();
    
    if (!attendanceDoc.exists) {
        await attendanceDocRef.set({
            classNumber: Number(classNumber),
            records: { [uid]: 'present' },
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: 'system_qr'
        });
    } else {
        await attendanceDocRef.update({
            [`records.${uid}`]: 'present',
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: 'system_qr'
        });
    }

    // Award +10 XP and log XP action (requirement 5)
    try {
        await db.collection('profiles').doc(uid).collection('xp_logs').add({
            action: 'asistencia',
            description: `Asistencia firmada en Clase ${classNumber}`,
            points: 10,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) {
        console.error("Error logging XP:", e);
    }
    
    return { success: true };
}

module.exports = {
    markAttendance,
    submitQrAttendance
};
