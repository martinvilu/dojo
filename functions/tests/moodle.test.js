// The module resolves fetch at load time via `global.fetch || require('node-fetch')`.
// On Node 22+ the native global fetch wins, so stub it BEFORE requiring the module.
global.fetch = jest.fn();
const fetch = global.fetch;

const {
    moodleAutoEnroll,
    exportCourseToMoodleXml,
    syncMoodleCourseRoster,
    exportGradesToMoodleWebservice,
    syncMoodleCourseContents,
    getMoodleLtiDeepLinkContent
} = require('../src/modules/integrations/moodle');

describe('Moodle Integration Expanded Actions', () => {
    let mockContext;

    beforeEach(() => {
        jest.clearAllMocks();

        const mockCourseDoc = {
            exists: true,
            data: () => ({
                name: 'Algoritmos y Programación',
                moodle_enabled: true,
                start_date: '2026-03-01',
                duration_weeks: 16,
                class_instances: [
                    { classNumber: 1, topic: 'Introducción a Python', description: 'Conceptos básicos', presentation_url: 'https://example.com/slides.pdf' }
                ]
            })
        };

        const mockAssignmentsDocs = [
            {
                id: 'asg1',
                data: () => ({ title: 'TP1 - Funciones', description: 'Implementar funciones', due_date: '2026-04-15' })
            }
        ];

        mockContext = {
            uid: 'teacher123',
            db: {
                collection: jest.fn().mockImplementation((coll) => {
                    if (coll === 'courses') {
                        return {
                            doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockCourseDoc) })
                        };
                    }
                    if (coll === 'assignments') {
                        return {
                            where: jest.fn().mockReturnValue({
                                get: jest.fn().mockResolvedValue({ docs: mockAssignmentsDocs })
                            })
                        };
                    }
                    if (coll === 'profiles') {
                        return {
                            doc: jest.fn().mockReturnValue({
                                get: jest.fn().mockResolvedValue({
                                    exists: true,
                                    data: () => ({ role: 'teacher', full_name: 'Prof. Mario' })
                                })
                            }),
                            where: jest.fn().mockReturnValue({
                                get: jest.fn().mockResolvedValue({
                                    empty: false,
                                    docs: [{ id: 'student_uid_1' }]
                                })
                            })
                        };
                    }
                    if (coll === 'course_roster') {
                        return {
                            doc: jest.fn().mockReturnValue({
                                get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ moodle_user_id: 99 }) }),
                                set: jest.fn().mockResolvedValue(true)
                            })
                        };
                    }
                    if (coll === 'submissions') {
                        return {
                            where: jest.fn().mockReturnValue({
                                get: jest.fn().mockResolvedValue({
                                    docs: [{ id: 'sub1', data: () => ({ student_id: 'student_uid_1', grade: '9' }) }]
                                })
                            })
                        };
                    }
                    return {
                        doc: jest.fn().mockReturnValue({
                            get: jest.fn().mockResolvedValue({ exists: false }),
                            set: jest.fn().mockResolvedValue(true)
                        }),
                        add: jest.fn().mockResolvedValue({ id: 'log_123' })
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

    test('moodleAutoEnroll never grants a teacher seat from an LTI launch', async () => {
        const res = await moodleAutoEnroll({ courseId: 'c123' }, mockContext);
        expect(res.success).toBe(true);
        expect(res.status).toBe('not_assigned');
        const touchedTeachers = mockContext.db.collection.mock.calls.some(([c]) => c === 'course_teachers');
        expect(touchedTeachers).toBe(true);
    });

    test('moodleAutoEnroll leaves new students pending teacher approval', async () => {
        const rosterSet = jest.fn().mockResolvedValue(true);
        const enrollmentSet = jest.fn().mockResolvedValue(true);
        const base = mockContext.db.collection.getMockImplementation();
        mockContext.db.collection.mockImplementation((coll) => {
            if (coll === 'profiles') {
                return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ role: 'student' }) }) }) };
            }
            if (coll === 'course_roster') {
                return { doc: () => ({ get: async () => ({ exists: false }), set: rosterSet }) };
            }
            if (coll === 'enrollments') {
                return { doc: () => ({ set: enrollmentSet }) };
            }
            return base(coll);
        });

        const res = await moodleAutoEnroll({ courseId: 'c123' }, mockContext);
        expect(res.status).toBe('pending');
        expect(rosterSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', student_id: 'teacher123' }));
        expect(enrollmentSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
    });

    test('moodleAutoEnroll refuses courses without the Moodle integration', async () => {
        const base = mockContext.db.collection.getMockImplementation();
        mockContext.db.collection.mockImplementation((coll) => coll === 'courses'
            ? { doc: () => ({ get: async () => ({ exists: true, data: () => ({ name: 'Sin Moodle' }) }) }) }
            : base(coll));
        await expect(moodleAutoEnroll({ courseId: 'c123' }, mockContext)).rejects.toThrow('no está habilitada');
    });

    test('Moodle web service actions reject internal or non-HTTPS hosts', async () => {
        for (const moodleUrl of ['http://moodle.unrn.edu.ar', 'https://169.254.169.254', 'https://localhost:8443']) {
            await expect(syncMoodleCourseRoster({
                courseId: 'c1', moodleUrl, moodleToken: 't', moodleCourseId: '1'
            }, mockContext)).rejects.toThrow('HTTPS pública');
        }
        expect(fetch).not.toHaveBeenCalled();
    });

    test('exportCourseToMoodleXml generates valid Moodle MBZ backup archive matching Moodle 4.2', async () => {
        const res = await exportCourseToMoodleXml({ courseId: 'c123' }, mockContext);
        expect(res.filename).toContain('moodle_backup');
        expect(res.filename).toContain('.mbz');
        expect(typeof res.mbzBase64).toBe('string');
        expect(res.mbzBase64.length).toBeGreaterThan(100);
        expect(res.xmlContent).toContain('<moodle_backup>');
        expect(res.xmlContent).toContain('Algoritmos y Programación');
        expect(res.xmlContent).toContain('Introducción a Python');
        expect(res.xmlContent).toContain('TP1 - Funciones');
    });

    test('syncMoodleCourseRoster syncs users via Moodle REST API', async () => {
        fetch.mockImplementation(() => Promise.resolve({
            json: () => Promise.resolve([
                { id: 99, email: 'estudiante@unrn.edu.ar', fullname: 'Estudiante Prueba' }
            ])
        }));

        const res = await syncMoodleCourseRoster({
            courseId: 'c123',
            moodleUrl: 'https://moodle.unrn.edu.ar',
            moodleToken: 'valid_wstoken',
            moodleCourseId: '55'
        }, mockContext);

        expect(res.success).toBe(true);
        expect(res.syncedCount).toBe(1);
    });

    test('exportGradesToMoodleWebservice pushes grades to Moodle Gradebook', async () => {
        fetch.mockImplementation(() => Promise.resolve({
            json: () => Promise.resolve({ success: true })
        }));

        const res = await exportGradesToMoodleWebservice({
            courseId: 'c123',
            moodleUrl: 'https://moodle.unrn.edu.ar',
            moodleToken: 'valid_wstoken',
            moodleCourseId: '55',
            assignmentId: 'asg1'
        }, mockContext);

        expect(res.success).toBe(true);
        expect(res.pushedCount).toBe(1);
    });

    test('getMoodleLtiDeepLinkContent returns valid LTI 1.3 Deep Linking structure', async () => {
        const res = await getMoodleLtiDeepLinkContent({ courseId: 'c123' }, mockContext);
        expect(res.type || res['@type']).toBe('LtiDeepLinkingResponse');
        expect(Array.isArray(res.items)).toBe(true);
        expect(res.items.length).toBeGreaterThan(0);
    });
});
