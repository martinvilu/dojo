const {
    moodleAutoEnroll,
    exportCourseToMoodleXml,
    syncMoodleCourseRoster,
    exportGradesToMoodleWebservice
} = require('../actions/moodle');

jest.mock('node-fetch');
const fetch = require('node-fetch');

describe('Moodle Integration Expanded Actions', () => {
    let mockContext;

    beforeEach(() => {
        jest.clearAllMocks();

        const mockCourseDoc = {
            exists: true,
            data: () => ({
                name: 'Algoritmos y Programación',
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

    test('moodleAutoEnroll enrolls student or teacher automatically', async () => {
        const res = await moodleAutoEnroll({ courseId: 'c123' }, mockContext);
        expect(res.success).toBe(true);
    });

    test('exportCourseToMoodleXml generates valid Moodle XML backup structure', async () => {
        const res = await exportCourseToMoodleXml({ courseId: 'c123' }, mockContext);
        expect(res.filename).toContain('moodle_backup');
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
});
