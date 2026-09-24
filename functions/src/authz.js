/**
 * Autorización centralizada de la callable `api`.
 *
 * Los handlers corren con el SDK admin, que ignora las reglas de Firestore,
 * así que esta capa es la única barrera entre un usuario autenticado y los
 * datos de otros cursos. Cada acción declara una política; las acciones sin
 * política se rechazan (fail closed).
 *
 * Políticas:
 *   AUTHENTICATED  cualquier usuario logueado (el handler opera sobre su uid)
 *   STAFF          rol teacher o admin
 *   ADMIN          rol admin
 *   staffOf(...)   docente asignado al curso de cada objetivo (o admin)
 *   memberOf(...)  docente o estudiante inscripto en el curso (o admin)
 *
 * Los objetivos indican de dónde sale el curso: 'course' lee
 * payload.courseId; el resto resuelve el curso a partir del documento
 * referenciado (tarea, entrega, aviso, correo programado, grupo de estudio).
 */
const { HttpsError } = require('firebase-functions/v2/https');

const AUTHENTICATED = { kind: 'authenticated' };
const STAFF = { kind: 'staff' };
const ADMIN = { kind: 'admin' };
const staffOf = (...targets) => ({ kind: 'courseStaff', targets });
const memberOf = (...targets) => ({ kind: 'courseMember', targets });

/**
 * `scopeCourseIds` filtra payload.courseIds a los cursos accesibles para el
 * llamador en lugar de rechazar la llamada completa.
 */
const withScopedCourseIds = (policy, scope) => ({ ...policy, scopeCourseIds: scope });

