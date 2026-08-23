const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function syncGradeToMoodle(previousData, grade, feedback) {
    if (!previousData.moodle_lis_outcome_service_url || !previousData.moodle_lis_result_sourcedid) {
        logger.info("No Moodle LTI sync parameters found for submission:", previousData.id || "unknown");
        return;
    }

    // Verify if Moodle integration is enabled for this course
    if (previousData.assignment_id) {
        try {
            const assignmentDoc = await db.collection('assignments').doc(previousData.assignment_id).get();
            if (assignmentDoc.exists) {
                const assignment = assignmentDoc.data();
                const courseDoc = await db.collection('courses').doc(assignment.course_id).get();
                if (courseDoc.exists) {
                    const course = courseDoc.data();
                    if (!course.moodle_enabled) {
                        logger.info("Moodle integration is disabled for this course:", course.name);
                        return;
                    }
                }
            }
        } catch (e) {
            logger.error("Error verifying moodle_enabled setting in course:", e);
        }
    }

    const outcomeUrl = previousData.moodle_lis_outcome_service_url;
    const sourcedId = previousData.moodle_lis_result_sourcedid;

    // Convert grade to standard decimal (0.0 to 1.0)
    let numericGrade = parseFloat(grade);
    if (isNaN(numericGrade)) {
        numericGrade = 0.0;
    } else {
        // If grade is out of 10, normalize to 1.0
        if (numericGrade > 1.0) {
            numericGrade = numericGrade / 10.0;
        }
    }
    if (numericGrade > 1.0) numericGrade = 1.0;
    if (numericGrade < 0.0) numericGrade = 0.0;

    logger.info(`Sincronizando nota ${numericGrade} con Moodle URL: ${outcomeUrl}`);

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>${Date.now()}</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <replaceResultRequest>
      <resultRecord>
        <sourcedGUID>
          <sourcedId>${sourcedId}</sourcedId>
        </sourcedGUID>
        <result>
          <resultScore>
            <language>es</language>
            <textString>${numericGrade.toFixed(2)}</textString>
          </resultScore>
        </result>
      </resultRecord>
    </replaceResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>`;

    try {
        const fetch = require('node-fetch');
        const response = await fetch(outcomeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                'Authorization': 'OAuth realm=""'
            },
            body: xmlPayload
        });
        
        const resText = await response.text();
        logger.info("Respuesta de sincronización con Moodle:", response.status, resText);
        
        await db.collection('audit_logs').add({
            action: 'moodle_grade_sync',
            submission_id: previousData.id || '',
            status: response.ok ? 'success' : 'failure',
            status_code: response.status,
            grade: String(grade),
            normalized_grade: numericGrade,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        logger.error("Error al sincronizar nota con Moodle:", err);
    }
}

const actionModules = {
    // profile
    getProfile: './src/modules/auth/profile',
    updateProfile: './src/modules/auth/profile',
    submitMatricula: './src/modules/auth/profile',
    
    // admin
    approveUser: './src/modules/course/admin',
    updateUserRole: './src/modules/course/admin',
    updateUserProfile: './src/modules/course/admin',
    getAdminUsers: './src/modules/course/admin',
    getAdminCourses: './src/modules/course/admin',
    getGlobalSettings: './src/modules/course/admin',
    saveGlobalSettings: './src/modules/course/admin',
    getAdminCourseDetails: './src/modules/course/admin',
    deleteUser: './src/modules/course/admin',
    
    // attendance
    markAttendance: './src/modules/attendance/attendance',
    submitQrAttendance: './src/modules/attendance/attendance',
    
    // moodle
    moodleAutoEnroll: './src/modules/integrations/moodle',
    exportCourseToMoodleXml: './src/modules/integrations/moodle',
    syncMoodleCourseRoster: './src/modules/integrations/moodle',
    exportGradesToMoodleWebservice: './src/modules/integrations/moodle',
    syncMoodleCourseContents: './src/modules/integrations/moodle',
    getMoodleLtiDeepLinkContent: './src/modules/integrations/moodle',
    
    // courses
    getCourseDetails: './src/modules/course/courses',
    enrollCourse: './src/modules/course/courses',
    createCourse: './src/modules/course/courses',
    updateCourseName: './src/modules/course/courses',
    getCourseTeachers: './src/modules/course/courses',
    assignTeacher: './src/modules/course/courses',
    removeTeacher: './src/modules/course/courses',
    getTeacherCourses: './src/modules/course/courses',
    getCourseSettings: './src/modules/course/courses',
    updateCourseSettings: './src/modules/course/courses',
    cloneCourseExtraData: './src/modules/course/courses',
    getStudentCourses: './src/modules/course/courses',
    getCourseRoster: './src/modules/course/courses',
    deleteCourse: './src/modules/course/courses',
    updateRosterStudentStatus: './src/modules/course/courses',
    syncGuaraniRoster: './src/modules/course/courses',
    addSecondaryEmail: './src/modules/auth/profile',
    mergeProfiles: './src/modules/auth/profile',
    getXpLogs: './src/modules/auth/profile',

    logActivity: './src/modules/system/activity',
    getActivityLogs: './src/modules/system/activity',
    
    // gmailAuth & Email Management
    getGmailAuthUrl: './src/modules/mail/gmailAuth',
    saveGmailAuthCode: './src/modules/mail/gmailAuth',
    getGmailAuthStatus: './src/modules/mail/gmailAuth',
    disconnectGmailAuth: './src/modules/mail/gmailAuth',
    sendGmailNotification: './src/modules/mail/gmailAuth',
    
    // emailTemplates
    getEmailTemplates: './src/modules/mail/emailTemplates',
    saveEmailTemplate: './src/modules/mail/emailTemplates',
    
    // scheduledEmails
    getScheduledEmails: './src/modules/mail/scheduledEmails',
    createScheduledEmail: './src/modules/mail/scheduledEmails',
    cancelScheduledEmail: './src/modules/mail/scheduledEmails',
    triggerScheduledEmailNow: './src/modules/mail/scheduledEmails',
    sendDirectStudentEmail: './src/modules/mail/scheduledEmails',
    getMailLogs: './src/modules/mail/scheduledEmails',
    
    // schedule
    saveScheduleVersion: './src/modules/course/schedule',
    getScheduleVersions: './src/modules/course/schedule',
    restoreScheduleVersion: './src/modules/course/schedule',
    getComparisonCourses: './src/modules/course/schedule',
    
    // studyGroups
    createStudyGroup: './src/modules/study_groups/studyGroups',
    joinStudyGroup: './src/modules/study_groups/studyGroups',
    leaveStudyGroup: './src/modules/study_groups/studyGroups',
    getStudyGroups: './src/modules/study_groups/studyGroups',
    findStudyBuddies: './src/modules/study_groups/studyGroups',
    updateStudyGroupChatLinks: './src/modules/study_groups/studyGroups',
    postStudyGroupMessage: './src/modules/study_groups/studyGroups',
    getStudyGroupMessages: './src/modules/study_groups/studyGroups',
    
    // tutoring
    registerAsTutor: './src/modules/tutoring/tutoring',
    getCourseTutors: './src/modules/tutoring/tutoring',
    bookTutoringSession: './src/modules/tutoring/tutoring',
    getTutoringSessions: './src/modules/tutoring/tutoring',
    updateTutoringSessionStatus: './src/modules/tutoring/tutoring',
    
    // notifications
    notifyCourseStudents: './src/modules/notifications/notifications',
    checkAndAlertStudentsAtRisk: './src/modules/notifications/notifications',
    getStudentNotifications: './src/modules/notifications/notifications',
    markNotificationsRead: './src/modules/notifications/notifications',
    
    // backups
    createSystemBackup: './src/modules/system/backups',
    getSystemBackups: './src/modules/system/backups',
    restoreBackupDocument: './src/modules/system/backups',
    downloadSystemBackup: './src/modules/system/backups',
    deleteBackup: './src/modules/system/backups',
    
    // announcements
    createAnnouncement: './src/modules/course/announcements',
    getTeacherAnnouncements: './src/modules/course/announcements',
    getStudentAnnouncements: './src/modules/course/announcements',
    acknowledgeAnnouncement: './src/modules/course/announcements',
    getAnnouncementAcknowledgements: './src/modules/course/announcements',
    
    // stats
    getTeacherDashboardStats: './src/modules/course/stats',
    getCourseDashboardStats: './src/modules/course/stats',
    
    // assignments
    archiveAssignment: './src/modules/github/assignments',
    getTeacherAssignments: './src/modules/github/assignments',
    createAssignment: './src/modules/github/assignments',
    getAssignmentSubmissions: './src/modules/github/assignments',
    toggleAccess: './src/modules/github/assignments',
    massToggleAccess: './src/modules/github/assignments',
    gradeSubmission: './src/modules/github/assignments',
    getStudentAssignments: './src/modules/github/assignments',
    acceptAssignment: './src/modules/github/assignments',
    getStudentGithubActivity: './src/modules/github/assignments',
    getStudentCommits: './src/modules/github/assignments',
    submitAssignment: './src/modules/github/assignments',
    updateAssignment: './src/modules/github/assignments',
    syncGradesFromSpreadsheet: './src/modules/github/assignments',
    addGroupCollaborator: './src/modules/github/assignments',

    // plagiarism
    detectAssignmentPlagiarism: './src/modules/github/plagiarism',
};

exports.api = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in.');
    const uid = request.auth.uid;
    const { action, payload } = request.data;
    
    const getMyProfile = async () => {
        try {
            const snap = await db.collection('profiles').doc(uid).get();
            return (snap && typeof snap.data === 'function') ? snap.data() : null;
        } catch (e) {
            return null;
        }
    };
    
    try {
        const moduleName = actionModules[action];
        if (!moduleName) throw new HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        
        logger.info(`[API Call] Iniciando acción: ${action}`, { uid, payload_keys: Object.keys(payload || {}) });
        const actionModule = require(moduleName);
        
        const handler = actionModule[action];
        if (typeof handler !== 'function') {
            throw new HttpsError('internal', `El manejador para ${action} no está implementado en ${moduleName}`);
        }
        
        const context = {
            uid,
            request,
            db,
            admin,
            getMyProfile,
            syncGradeToMoodle
        };
        
        const result = await handler(payload || {}, context);

        // Auto log write actions in activity_logs
        if (action !== 'getProfile' && action !== 'getActivityLogs' && action !== 'getStudentNotifications' && !action.startsWith('get')) {
            try {
                const pData = await getMyProfile();
                await db.collection('activity_logs').add({
                    uid,
                    user_name: pData ? (pData.full_name || pData.email) : 'Usuario',
                    user_email: pData ? pData.email : '',
                    user_role: pData ? pData.role : 'student',
                    action: action,
                    details: payload ? JSON.stringify(payload).substring(0, 200) : '',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                logger.error("Error writing activity log:", e);
            }
        }

        logger.info(`[API Call] Acción completada: ${action}`, { uid });
        return result;
    } catch (e) {
        logger.error(`[API Error] Error en acción: ${action}`, { uid, error: e.message, stack: e.stack });
        throw new HttpsError('internal', e.message);
    }
});

exports.calendar = onRequest(async (req, res) => {
    const calendarHandler = require('./src/modules/calendar/calendar').calendar;
    return calendarHandler(req, res);
});

exports.webhook = onRequest(async (req, res) => {
    const webhookHandler = require('./src/modules/github/webhook').webhook;
    return webhookHandler(req, res);
});

exports.exportGradesCsv = onRequest(async (req, res) => {
    const handler = require('./src/modules/course/export').exportGradesCsv;
    return handler(req, res);
});

exports.exportAttendanceCsv = onRequest(async (req, res) => {
    const handler = require('./src/modules/course/export').exportAttendanceCsv;
    return handler(req, res);
});

exports.importGrades = onRequest(async (req, res) => {
    const handler = require('./src/modules/course/export').importGrades;
    return handler(req, res);
});

exports.sendDailySummaries = onSchedule({ schedule: 'every day 20:00', timeZone: 'America/Argentina/Buenos_Aires' }, async (event) => {
    const handler = require('./src/modules/notifications/notifications').sendDailySummaries;
    return handler(event);
});
