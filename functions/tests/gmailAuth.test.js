// The module resolves fetch at load time via `global.fetch || require('node-fetch')`.
// On Node 22+ the native global fetch wins, so stub it BEFORE requiring the module.
global.fetch = jest.fn();
const fetch = global.fetch;
process.env.DOJO_ENCRYPTION_KEY = '11'.repeat(32);
const { decryptSecret, CONTEXTS } = require('../src/lib/encryption');

const {
    getGmailAuthUrl,
    saveGmailAuthCode,
    getGmailAuthStatus,
    disconnectGmailAuth,
    sendGmailNotification
} = require('../src/modules/mail/gmailAuth');

describe('Gmail OAuth Actions', () => {
    let mockContext;
    let credentialsDoc;
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
        credentialsDoc = mockDoc;

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

        // Tokens are encrypted at rest and bound to the teacher's document.
        const stored = credentialsDoc.set.mock.calls[0][0];
        expect(stored.refresh_token).toMatch(/^enc:v1:/);
        expect(JSON.stringify(stored)).not.toContain('ref_123');
        expect(decryptSecret(stored.refresh_token, CONTEXTS.gmailRefreshToken('teacher123'))).toBe('ref_123');
        expect(decryptSecret(stored.access_token, CONTEXTS.gmailAccessToken('teacher123'))).toBe('acc_123');
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

    test('sendGmailNotification refreshes expired token before sending and handles errors', async () => {
        mockDocData.expires_at = Date.now() - 10000; // expired

        fetch.mockImplementation((url) => {
            if (url.includes('oauth2.googleapis.com/token')) {
                return Promise.resolve({
                    json: () => Promise.resolve({
                        access_token: 'refreshed_token_123',
                        expires_in: 3600
                    })
                });
            }
            if (url.includes('upload/gmail/v1/users/me/messages/send')) {
                return Promise.resolve({
                    json: () => Promise.resolve({ id: 'msg_refreshed' })
                });
            }
            return Promise.resolve({ json: () => Promise.resolve({}) });
        });

        const res = await sendGmailNotification({
            to: 'alumno@unrn.edu.ar',
            subject: 'Test refresh',
            htmlBody: '<p>Body</p>'
        }, mockContext);
        expect(res.messageId).toBe('msg_refreshed');
        const refreshed = credentialsDoc.update.mock.calls[0][0].access_token;
        expect(decryptSecret(refreshed, CONTEXTS.gmailAccessToken('teacher123'))).toBe('refreshed_token_123');

        // Missing parameters
        await expect(sendGmailNotification({}, mockContext)).rejects.toThrow(/requeridos/i);

        // Expired without refresh_token
        mockDocData.refresh_token = null;
        await expect(sendGmailNotification({
            to: 'a@b.com',
            subject: 's',
            htmlBody: 'b'
        }, mockContext)).rejects.toThrow(/venció/i);
    });

    test('saveGmailAuthCode rejects missing code or Google token error', async () => {
        await expect(saveGmailAuthCode({}, mockContext)).rejects.toThrow(/Código OAuth/i);

        fetch.mockResolvedValueOnce({
            json: async () => ({ error: 'invalid_grant', error_description: 'Code expired' })
        });
        await expect(saveGmailAuthCode({ code: 'bad' }, mockContext)).rejects.toThrow(/Code expired/);
    });
});