const ACTION_POLICIES = {
    // perfil propio
    getProfile: AUTHENTICATED,
    updateProfile: AUTHENTICATED,
    submitMatricula: AUTHENTICATED,
    addSecondaryEmail: AUTHENTICATED,
    getXpLogs: AUTHENTICATED,
    logActivity: AUTHENTICATED,

    // administración
    approveUser: ADMIN,
    updateUserRole: ADMIN,
    updateUserProfile: ADMIN,
    getAdminUsers: ADMIN,
    getAdminCourses: ADMIN,
    getGlobalSettings: AUTHENTICATED,
    saveGlobalSettings: ADMIN,
    getAdminCourseDetails: ADMIN,
    deleteUser: ADMIN,
    mergeProfiles: ADMIN,
    getActivityLogs: ADMIN,
    createSystemBackup: ADMIN,
    getSystemBackups: ADMIN,
    restoreBackupDocument: ADMIN,
    downloadSystemBackup: ADMIN,
    deleteBackup: ADMIN,

    // asistencia (el handler valida la inscripción / el token QR)
    markAttendance: AUTHENTICATED,
    submitQrAttendance: AUTHENTICATED,

    // moodle
    moodleAutoEnroll: AUTHENTICATED,
    exportCourseToMoodleXml: staffOf('course'),
    syncMoodleCourseRoster: staffOf('course'),
    exportGradesToMoodleWebservice: staffOf('course', 'assignment'),
    syncMoodleCourseContents: staffOf('course'),
    getMoodleLtiDeepLinkContent: staffOf('course'),

    // cursos
    getCourseDetails: memberOf('course'),
    enrollCourse: AUTHENTICATED,
    createCourse: ADMIN,
    updateCourseName: staffOf('course'),
    getCourseTeachers: memberOf('course'),
    assignTeacher: ADMIN,
    removeTeacher: ADMIN,
    getTeacherCourses: STAFF,
    getCourseSettings: staffOf('course'),
    updateCourseSettings: staffOf('course'),
    cloneCourseExtraData: staffOf('course', 'newCourse'),
    getStudentCourses: AUTHENTICATED,
    getCourseRoster: memberOf('course'),
    deleteCourse: ADMIN,
    updateRosterStudentStatus: staffOf('course'),
    syncGuaraniRoster: staffOf('course'),

    // gmail y correos
    getGmailAuthUrl: STAFF,
    saveGmailAuthCode: STAFF,
    getGmailAuthStatus: STAFF,
    disconnectGmailAuth: STAFF,
    sendGmailNotification: STAFF,
    getEmailTemplates: staffOf('course'),
    saveEmailTemplate: staffOf('course'),
    getScheduledEmails: staffOf('course'),
    createScheduledEmail: staffOf('course'),
    cancelScheduledEmail: staffOf('scheduledEmail'),
    triggerScheduledEmailNow: staffOf('course', 'scheduledEmail'),
    sendDirectStudentEmail: staffOf('course'),
    getMailLogs: staffOf('course'),

    // cronograma
    saveScheduleVersion: staffOf('course'),
    getScheduleVersions: staffOf('course'),
    restoreScheduleVersion: staffOf('course'),
    getComparisonCourses: STAFF,

    // grupos de estudio
    createStudyGroup: memberOf('course'),
    joinStudyGroup: memberOf('studyGroup'),
    leaveStudyGroup: memberOf('studyGroup'),
    getStudyGroups: memberOf('course'),
    findStudyBuddies: memberOf('course'),
    updateStudyGroupChatLinks: memberOf('studyGroup'),
    postStudyGroupMessage: memberOf('studyGroup'),
    getStudyGroupMessages: memberOf('studyGroup'),

    // tutorías (updateTutoringSessionStatus valida tutor/estudiante de la sesión)
    registerAsTutor: memberOf('course'),
    getCourseTutors: memberOf('course'),
    bookTutoringSession: memberOf('course'),
    getTutoringSessions: memberOf('course'),
    updateTutoringSessionStatus: AUTHENTICATED,

    // notificaciones y analítica
    notifyCourseStudents: staffOf('course'),
    checkAndAlertStudentsAtRisk: staffOf('course'),
    getDropoutRiskAnalysis: staffOf('course'),
    getStudentNotifications: AUTHENTICATED,
    markNotificationsRead: AUTHENTICATED,

    // revisión entre pares y portfolio
    enablePeerReview: staffOf('assignment'),
    getMyReviewAssignments: memberOf('course'),
    submitPeerReview: memberOf('assignment'),
    getPeerReviewFeedback: AUTHENTICATED,
    setSubmissionPortfolioVisibility: AUTHENTICATED,
    getMyPortfolio: AUTHENTICATED,

    // avisos
    createAnnouncement: staffOf('course'),
    getTeacherAnnouncements: STAFF,
    getStudentAnnouncements: withScopedCourseIds(AUTHENTICATED, 'member'),
    acknowledgeAnnouncement: memberOf('announcement'),
    getAnnouncementAcknowledgements: staffOf('announcement'),

    // estadísticas
    getTeacherDashboardStats: STAFF,
    getCourseDashboardStats: staffOf('course'),

    // tareas y entregas
    archiveAssignment: staffOf('assignment'),
    getTeacherAssignments: withScopedCourseIds(STAFF, 'staff'),
    createAssignment: staffOf('course'),
    getAssignmentSubmissions: staffOf('assignment'),
    toggleAccess: staffOf('submission'),
    massToggleAccess: staffOf('assignment'),
    gradeSubmission: staffOf('submission'),
    getStudentAssignments: withScopedCourseIds(AUTHENTICATED, 'member'),
    acceptAssignment: memberOf('assignment'),
    getStudentGithubActivity: AUTHENTICATED,
    getStudentCommits: AUTHENTICATED,
    submitAssignment: AUTHENTICATED,
    updateAssignment: staffOf('assignment'),
    syncGradesFromSpreadsheet: staffOf('assignment'),
    addGroupCollaborator: memberOf('submission'),

    // plagio
    detectAssignmentPlagiarism: staffOf('assignment'),
};

function deny(message = 'No tenés permisos para realizar esta acción.') {
    return new HttpsError('permission-denied', message);
}

async function courseIdOfDoc(db, collection, docId, label) {
    if (!docId) throw new HttpsError('invalid-argument', `Falta el identificador de ${label}.`);
    const snap = await db.collection(collection).doc(String(docId)).get();
    if (!snap || !snap.exists) throw new HttpsError('not-found', `No se encontró ${label}.`);
    return snap.data().course_id;
}

async function courseIdOfAssignment(db, assignmentId) {
    return courseIdOfDoc(db, 'assignments', assignmentId, 'la tarea');
}

