async function getTeacherDashboardStats(payload, context) {
    const { uid, db } = context;
    const cSnap = await db.collection('course_teachers').where('teacher_id', '==', uid).get();
    const courseIds = cSnap.docs.map(d => d.data().course_id);
    if (courseIds.length === 0) return { pendingCorrections: 0 };
    
    let pendingCorrections = 0;
    const chunks = [];
    for (let i = 0; i < courseIds.length; i += 10) {
        chunks.push(courseIds.slice(i, i + 10));
    }
    
    for (const chunk of chunks) {
        const aSnap = await db.collection('assignments').where('course_id', 'in', chunk).get();
        const assignmentIds = aSnap.docs.map(d => d.id);
        if (assignmentIds.length === 0) continue;
        
        const aChunks = [];
        for (let j = 0; j < assignmentIds.length; j += 10) {
            aChunks.push(assignmentIds.slice(j, j + 10));
        }
        
        for (const achunk of aChunks) {
            const sSnap = await db.collection('submissions').where('assignment_id', 'in', achunk).where('grade', '==', '').get();
            pendingCorrections += sSnap.size;
        }
    }
    return { pendingCorrections };
}

async function getCourseDashboardStats(payload, context) {
    const { uid, db } = context;
    const { courseId } = payload;
    
    // Check teacher auth
    const ctSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!ctSnap.exists) throw new Error("No tienes acceso a las estadísticas de este curso");

    const courseSnap = await db.collection('courses').doc(courseId).get();
    const courseData = courseSnap.data();
    const totalClasses = courseData.class_instances ? courseData.class_instances.length : 0;
    
    const studentsSnap = await db.collection('enrollments').where('course_id', '==', courseId).get();
    const totalStudents = studentsSnap.size;

    const assignmentsSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
    const assignmentIds = assignmentsSnap.docs.map(d => d.id);
    
    let totalSubmissions = 0;
    let pendingCorrections = 0;
    let onTimeSubmissions = 0;
    
    if (assignmentIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < assignmentIds.length; i += 10) {
            chunks.push(assignmentIds.slice(i, i + 10));
        }
        for (const chunk of chunks) {
            const sSnap = await db.collection('submissions').where('assignment_id', 'in', chunk).get();
            totalSubmissions += sSnap.size;
            
            sSnap.docs.forEach(d => {
                const sData = d.data();
                if (!sData.grade) pendingCorrections++;
                
                // Check if on time
                const assignment = assignmentsSnap.docs.find(a => a.id === sData.assignment_id).data();
                if (sData.submitted_at && assignment.due_date) {
                    if (sData.submitted_at.toDate() <= new Date(assignment.due_date)) {
                        onTimeSubmissions++;
                    }
                }
            });
        }
    }

    return {
        name: courseData.name,
        totalStudents,
        totalClasses,
        totalAssignments: assignmentIds.length,
        totalSubmissions,
        pendingCorrections,
        onTimeSubmissions
    };
}

module.exports = {
    getTeacherDashboardStats,
    getCourseDashboardStats
};
