const {
    getGmailAuthUrl,
    saveGmailAuthCode,
    getGmailAuthStatus,
    disconnectGmailAuth,
    sendGmailNotification
} = require('../actions/gmailAuth');

jest.mock('node-fetch');
const fetch = require('node-fetch');

describe('Gmail OAuth Actions', () => {
    let mockContext;
    let mockDocData;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDocData = {
            teacher_id: 'teacher123',
            email: 'docente@unrn.edu.ar',
            access_token: 'valid_access_token',
            refresh_token: 'valid_refresh_token',
            expires_at: Date.now() + 3600000
        };

        const mockDoc = {
            get: jest.fn().mockImplementation(async () => ({
                exists: true,
                data: () => mockDocData
            })),
            set: jest.fn().mockResolvedValue(true),
            update: jest.fn().mockResolvedValue(true),
            delete: jest.fn().mockResolvedValue(true)
        };

        const mockCollection = {
            doc: jest.fn().mockReturnValue(mockDoc)
        };

        mockContext = {
            uid: 'teacher123',
            db: {
                collection: jest.fn().mockReturnValue(mockCollection)
            },
            admin: {
                firestore: {
                    FieldValue: {
                        serverTimestamp: () => 'TIMESTAMP'
                    }
                }
            }
        };
    });

    test('getGmailAuthUrl generates valid OAuth authorization URL', async () => {
        const res = await getGmailAuthUrl({ redirectUri: 'http://localhost:3000/dashboard' }, mockContext);
        expect(res.authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
        expect(res.authUrl).toContain('gmail.send');
    });

    test('getGmailAuthStatus returns connected state and email', async () => {
        const res = await getGmailAuthStatus({}, mockContext);
        expect(res.connected).toBe(true);
        expect(res.email).toBe('docente@unrn.edu.ar');
    });

    test('disconnectGmailAuth deletes credentials doc', async () => {
        const res = await disconnectGmailAuth({}, mockContext);
        expect(res.success).toBe(true);
    });

    test('saveGmailAuthCode exchanges code and stores credentials', async () => {
        fetch.mockImplementation((url) => {
            if (url.includes('oauth2.googleapis.com/token')) {
                return Promise.resolve({
                    json: () => Promise.resolve({
                        access_token: 'acc_123',
                        refresh_token: 'ref_123',
                        expires_in: 3600
                    })
                });
            }
            if (url.includes('googleapis.com/oauth2/v2/userinfo')) {
                return Promise.resolve({
                    json: () => Promise.resolve({
                        email: 'profesor@gmail.com'
                    })
                });
            }
            return Promise.resolve({ json: () => Promise.resolve({}) });
        });

        const res = await saveGmailAuthCode({ code: 'valid_code', redirectUri: 'http://localhost:3000' }, mockContext);
        expect(res.success).toBe(true);
        expect(res.email).toBe('profesor@gmail.com');
    });

    test('sendGmailNotification sends email via Gmail API', async () => {
        fetch.mockImplementation((url) => {
            if (url.includes('upload/gmail/v1/users/me/messages/send')) {
                return Promise.resolve({
                    json: () => Promise.resolve({
                        id: 'msg_999'
                    })
                });
            }
            return Promise.resolve({ json: () => Promise.resolve({}) });
        });

        const res = await sendGmailNotification({
            to: 'alumno@estudiantes.unrn.edu.ar',
            subject: 'Aviso de prueba',
            htmlBody: '<p>Hola alumno</p>'
        }, mockContext);

        expect(res.success).toBe(true);
        expect(res.messageId).toBe('msg_999');
        expect(res.emailSentFrom).toBe('docente@unrn.edu.ar');
    });
});
