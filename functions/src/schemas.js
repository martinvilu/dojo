/**
 * Esquemas de payload por acción de la callable `api` (mejora 2.07).
 *
 * Toda acción registrada en `actions.js` declara aquí su esquema; el test de
 * paridad lo exige y el dispatcher rechaza las acciones sin esquema.
 *
 * Los objetos son "loose": validan el tipo y el tamaño de los campos que el
 * handler lee y dejan pasar el resto sin tocarlo, para no romper clientes que
 * envían alias (courseId / course_id). Las acciones que escriben un objeto
 * del cliente en Firestore (`updateCourseSettings`, `updateUserProfile`) usan
 * en cambio una lista blanca estricta de claves.
 */
const { z } = require('zod');
const { MATRICULA_RE } = require('./lib/identity');

// --- primitivas -----------------------------------------------------------

const MAX_ID = 200;
const id = z.string().trim().min(1, 'es obligatorio').max(MAX_ID);
/** IDs externos (Moodle) que pueden llegar como número. */
const extId = z.union([id, z.number().int().nonnegative()]);
const text = (max) => z.string().max(max, `admite hasta ${max} caracteres`);
const shortText = text(500);
const html = text(200000);
const bool = z.boolean();
/** Número o string numérico (los formularios envían strings). */
const numeric = z.union([z.number().finite(), z.string().trim().regex(/^-?\d+(\.\d+)?$/, 'debe ser numérico')]);
const latLng = z.number().finite().nullish();
/** Matrícula `UNRN-<números>` (SPEC §1.1); vacío = sin cambios. */
const matricula = z.string().trim().toUpperCase().regex(MATRICULA_RE, 'debe tener el formato UNRN-<números>');
const matriculaOrEmpty = z.union([z.literal(''), matricula]);
/** Nota 0–10 o conceptual; el rango lo valida `lib/grades.js`. */
const grade = z.union([z.number().finite(), text(40)]).nullish();
const isoDate = text(40);
const idList = z.array(id).max(500);
const opt = (schema) => schema.nullish();

const obj = (shape = {}) => z.looseObject(shape);
const empty = obj();
const course = (shape = {}) => obj({ courseId: id, ...shape });

// --- reglas de cursada (Fase 2) -------------------------------------------

const ratio = z.number().min(0).max(1);
const passGrade = z.number().min(0).max(10);

const gradingRulesShape = {
    min_attendance: ratio,
    required_tps: z.union([z.literal('all'), idList]),
    max_exempt_tps: z.number().int().min(0).max(50),
    partial_pass_grade: passGrade,
    promotion_grade: passGrade,
    promotion_ok_ratio: ratio,
    max_late_for_promotion: z.number().int().min(0).max(100),
    allow_promotion_via_recovery: bool,
    late_tolerance_hours: z.number().int().min(0).max(24 * 30),
    min_classes_for_attendance: z.number().int().min(0).max(100),
    consecutive_absences_alert: z.number().int().min(1).max(20),
    no_repo_alert_days: z.number().int().min(1).max(60),
    silent_dropout_days: z.number().int().min(1).max(60),
};
const gradingRules = z.strictObject(gradingRulesShape).partial();

// --- lista blanca de ajustes de curso -------------------------------------

const scheduleEntry = obj({ day: opt(shortText), time: opt(shortText), type: opt(shortText) });
const courseSettingsData = z.strictObject({
    cover_text: text(5000),
    duration_weeks: z.number().int().min(1).max(60).nullable(),
    start_date: isoDate,
    external_calendars: z.array(text(2000)).max(20),
    // undefined: no cambia · string no vacío: reemplaza · null o '': borra.
    github_token: text(500).nullable(),
    github_org: text(100),
    meet_url: text(2000),
    moodle_enabled: bool,
    schedules: z.array(scheduleEntry).max(50),
    commissions: z.array(text(100)).max(50),
    commissions_mapping: z.record(z.string(), z.unknown()),
    class_instances: z.array(z.record(z.string(), z.unknown())).max(400),
}).partial();

const adminProfileData = z.strictObject({
    full_name: text(200),
    email: text(320),
    role: z.enum(['student', 'teacher', 'admin']),
    account_status: z.enum(['pending', 'approved', 'rejected']),
    matricula_unrn: matriculaOrEmpty,
    github_user: text(100),
    github_username: text(100),
    cohort: text(100),
    cohorte: text(100),
    commission: text(100),
    commissions: z.record(z.string(), text(100)),
}).partial();

// --- tabla de esquemas ----------------------------------------------------

