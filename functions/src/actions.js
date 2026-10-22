/**
 * Registro de acciones de la callable `api`: nombre de acción -> módulo
 * que exporta el handler homónimo. Las rutas son relativas a este archivo.
 *
 * Toda acción registrada aquí debe declarar además su política de acceso en
 * `authz.js`; el dispatcher rechaza las acciones sin política.
 */
const ACTION_MODULES = {
    // profile
    getProfile: './modules/auth/profile',
    updateProfile: './modules/auth/profile',
    submitMatricula: './modules/auth/profile',
    
    // admin
    approveUser: './modules/course/admin',
    updateUserRole: './modules/course/admin',
    updateUserProfile: './modules/course/admin',
    getAdminUsers: './modules/course/admin',
    getAdminCourses: './modules/course/admin',
    getGlobalSettings: './modules/course/admin',
    saveGlobalSettings: './modules/course/admin',
    getAdminCourseDetails: './modules/course/admin',
    deleteUser: './modules/course/admin',
    
    // attendance
    markAttendance: './modules/attendance/attendance',
    submitQrAttendance: './modules/attendance/attendance',
    startQrSession: './modules/attendance/attendance',
    getQrSessionCode: './modules/attendance/attendance',
    stopQrSession: './modules/attendance/attendance',
    
    // moodle
    moodleAutoEnroll: './modules/integrations/moodle',
    exportCourseToMoodleXml: './modules/integrations/moodle',
    syncMoodleCourseRoster: './modules/integrations/moodle',
    exportGradesToMoodleWebservice: './modules/integrations/moodle',
    syncMoodleCourseContents: './modules/integrations/moodle',
    getMoodleLtiDeepLinkContent: './modules/integrations/moodle',
    
    // courses
    getCourseDetails: './modules/course/courses',
    enrollCourse: './modules/course/courses',
    createCourse: './modules/course/courses',
    updateCourseName: './modules/course/courses',
    getCourseTeachers: './modules/course/courses',
    assignTeacher: './modules/course/courses',
    removeTeacher: './modules/course/courses',
    getTeacherCourses: './modules/course/courses',
    getCourseSettings: './modules/course/courses',
    updateCourseSettings: './modules/course/courses',
    cloneCourseExtraData: './modules/course/courses',
    getStudentCourses: './modules/course/courses',
    getCourseRoster: './modules/course/courses',
    deleteCourse: './modules/course/courses',
    updateRosterStudentStatus: './modules/course/courses',
    syncGuaraniRoster: './modules/course/courses',
    addSecondaryEmail: './modules/auth/profile',
    mergeProfiles: './modules/auth/profile',
    getXpLogs: './modules/auth/profile',

    logActivity: './modules/system/activity',
    getActivityLogs: './modules/system/activity',
    
    // gmailAuth & Email Management
    getGmailAuthUrl: './modules/mail/gmailAuth',
    saveGmailAuthCode: './modules/mail/gmailAuth',
    getGmailAuthStatus: './modules/mail/gmailAuth',
    disconnectGmailAuth: './modules/mail/gmailAuth',
    sendGmailNotification: './modules/mail/gmailAuth',
    
    // emailTemplates
    getEmailTemplates: './modules/mail/emailTemplates',
    saveEmailTemplate: './modules/mail/emailTemplates',
    
    // scheduledEmails
    getScheduledEmails: './modules/mail/scheduledEmails',
    createScheduledEmail: './modules/mail/scheduledEmails',
    cancelScheduledEmail: './modules/mail/scheduledEmails',
    triggerScheduledEmailNow: './modules/mail/scheduledEmails',
    sendDirectStudentEmail: './modules/mail/scheduledEmails',
    getMailLogs: './modules/mail/scheduledEmails',
    
    // schedule
    saveScheduleVersion: './modules/course/schedule',
    getScheduleVersions: './modules/course/schedule',
    restoreScheduleVersion: './modules/course/schedule',
    getComparisonCourses: './modules/course/schedule',
    
    // studyGroups
    createStudyGroup: './modules/study_groups/studyGroups',
    joinStudyGroup: './modules/study_groups/studyGroups',
    leaveStudyGroup: './modules/study_groups/studyGroups',
    getStudyGroups: './modules/study_groups/studyGroups',
    findStudyBuddies: './modules/study_groups/studyGroups',
    updateStudyGroupChatLinks: './modules/study_groups/studyGroups',
    postStudyGroupMessage: './modules/study_groups/studyGroups',
    getStudyGroupMessages: './modules/study_groups/studyGroups',
    
    // tutoring
    registerAsTutor: './modules/tutoring/tutoring',
    getCourseTutors: './modules/tutoring/tutoring',
    bookTutoringSession: './modules/tutoring/tutoring',
    getTutoringSessions: './modules/tutoring/tutoring',
    updateTutoringSessionStatus: './modules/tutoring/tutoring',
    
    // notifications
    notifyCourseStudents: './modules/notifications/notifications',
    checkAndAlertStudentsAtRisk: './modules/notifications/notifications',
    getDropoutRiskAnalysis: './modules/course/analytics',
    enablePeerReview: './modules/github/peerreview',
    getMyReviewAssignments: './modules/github/peerreview',
    submitPeerReview: './modules/github/peerreview',
    getPeerReviewFeedback: './modules/github/peerreview',
    setSubmissionPortfolioVisibility: './modules/course/portfolio',
    getMyPortfolio: './modules/course/portfolio',
    getStudentNotifications: './modules/notifications/notifications',
    markNotificationsRead: './modules/notifications/notifications',
    
    // backups
    createSystemBackup: './modules/system/backups',
    getSystemBackups: './modules/system/backups',
    restoreBackupDocument: './modules/system/backups',
    downloadSystemBackup: './modules/system/backups',
    deleteBackup: './modules/system/backups',
    
    // announcements
    createAnnouncement: './modules/course/announcements',
    getTeacherAnnouncements: './modules/course/announcements',
    getStudentAnnouncements: './modules/course/announcements',
    acknowledgeAnnouncement: './modules/course/announcements',
    getAnnouncementAcknowledgements: './modules/course/announcements',
    
    // stats
    getTeacherDashboardStats: './modules/course/stats',
    getCourseDashboardStats: './modules/course/stats',
    
    // assignments
    archiveAssignment: './modules/github/assignments',
    getTeacherAssignments: './modules/github/assignments',
    createAssignment: './modules/github/assignments',
    getAssignmentSubmissions: './modules/github/assignments',
    toggleAccess: './modules/github/assignments',
    massToggleAccess: './modules/github/assignments',
    gradeSubmission: './modules/github/assignments',
    getStudentAssignments: './modules/github/assignments',
    acceptAssignment: './modules/github/assignments',
    getStudentGithubActivity: './modules/github/assignments',
    getStudentCommits: './modules/github/assignments',
    submitAssignment: './modules/github/assignments',
    updateAssignment: './modules/github/assignments',
    syncGradesFromSpreadsheet: './modules/github/assignments',
    addGroupCollaborator: './modules/github/assignments',

    // plagiarism
    detectAssignmentPlagiarism: './modules/github/plagiarism',

    // cursada: reglas, parciales, excepciones y condición
    getGradingRules: './modules/course/academic',
    updateGradingRules: './modules/course/academic',
    getAcademicConditions: './modules/course/academic',
    getMyAcademicCondition: './modules/course/academic',
    getAssessments: './modules/course/assessments',
    createAssessment: './modules/course/assessments',
    updateAssessment: './modules/course/assessments',
    archiveAssessment: './modules/course/assessments',
    gradeAssessment: './modules/course/assessments',
    importAssessmentGrades: './modules/course/assessments',
    getExceptions: './modules/course/exceptions',
    grantException: './modules/course/exceptions',
    revokeException: './modules/course/exceptions',

    // LTI 1.3 Advantage
    createLtiRegistrationToken: './modules/integrations/lti',
    registerLtiPlatform: './modules/integrations/lti',
    getLtiPlatforms: './modules/integrations/lti',
    unlinkLtiPlatform: './modules/integrations/lti',
    getLtiPlatformsForReview: './modules/integrations/lti',
    setLtiPlatformStatus: './modules/integrations/lti',
    syncLtiRoster: './modules/integrations/lti',
    publishLtiGrades: './modules/integrations/lti',

    // retención: alertas, bitácora, consultas, foro y logs de Moodle
    refreshStudentAlerts: './modules/notifications/alerts',
    getStudentAlerts: './modules/notifications/alerts',
    updateStudentAlert: './modules/notifications/alerts',
    addContactLog: './modules/notifications/alerts',
    getContactLogs: './modules/notifications/alerts',
    scheduleStudentTutoring: './modules/notifications/alerts',
    createReviewRequest: './modules/course/reviewRequests',
    getReviewRequests: './modules/course/reviewRequests',
    replyReviewRequest: './modules/course/reviewRequests',
    markCommentSolution: './modules/course/forum',
    importMoodleLogs: './modules/integrations/moodleLogs',
};

/** Devuelve el handler de la acción, o null si la acción no existe. */
function loadActionHandler(action) {
    if (!Object.prototype.hasOwnProperty.call(ACTION_MODULES, action)) return null;
    const handler = require(ACTION_MODULES[action])[action];
    return typeof handler === 'function' ? handler : undefined;
}

module.exports = { ACTION_MODULES, loadActionHandler };
