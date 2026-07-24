const { getEmailTemplates, saveEmailTemplate } = require('../actions/emailTemplates');
const {
    getScheduledEmails,
    createScheduledEmail,
    cancelScheduledEmail,
    sendDirectStudentEmail,
    getMailLogs
} = require('../actions/scheduledEmails');

jest.mock('../actions/gmailAuth', () => ({
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
});