const TARGET_RESOLVERS = {
    course: async (payload) => {
        const courseId = payload.courseId || payload.course_id || payload.course;
        if (!courseId) throw new HttpsError('invalid-argument', 'Falta el ID del curso.');
        return courseId;
    },
    newCourse: async (payload) => {
        if (!payload.newCourseId) throw new HttpsError('invalid-argument', 'Falta el ID del curso destino.');
        return payload.newCourseId;
    },
    assignment: async (payload, db) => courseIdOfAssignment(db, payload.assignmentId),
    submission: async (payload, db) => {
        if (!payload.submissionId) throw new HttpsError('invalid-argument', 'Falta el identificador de la entrega.');
        const snap = await db.collection('submissions').doc(String(payload.submissionId)).get();
        if (!snap || !snap.exists) throw new HttpsError('not-found', 'No se encontró la entrega.');
        return courseIdOfAssignment(db, snap.data().assignment_id);
    },
    announcement: async (payload, db) => courseIdOfDoc(db, 'announcements', payload.announcementId, 'el aviso'),
    scheduledEmail: async (payload, db) => courseIdOfDoc(db, 'scheduled_emails', payload.emailId, 'el correo programado'),
    studyGroup: async (payload, db) => courseIdOfDoc(db, 'study_groups', payload.groupId, 'el grupo de estudio'),
};

async function docExists(db, collection, docId) {
    const snap = await db.collection(collection).doc(docId).get();
    return Boolean(snap && snap.exists);
}

async function isCourseStaff(db, courseId, uid) {
    return docExists(db, 'course_teachers', `${courseId}_${uid}`);
}

async function isCourseMember(db, courseId, uid) {
    if (await isCourseStaff(db, courseId, uid)) return true;
    if (await docExists(db, 'course_roster', `${courseId}_${uid}`)) return true;
    return docExists(db, 'enrollments', `${uid}_${courseId}`);
}

async function scopeCourseIds(courseIds, scope, { db, uid }) {
    if (!Array.isArray(courseIds)) return [];
    const check = scope === 'staff' ? isCourseStaff : isCourseMember;
    const allowed = [];
    for (const courseId of courseIds) {
        if (typeof courseId === 'string' && courseId && await check(db, courseId, uid)) {
            allowed.push(courseId);
        }
    }
    return allowed;
}

/**
 * Valida que `uid` pueda ejecutar `action` con `payload`.
 *
 * Devuelve el payload a entregar al handler (con courseIds filtrados cuando
 * la política lo pide) o lanza HttpsError('permission-denied').
 */
async function authorizeAction(action, payload, { uid, db, profile }) {
    const policy = Object.prototype.hasOwnProperty.call(ACTION_POLICIES, action)
        ? ACTION_POLICIES[action]
        : null;
    if (!policy) throw deny(`La acción ${action} no tiene una política de acceso definida.`);

    const role = profile && profile.role;
    const isAdmin = role === 'admin';
    const isStaff = isAdmin || role === 'teacher';

    switch (policy.kind) {
        case 'authenticated':
            break;
        case 'staff':
            if (!isStaff) throw deny('Solo docentes y administradores pueden realizar esta acción.');
            break;
        case 'admin':
            if (!isAdmin) throw deny('Solo los administradores pueden realizar esta acción.');
            break;
        case 'courseStaff':
        case 'courseMember': {
            const check = policy.kind === 'courseStaff' ? isCourseStaff : isCourseMember;
            for (const target of policy.targets) {
                const courseId = await TARGET_RESOLVERS[target](payload, db);
                if (isAdmin) continue;
                if (!courseId || !(await check(db, courseId, uid))) {
                    throw deny(policy.kind === 'courseStaff'
                        ? 'Solo los docentes del curso pueden realizar esta acción.'
                        : 'No tenés acceso a este curso.');
                }
            }
            break;
        }
        default:
            throw deny();
    }

    if (policy.scopeCourseIds && !isAdmin) {
        return {
            ...payload,
            courseIds: await scopeCourseIds(payload.courseIds, policy.scopeCourseIds, { db, uid }),
        };
    }
    return payload;
}

module.exports = {
    ACTION_POLICIES,
    authorizeAction,
    isCourseStaff,
    isCourseMember,
};
