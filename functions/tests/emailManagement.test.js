const { getEmailTemplates, saveEmailTemplate } = require('../src/modules/mail/emailTemplates');
const {
    getScheduledEmails,
    createScheduledEmail,
    cancelScheduledEmail,
    sendDirectStudentEmail,
    getMailLogs
} = require('../src/modules/mail/scheduledEmails');

jest.mock('../src/modules/mail/gmailAuth', () => ({
    sendGmailNotification: jest.fn().mockResolvedValue({ success: true, messageId: 'msg_123' })
}));

describe('Email Templates & Scheduled Emails Actions Suite', () => {
    let mockContext;

    beforeEach(() => {
        jest.clearAllMocks();

        const mockStudentDoc = {
            exists: true,
            data: () => ({ email: 'alumno@unrn.edu.ar', full_name: 'Juan Pérez' })
        };

        const mockCourseDoc = {
            exists: true,
            data: () => ({ name: 'Algoritmos 1' })
        };

        mockContext = {
            uid: 'prof123',
            db: {
                collection: jest.fn().mockImplementation((coll) => {
                    if (coll === 'email_templates') {
                        return {
                            where: jest.fn().mockReturnValue({
                                get: jest.fn().mockResolvedValue({ docs: [] })
                            }),
                            doc: jest.fn().mockReturnValue({
                                set: jest.fn().mockResolvedValue(true)
                            })
                        };
                    }
                    if (coll === 'scheduled_emails') {
                        return {
                            where: jest.fn().mockReturnValue({
                                get: jest.fn().mockResolvedValue({
                                    docs: [
                                        { id: 'sch1', data: () => ({ subject: 'Prueba', status: 'pending' }) }
                                    ]
                                })
                            }),
                            add: jest.fn().mockResolvedValue({ id: 'sch_new' }),
                            doc: jest.fn().mockReturnValue({
                                update: jest.fn().mockResolvedValue(true)
                            })
                        };
                    }
                    if (coll === 'profiles') {
                        return {
                            doc: jest.fn().mockReturnValue({
                                get: jest.fn().mockResolvedValue(mockStudentDoc)
                            })
                        };
                    }
                    if (coll === 'courses') {
                        return {
                            doc: jest.fn().mockReturnValue({
                                get: jest.fn().mockResolvedValue(mockCourseDoc)
                            })
                        };
                    }
                    return {
                        add: jest.fn().mockResolvedValue({ id: 'log_123' }),
                        where: jest.fn().mockReturnValue({
                            get: jest.fn().mockResolvedValue({ docs: [] })
                        })
                    };
                })
            },
            admin: {
                firestore: {
                    FieldValue: { serverTimestamp: () => 'TIMESTAMP' }
                }
            }
        };
    });

    test('getEmailTemplates returns default templates when no custom ones exist', async () => {
        const templates = await getEmailTemplates({ courseId: 'c123' }, mockContext);
        expect(templates).toHaveProperty('alert_risk');
        expect(templates).toHaveProperty('direct_student');
    });

    test('saveEmailTemplate creates or updates custom template', async () => {
        const res = await saveEmailTemplate({
            courseId: 'c123',
            templateId: 'custom_alert',
            name: 'Alerta Personalizada',
            subject: 'Atención {{student_name}}',
            bodyHtml: '<p>Hola</p>'
        }, mockContext);

        expect(res.success).toBe(true);
    });

    test('getScheduledEmails returns list of scheduled emails', async () => {
        const list = await getScheduledEmails({ courseId: 'c123' }, mockContext);
        expect(Array.isArray(list)).toBe(true);
        expect(list.length).toBeGreaterThan(0);
    });

    test('createScheduledEmail creates a new scheduled email', async () => {
        const res = await createScheduledEmail({
            courseId: 'c123',
            subject: 'Aviso Próxima Clase',
            bodyHtml: '<p>Subir entrega</p>'
        }, mockContext);

        expect(res.success).toBe(true);
        expect(res.id).toBe('sch_new');
    });

    test('sendDirectStudentEmail sends direct email and logs audit entry', async () => {
        const res = await sendDirectStudentEmail({
            studentId: 'student_123',
            courseId: 'c123',
            subject: 'Consulta sobre TP',
            bodyHtml: 'Hola Juan, vi tu entrega.'
        }, mockContext);

        expect(res.success).toBe(true);
        expect(res.emailSentTo).toBe('alumno@unrn.edu.ar');
    });

    test('cancelScheduledEmail updates status to cancelled and validates emailId', async () => {
        await expect(cancelScheduledEmail({}, mockContext)).rejects.toThrow(/ID de correo/i);
        const res = await cancelScheduledEmail({ emailId: 'sch1' }, mockContext);
        expect(res.success).toBe(true);
    });

    test('triggerScheduledEmailNow sends to single_student and all_students and handles send errors', async () => {
        const { triggerScheduledEmailNow } = require('../src/modules/mail/scheduledEmails');
        const { sendGmailNotification } = require('../src/modules/mail/gmailAuth');

        await expect(triggerScheduledEmailNow({}, mockContext)).rejects.toThrow(/requeridos/i);

        let emailDoc = {
            exists: true,
            data: () => ({
                title: 'Aviso',
                recipient_type: 'single_student',
                target_student_id: 'stu1',
                subject: 'Hola {{student_name}}',
                body_html: '<p>{{student_name}} ({{student_email}})</p>',
                status: 'pending'
            })
        };

        mockContext.db.collection = jest.fn((coll) => {
            if (coll === 'scheduled_emails') {
                return {
                    doc: () => ({
                        get: async () => emailDoc,
                        update: jest.fn().mockResolvedValue(true)
                    })
                };
            }
            if (coll === 'profiles') {
                return {
                    doc: (id) => ({
                        get: async () => ({
                            exists: true,
                            data: () => ({ email: `${id}@unrn.edu.ar`, full_name: `Estudiante ${id}` })
                        })
                    })
                };
            }
            if (coll === 'course_roster') {
                return {
                    where: () => ({
                        get: async () => ({
                            docs: [
                                { data: () => ({ student_id: 'stu1' }) },
                                { data: () => ({ student_id: 'stu2' }) }
                            ]
                        })
                    })
                };
            }
            return { add: jest.fn().mockResolvedValue({ id: 'log1' }) };
        });

        const singleRes = await triggerScheduledEmailNow({ emailId: 'sch1', courseId: 'c123' }, mockContext);
        expect(singleRes).toEqual({ success: true, sentCount: 1, failedCount: 0 });

        // Test all_students with one failure
        emailDoc = {
            exists: true,
            data: () => ({
                title: 'General',
                recipient_type: 'all_students',
                subject: 'General {{student_name}}',
                body_html: '<p>General</p>',
                status: 'pending'
            })
        };
        sendGmailNotification
            .mockResolvedValueOnce({ success: true })
            .mockRejectedValueOnce(new Error('SMTP quota'));

        const allRes = await triggerScheduledEmailNow({ emailId: 'sch2', courseId: 'c123' }, mockContext);
        expect(allRes).toEqual({ success: true, sentCount: 1, failedCount: 1 });

        // Cancelled email throws
        emailDoc = { exists: true, data: () => ({ status: 'cancelled' }) };
        await expect(triggerScheduledEmailNow({ emailId: 'sch3', courseId: 'c123' }, mockContext)).rejects.toThrow(/cancelado/i);
    });

    test('getMailLogs returns sorted mail logs for a course', async () => {
        mockContext.db.collection = jest.fn(() => ({
            where: () => ({
                get: async () => ({
                    docs: [
                        { id: 'l1', data: () => ({ sent_at: 100 }) },
                        { id: 'l2', data: () => ({ sent_at: 200 }) }
                    ]
                })
            })
        }));

        const logs = await getMailLogs({ courseId: 'c123' }, mockContext);
        expect(logs.map(l => l.id)).toEqual(['l2', 'l1']);
    });
});