const ACTION_SCHEMAS = {
    // perfil
    getProfile: empty,
    updateProfile: obj({
        full_name: opt(text(200)), github_username: opt(text(100)), github_user: opt(text(100)),
        matricula_unrn: opt(matriculaOrEmpty), cohort: opt(text(100)),
    }),
    submitMatricula: obj({ matricula }),
    addSecondaryEmail: obj({ email: z.email().max(320) }),
    mergeProfiles: obj({ targetUid: id, sourceUid: id }),
    getXpLogs: empty,
    getMyXp: course(),
    saveClassAttendance: course({
        classNumber: z.number().int().nonnegative(),
        records: z.record(id, z.enum(['present', 'late', 'absent', 'justified'])).refine((r) => Object.keys(r).length <= 2000, 'demasiados registros'),
    }),
    setStudentCommission: course({ studentId: id, commission: z.string().max(100) }),
    setTeacherCommissions: course({ teacherId: id, commissions: z.array(z.string().max(100)).max(50) }),
    closeCourse: course({ note: opt(text(1000)) }),
    reopenCourse: course({ reason: z.string().trim().min(10, 'contá por qué se reabre (mínimo 10 caracteres)').max(1000) }),
    getCourseClosure: course(),
    getActa: course({ version: opt(z.number().int().positive()) }),
    exportActaCsv: course({ version: opt(z.number().int().positive()) }),
    logActivity: obj({ action: opt(shortText), details: opt(text(5000)) }),
    getActivityLogs: empty,

    // administración
    approveUser: obj({ targetUid: id }),
    updateUserRole: obj({ targetUid: id, newRole: z.enum(['student', 'teacher', 'admin']) }),
    updateUserProfile: obj({ userId: id, data: adminProfileData }),
    getAdminUsers: empty,
    getAdminCourses: empty,
    getGlobalSettings: empty,
    saveGlobalSettings: z.strictObject({ globalCalendarIcsUrl: opt(text(2000)) }),
    getAdminCourseDetails: course(),
    deleteUser: obj({ targetUid: id }),
    createSystemBackup: empty,
    getSystemBackups: empty,
    restoreBackupDocument: obj({ backupId: id, collectionName: id, docId: id }),
    downloadSystemBackup: obj({ backupId: id }),
    deleteBackup: obj({ backupId: id }),

    // asistencia
    submitQrAttendance: course({ classNumber: numeric, token: text(32), lat: latLng, lng: latLng }),
    startQrSession: course({ classNumber: numeric, lat: latLng, lng: latLng }),
    getQrSessionCode: course(),
    stopQrSession: course(),

    // moodle
    moodleAutoEnroll: course(),
    exportCourseToMoodleXml: course({ baseUrl: opt(text(2000)) }),
    syncMoodleCourseRoster: course({ moodleUrl: text(2000), moodleToken: text(500), moodleCourseId: extId }),
    exportGradesToMoodleWebservice: course({
        moodleUrl: text(2000), moodleToken: text(500), moodleCourseId: extId, assignmentId: id,
    }),
    syncMoodleCourseContents: course({ moodleUrl: text(2000), moodleToken: text(500), moodleCourseId: extId }),
    getMoodleLtiDeepLinkContent: course({ baseUrl: opt(text(2000)) }),

    // cursos
    getCourseDetails: course(),
    enrollCourse: obj({ code: text(40) }),
    createCourse: obj({ name: text(200), github_org: opt(text(100)) }),
    updateCourseName: course({ name: text(200) }),
    getCourseTeachers: course(),
    assignTeacher: course({ teacherId: id, role: opt(z.enum(['titular', 'ayudante'])) }),
    removeTeacher: course({ teacherId: id }),
    getTeacherCourses: empty,
    getCourseSettings: course(),
    updateCourseSettings: course({ data: courseSettingsData }),
    cloneCourseExtraData: course({ newCourseId: id }),
    getStudentCourses: empty,
    getCourseRoster: course(),
    deleteCourse: course(),
    updateRosterStudentStatus: course({
        studentId: id, status: z.enum(['approved', 'pending', 'observador', 'removed']),
    }),
    syncGuaraniRoster: course({ rows: z.array(z.record(z.string(), z.unknown())).max(5000) }),

    // gmail y correos
    getGmailAuthUrl: obj({ redirectUri: opt(text(2000)) }),
    saveGmailAuthCode: obj({ code: text(2000), redirectUri: opt(text(2000)) }),
    getGmailAuthStatus: empty,
    disconnectGmailAuth: empty,
    sendGmailNotification: obj({ to: text(2000), subject: text(500), htmlBody: html }),
    getEmailTemplates: course(),
    saveEmailTemplate: course({ templateId: opt(id), name: opt(text(200)), subject: opt(text(500)), bodyHtml: opt(html) }),
    getScheduledEmails: course(),
    createScheduledEmail: course({
        title: opt(text(500)), recipientType: opt(shortText), targetStudentId: opt(id),
        subject: text(500), bodyHtml: html, sendAt: opt(z.union([isoDate, z.number()])),
    }),
    cancelScheduledEmail: obj({ emailId: id }),
    triggerScheduledEmailNow: course({ emailId: id }),
    sendDirectStudentEmail: course({ studentId: id, subject: text(500), bodyHtml: html }),
    getMailLogs: course(),

    // cronograma
    saveScheduleVersion: course({ versionName: opt(text(200)), classInstances: opt(z.array(z.unknown()).max(400)) }),
    getScheduleVersions: course(),
    restoreScheduleVersion: course({ versionId: id }),
    getComparisonCourses: empty,

    // grupos de estudio
    createStudyGroup: course({ name: text(200), description: opt(text(5000)) }),
    joinStudyGroup: obj({ groupId: id }),
    leaveStudyGroup: obj({ groupId: id }),
    getStudyGroups: course(),
    findStudyBuddies: course(),
    updateStudyGroupChatLinks: obj({
        groupId: id, whatsappUrl: opt(text(2000)), telegramUrl: opt(text(2000)), discordUrl: opt(text(2000)),
    }),
    postStudyGroupMessage: obj({ groupId: id, content: text(5000) }),
    getStudyGroupMessages: obj({ groupId: id }),

    // tutorías
    registerAsTutor: course(),
    getCourseTutors: course(),
    bookTutoringSession: course({ tutorId: id, dateTime: opt(isoDate), topic: opt(text(1000)) }),
    getTutoringSessions: course({ role: opt(z.enum(['student', 'tutor'])) }),
    updateTutoringSessionStatus: obj({ sessionId: id, status: text(40) }),

    // notificaciones y analítica
    notifyCourseStudents: course({ message: text(5000), link: opt(text(2000)) }),
    checkAndAlertStudentsAtRisk: course(),
    getDropoutRiskAnalysis: course(),
    getStudentNotifications: empty,
    markNotificationsRead: empty,

    // revisión entre pares y portfolio
    enablePeerReview: obj({ assignmentId: id, enabled: opt(bool), rubric: opt(z.array(z.unknown()).max(50)) }),
    getMyReviewAssignments: course(),
    submitPeerReview: obj({
        assignmentId: id, revieweeId: id, scores: z.record(z.string(), z.unknown()), comment: opt(text(5000)),
    }),
    getPeerReviewFeedback: obj({ assignmentId: id }),
    setSubmissionPortfolioVisibility: obj({ submissionId: id, isPublic: bool }),
    getMyPortfolio: empty,

    // avisos
    createAnnouncement: obj({ course_id: id, message: text(10000) }),
    getTeacherAnnouncements: empty,
    getStudentAnnouncements: obj({ courseIds: opt(idList) }),
    acknowledgeAnnouncement: obj({ announcementId: id }),
    getAnnouncementAcknowledgements: obj({ announcementId: id }),

    // estadísticas
    getTeacherDashboardStats: empty,
    getCourseDashboardStats: course(),

    // tareas y entregas
    archiveAssignment: obj({ assignmentId: id }),
    getTeacherAssignments: obj({ courseIds: opt(idList) }),
    createAssignment: obj({
        title: opt(text(1000)), name: opt(text(1000)), description: opt(text(20000)),
        due_date: opt(isoDate), dueDate: opt(isoDate), template_repo: opt(text(300)), templateRepo: opt(text(300)),
        is_group: opt(bool), isGroup: opt(bool), create_feedback_pr: opt(bool), createFeedbackPr: opt(bool),
        is_required: opt(bool),
    }),
    getAssignmentSubmissions: obj({ assignmentId: id }),
    toggleAccess: obj({ submissionId: id, lock: bool }),
    massToggleAccess: obj({ assignmentId: id, lock: bool }),
    gradeSubmission: obj({ submissionId: id, grade, feedback: opt(text(20000)) }),
    getStudentAssignments: obj({ courseIds: opt(idList) }),
    acceptAssignment: obj({
        assignmentId: id, moodle_lis_outcome_service_url: opt(text(2000)), moodle_lis_result_sourcedid: opt(text(2000)),
    }),
    getStudentGithubActivity: obj({ submissionId: id }),
    getStudentCommits: obj({ submissionId: id }),
    submitAssignment: obj({ submissionId: id, message: opt(text(5000)) }),
    updateAssignment: obj({ assignmentId: id, data: z.record(z.string(), z.unknown()) }),
    syncGradesFromSpreadsheet: obj({ assignmentId: id, sheetUrl: text(2000) }),
    addGroupCollaborator: obj({ submissionId: id, email: text(320) }),
    detectAssignmentPlagiarism: obj({ assignmentId: id, threshold: opt(numeric) }),

    // cursada: reglas, parciales, excepciones, condición (Fase 2)
    getGradingRules: course(),
    updateGradingRules: course({
        rules: gradingRules,
        commissionOverrides: opt(z.record(text(100), gradingRules)),
    }),
    getAssessments: course(),
    createAssessment: course({
        kind: z.enum(['parcial', 'recuperatorio']),
        label: text(60).min(1),
        recovers: opt(id),
        date: opt(isoDate),
        commission: opt(text(100)),
    }),
    updateAssessment: obj({
        assessmentId: id,
        data: z.strictObject({
            label: text(60).min(1), date: isoDate.nullable(), commission: text(100).nullable(), recovers: id.nullable(),
        }).partial(),
    }),
    archiveAssessment: obj({ assessmentId: id }),
    gradeAssessment: obj({
        assessmentId: id, studentId: id, grade, absent: opt(bool), feedback: opt(text(5000)),
    }),
    importAssessmentGrades: obj({
        assessmentId: id,
        rows: z.array(obj({ matricula: opt(text(40)), studentId: opt(id), grade, absent: opt(bool) })).min(1).max(2000),
    }),
    getExceptions: course({ studentId: opt(id) }),
    grantException: course({
        studentId: id,
        type: z.enum(['attendance_waiver', 'tp_exempt', 'deadline_extension']),
        assignmentId: opt(id),
        extraHours: opt(z.number().int().min(1).max(24 * 60)),
        reason: text(2000).min(3, 'la justificación es obligatoria'),
    }),
    revokeException: obj({ exceptionId: id, reason: opt(text(2000)) }),
    getAcademicConditions: course({ rulesOverride: opt(gradingRules) }),
    getMyAcademicCondition: course(),

    // LTI 1.3 Advantage
    createLtiRegistrationToken: course(),
    registerLtiPlatform: course({
        issuer: text(500).min(1), clientId: text(300).min(1), deploymentId: text(300).min(1),
        authLoginUrl: text(2000), authTokenUrl: text(2000), jwksUrl: text(2000),
    }),
    getLtiPlatforms: course(),
    unlinkLtiPlatform: course({ platformId: id }),
    getLtiPlatformsForReview: empty,
    setLtiPlatformStatus: obj({ platformId: id, status: z.enum(['pending', 'approved', 'disabled']) }),
    syncLtiRoster: course(),
    publishLtiGrades: course({ assignmentId: opt(id), assessmentId: opt(id) }),

    // retención
    refreshStudentAlerts: course(),
    getStudentAlerts: course({ includeResolved: opt(bool) }),
    updateStudentAlert: obj({
        alertId: id,
        action: z.enum(['contacted', 'snooze', 'resolve', 'reopen']),
        days: opt(z.number().int().min(1).max(60)),
        channel: opt(z.enum(['email', 'discord', 'moodle', 'presencial', 'tutoria', 'otro'])),
        summary: opt(text(2000)),
    }),
    addContactLog: course({
        studentId: id,
        channel: z.enum(['email', 'discord', 'moodle', 'presencial', 'tutoria', 'otro']),
        summary: text(2000).min(3, 'contá brevemente qué se habló'),
        alertId: opt(id),
    }),
    getContactLogs: course({ studentId: opt(id) }),
    scheduleStudentTutoring: course({ studentId: id, dateTime: isoDate, note: opt(text(1000)), alertId: opt(id) }),
    createReviewRequest: course({
        kind: z.enum(['attendance', 'submission', 'grade', 'assessment', 'other']),
        refId: opt(id),
        refLabel: text(200).min(1),
        message: text(3000).min(3, 'escribí tu consulta'),
    }),
    getReviewRequests: course({ status: opt(z.enum(['open', 'answered', 'closed'])) }),
    replyReviewRequest: obj({ requestId: id, message: opt(text(3000)), close: opt(bool) }),
    markCommentSolution: course({ commentId: id, isSolution: bool }),
    importMoodleLogs: course({
        events: z.array(z.strictObject({
            userId: z.string().regex(/^\d{1,12}$/),
            time: text(60).min(1),
            timeMs: z.number().int().nullable(),
            eventName: text(300),
            context: text(500),
            component: opt(text(200)),
        })).min(1).max(1000),
    }),

    // URLs semánticas
    setCourseRoute: course({ slug: text(60).min(2), year: z.number().int().min(2000).max(2100), term: z.enum(['1c', '2c', 'anual', 'verano']) }),
    resolveCourseRoute: obj({
        asignatura: text(60).min(1), anio: numeric, cuatrimestre: text(10).min(1), comision: text(100).min(1),
        studentPublicId: opt(text(20)), practica: opt(text(120)),
    }),
};

module.exports = { ACTION_SCHEMAS, gradingRules, gradingRulesShape };
