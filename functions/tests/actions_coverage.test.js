global.fetch = jest.fn();
const adminActions = require('../src/modules/course/admin');
const announcementActions = require('../src/modules/course/announcements');
const assignmentActions = require('../src/modules/github/assignments');
const attendanceActions = require('../src/modules/attendance/attendance');
const backupActions = require('../src/modules/system/backups');
const courseActions = require('../src/modules/course/courses');
const moodleActions = require('../src/modules/integrations/moodle');
const notificationActions = require('../src/modules/notifications/notifications');
const profileActions = require('../src/modules/auth/profile');
const scheduleActions = require('../src/modules/course/schedule');
const statsActions = require('../src/modules/course/stats');
const studyGroupActions = require('../src/modules/study_groups/studyGroups');
const tutoringActions = require('../src/modules/tutoring/tutoring');

describe('Full Coverage Actions Test Suite', () => {

  const createMockContext = (overrides = {}) => {
    const docStore = {};
    
    const getDocMock = jest.fn().mockImplementation((path) => {
      if (docStore[path]) {
        return Promise.resolve({
          exists: true,
          id: path.split('/').pop(),
          data: () => docStore[path],
          ref: {
            delete: jest.fn().mockResolvedValue(true),
            update: jest.fn().mockImplementation((data) => {
              docStore[path] = { ...docStore[path], ...data };
              return Promise.resolve(true);
            })
          }
        });
      }
      return Promise.resolve({
        exists: false,
        id: path.split('/').pop(),
        data: () => undefined
      });
    });

    const setDocMock = jest.fn().mockImplementation((path, data, options) => {
      docStore[path] = options && options.merge ? { ...docStore[path], ...data } : data;
      return Promise.resolve(true);
    });

    const updateDocMock = jest.fn().mockImplementation((path, data) => {
      docStore[path] = { ...docStore[path], ...data };
      return Promise.resolve(true);
    });

    const deleteDocMock = jest.fn().mockImplementation((path) => {
      delete docStore[path];
      return Promise.resolve(true);
    });

    const createRef = (path) => ({
      get: () => getDocMock(path),
      set: (data, opts) => setDocMock(path, data, opts),
      create: (data) => (docStore[path] ? Promise.reject(Object.assign(new Error('exists'), { code: 6 })) : setDocMock(path, data)),
      update: (data) => updateDocMock(path, data),
      delete: () => deleteDocMock(path),
      collection: (subName) => createCollectionRef(`${path}/${subName}`)
    });

    const createCollectionRef = (collName) => {
      const queryObj = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockImplementation(() => {
          const matchingDocs = Object.keys(docStore)
            .filter((p) => p.startsWith(`${collName}/`) && p.split('/').length === collName.split('/').length + 1)
            .map((p) => ({
              id: p.split('/').pop(),
              exists: true,
              data: () => docStore[p],
              ref: { delete: jest.fn().mockResolvedValue(true) }
            }));
          return Promise.resolve({
            docs: matchingDocs,
            empty: matchingDocs.length === 0,
            size: matchingDocs.length,
            forEach: (cb) => matchingDocs.forEach(cb)
          });
        }),
        add: jest.fn().mockImplementation((data) => {
          const id = `auto_${Math.random().toString(36).substring(7)}`;
          const path = `${collName}/${id}`;
          docStore[path] = data;
          return Promise.resolve({ id, path, get: () => getDocMock(path) });
        }),
        doc: (id) => createRef(`${collName}/${id}`)
      };
      return queryObj;
    };

    const batchMock = {
      set: jest.fn(),
      update: jest.fn().mockImplementation((ref, data) => {
        if (ref && ref.path && docStore[ref.path]) {
          docStore[ref.path] = { ...docStore[ref.path], ...data };
        }
      }),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(true)
    };

    const mockAdmin = {
      firestore: {
        FieldValue: {
          serverTimestamp: () => ({ toDate: () => new Date() })
        }
      },
      auth: () => ({
        deleteUser: jest.fn().mockResolvedValue(true)
      })
    };

    const myProfile = overrides.myProfile || { role: 'admin', full_name: 'Admin User', email: 'admin@test.com' };

    return {
      uid: overrides.uid || 'user123',
      db: {
        collection: createCollectionRef,
        batch: () => batchMock
      },
      admin: mockAdmin,
      getMyProfile: jest.fn().mockResolvedValue(myProfile),
      docStore
    };
  };

  // 1. ADMIN ACTIONS
  describe('Admin Actions', () => {
    test('approveUser & updateUserRole & updateUserProfile', async () => {
      const ctx = createMockContext();
      await adminActions.approveUser({ targetUid: 'u1' }, ctx);
      await adminActions.updateUserRole({ targetUid: 'u1', newRole: 'teacher' }, ctx);
      await adminActions.updateUserProfile({ userId: 'u1', data: { cohorte: '2025' } }, ctx);
      
      expect(ctx.docStore['profiles/u1']).toEqual({
        account_status: 'approved',
        role: 'teacher',
        cohorte: '2025'
      });

      await expect(adminActions.updateUserRole({ targetUid: 'u1', newRole: 'invalid' }, ctx))
        .rejects.toThrow('Rol inválido');

      const nonAdminCtx = createMockContext({ myProfile: { role: 'student' } });
      await expect(adminActions.approveUser({ targetUid: 'u1' }, nonAdminCtx)).rejects.toThrow();
      await expect(adminActions.updateUserRole({ targetUid: 'u1', newRole: 'admin' }, nonAdminCtx)).rejects.toThrow();
    });

    test('getAdminUsers & getAdminCourses & getAdminCourseDetails', async () => {
      const ctx = createMockContext();
      ctx.docStore['profiles/u1'] = { full_name: 'Alice' };
      ctx.docStore['courses/c1'] = { name: 'Course 1', created_at: new Date() };
      ctx.docStore['course_teachers/t1'] = { course_id: 'c1', teacher_id: 'u1' };
      ctx.docStore['course_roster/r1'] = { course_id: 'c1', student_id: 'u1' };
      ctx.docStore['assignments/a1'] = { course_id: 'c1', title: 'Task 1' };

      const users = await adminActions.getAdminUsers({}, ctx);
      expect(users.length).toBe(1);

      const courses = await adminActions.getAdminCourses({}, ctx);
      expect(courses.length).toBe(1);

      const details = await adminActions.getAdminCourseDetails({ courseId: 'c1' }, ctx);
      expect(details.id).toBe('c1');
      expect(details.teachers.length).toBe(1);

      await expect(adminActions.getAdminCourseDetails({ courseId: 'nonexistent' }, ctx)).rejects.toThrow('Course not found');
    });

    test('getGlobalSettings & saveGlobalSettings & deleteUser', async () => {
      const ctx = createMockContext();
      await adminActions.saveGlobalSettings({ key: 'val' }, ctx);
      const settings = await adminActions.getGlobalSettings({}, ctx);
      expect(settings.key).toBe('val');

      ctx.docStore['profiles/u2'] = { full_name: 'Bob' };
      await adminActions.deleteUser({ targetUid: 'u2' }, ctx);
      expect(ctx.docStore['profiles/u2']).toBeUndefined();
    });
  });

  // 2. ANNOUNCEMENTS ACTIONS
  describe('Announcements Actions', () => {
    test('createAnnouncement, getTeacherAnnouncements, getStudentAnnouncements, acknowledgeAnnouncement', async () => {
      const ctx = createMockContext({ uid: 'teacher1' });
      await announcementActions.createAnnouncement({ course_id: 'c1', message: 'Hello' }, ctx);
      
      const announcements = await announcementActions.getTeacherAnnouncements({}, ctx);
      expect(announcements.length).toBe(1);

      ctx.docStore['announcements/a1'] = { course_id: 'c1', message: 'Hi', created_at: { toMillis: () => 1000 } };
      
      const studentCtx = createMockContext({ uid: 'student1' });
      studentCtx.docStore['announcements/a1'] = { course_id: 'c1', message: 'Hi', created_at: { toMillis: () => 1000 } };

      const studentAnn = await announcementActions.getStudentAnnouncements({ courseIds: ['c1'] }, studentCtx);
      expect(studentAnn.length).toBeGreaterThan(0);

      await announcementActions.acknowledgeAnnouncement({ announcementId: 'a1' }, studentCtx);

      const emptyAnn = await announcementActions.getStudentAnnouncements({ courseIds: [] }, studentCtx);
      expect(emptyAnn).toEqual([]);

      const acks = await announcementActions.getAnnouncementAcknowledgements({ announcementId: 'a1' }, ctx);
      expect(acks.length).toBeDefined();
    });
  });

  // 3. ATTENDANCE ACTIONS
  describe('Attendance Actions', () => {
    test('submitQrAttendance validates enrollment, rotating code and geofence', async () => {
      const { codeForCounter, counterAt } = require('../src/lib/totp');
      const SECRET = 'ab'.repeat(20);
      const nowCode = () => codeForCounter(SECRET, counterAt(Date.now()));
      const session = (extra = {}) => ({
        secret: SECRET, classNumber: 1, lat: -41.133, lng: -71.310,
        expires_at: new Date(Date.now() + 60000), ...extra
      });

      const ctx = createMockContext({ uid: 'student1', myProfile: { role: 'student' } });
      await expect(attendanceActions.submitQrAttendance({}, ctx)).rejects.toThrow('Faltan datos');

      const teacherCtx = createMockContext({ uid: 'teacher1' });
      teacherCtx.docStore['profiles/teacher1'] = { role: 'teacher' };
      teacherCtx.docStore['courses/c1/active_qr/current'] = session();
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: nowCode() }, teacherCtx))
        .rejects.toThrow('Solo los estudiantes pueden firmar asistencia');

      ctx.docStore['profiles/student1'] = { role: 'student' };
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: 'ABCDEF' }, ctx))
        .rejects.toThrow('No estás inscripto');

      ctx.docStore['course_roster/c1_student1'] = { course_id: 'c1', student_id: 'student1', status: 'approved' };
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: 'ABCDEF' }, ctx))
        .rejects.toThrow('No hay un código de asistencia activo');

      ctx.docStore['courses/c1/active_qr/current'] = session({ expires_at: new Date(Date.now() - 1000) });
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: nowCode() }, ctx))
        .rejects.toThrow('No hay un código de asistencia activo');

      ctx.docStore['courses/c1/active_qr/current'] = session();
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: 'WRONG1' }, ctx))
        .rejects.toThrow('venció o no es válido');
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 2, token: nowCode() }, ctx))
        .rejects.toThrow('clase diferente');

      // A code from three rotations ago (45 s) is no longer accepted.
      const stale = codeForCounter(SECRET, counterAt(Date.now()) - 3);
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: stale, lat: -41.1331, lng: -71.3101 }, ctx))
        .rejects.toThrow('venció o no es válido');

      // With a geofence, omitting the location no longer skips the check.
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: nowCode() }, ctx))
        .rejects.toThrow('Necesitamos tu ubicación');
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: nowCode(), lat: -40.0, lng: -70.0 }, ctx))
        .rejects.toThrow('Estás demasiado lejos');

      const res = await attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: nowCode().toLowerCase(), lat: -41.1331, lng: -71.3101 }, ctx);
      expect(res).toEqual({ success: true, alreadyPresent: false });
      expect(ctx.docStore['courses/c1/attendance/class_1'].records.student1).toBe('present');

      ctx.docStore['courses/c1/attendance/class_1'] = { records: { student1: 'present' } };
      const again = await attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: nowCode(), lat: -41.1331, lng: -71.3101 }, ctx);
      expect(again.alreadyPresent).toBe(true);
    });

    test('startQrSession keeps the secret server-side and getQrSessionCode rotates it', async () => {
      const ctx = createMockContext({ uid: 'teacher1' });
      const started = await attendanceActions.startQrSession({ courseId: 'c1', classNumber: 3, lat: -41.1, lng: -71.3 }, ctx);
      expect(started.code).toMatch(/^[A-Z2-9]{6}$/);
      expect(started).not.toHaveProperty('secret');
      expect(started.geofence).toBe(true);
      expect(ctx.docStore['courses/c1/active_qr/current'].secret).toMatch(/^[0-9a-f]{40}$/);

      const current = await attendanceActions.getQrSessionCode({ courseId: 'c1' }, ctx);
      expect(current).toMatchObject({ active: true, classNumber: 3 });
      expect(current).not.toHaveProperty('secret');

      await attendanceActions.stopQrSession({ courseId: 'c1' }, ctx);
      expect(await attendanceActions.getQrSessionCode({ courseId: 'c1' }, ctx)).toEqual({ active: false });
      await expect(attendanceActions.startQrSession({ courseId: 'c1', classNumber: -1 }, ctx)).rejects.toThrow('Número de clase inválido');
    });
  });

  // 4. BACKUP ACTIONS
  describe('Backup Actions', () => {
    test('createSystemBackup, getSystemBackups, restoreBackupDocument, downloadSystemBackup', async () => {
      const ctx = createMockContext();
      const createRes = await backupActions.createSystemBackup({}, ctx);
      expect(createRes.success).toBe(true);

      const backupId = createRes.backupId;
      ctx.docStore[`backups/${backupId}`] = {
        courses: [{ id: 'c1', name: 'Course 1' }],
        created_at: { toDate: () => new Date() },
        created_by_name: 'Admin'
      };

      const list = await backupActions.getSystemBackups({}, ctx);
      expect(list.length).toBeGreaterThan(0);

      const downloaded = await backupActions.downloadSystemBackup({ backupId }, ctx);
      expect(downloaded.courses.length).toBe(1);

      const restoreRes = await backupActions.restoreBackupDocument({ backupId, collectionName: 'courses', docId: 'c1' }, ctx);
      expect(restoreRes.success).toBe(true);

      await expect(backupActions.restoreBackupDocument({ backupId: 'invalid', collectionName: 'courses', docId: 'c1' }, ctx))
        .rejects.toThrow('Respaldo no encontrado');
      await expect(backupActions.restoreBackupDocument({ backupId, collectionName: 'unknown_coll', docId: 'c1' }, ctx))
        .rejects.toThrow('no disponible');
      await expect(backupActions.restoreBackupDocument({ backupId, collectionName: 'courses', docId: 'missing_doc' }, ctx))
        .rejects.toThrow('no encontrado en este respaldo');
      await expect(backupActions.downloadSystemBackup({ backupId: 'invalid' }, ctx))
        .rejects.toThrow('Respaldo no encontrado');

      await expect(backupActions.deleteBackup({}, ctx)).rejects.toThrow('ID de respaldo requerido');
      const delRes = await backupActions.deleteBackup({ backupId }, ctx);
      expect(delRes.success).toBe(true);

      const nonAdminCtx = createMockContext({ myProfile: { role: 'student' } });
      await expect(backupActions.createSystemBackup({}, nonAdminCtx)).rejects.toThrow();
      await expect(backupActions.downloadSystemBackup({ backupId }, nonAdminCtx)).rejects.toThrow();
      await expect(backupActions.deleteBackup({ backupId }, nonAdminCtx)).rejects.toThrow();
    });
  });

  // 5. PROFILE & NOTIFICATIONS & STATS & OTHER MODULES
  describe('Profile, Notifications, Stats, Tutoring, StudyGroups, Schedule, Moodle Actions', () => {
    test('profileActions: getProfile creation, seeds, addSecondaryEmail, mergeProfiles', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.admin.firestore.Timestamp = { now: () => 'NOW_TS' };

      // New user creation with SEED_ADMIN_EMAILS
      process.env.SEED_ADMIN_EMAILS = 'admin@unrn.edu.ar,teacher@unrn.edu.ar';
      process.env.SEED_TEACHER_EMAILS = 'teacher@unrn.edu.ar';
      ctx.authUser = { email: 'teacher@unrn.edu.ar', name: 'Profe Seed' };
      const createdProf = await profileActions.getProfile({}, ctx);
      expect(createdProf.role).toBe('teacher');
      expect(createdProf.account_status).toBe('approved');
      delete process.env.SEED_ADMIN_EMAILS;
      delete process.env.SEED_TEACHER_EMAILS;

      // Existing user getProfile updates last_login
      const p = await profileActions.getProfile({}, ctx);
      expect(p.full_name).toBe('Profe Seed');

      await profileActions.updateProfile({
        full_name: 'Updated Name',
        github_username: 'devuser',
        github_user: 'dev',
        matricula_unrn: 'UNRN-11111',
        cohort: '2026'
      }, ctx);
      expect(ctx.docStore['profiles/u1'].github_user).toBe('dev');

      await expect(profileActions.submitMatricula({ matricula: 'INVALID' }, ctx)).rejects.toThrow();
      await profileActions.submitMatricula({ matricula: 'UNRN-123456' }, ctx);
      expect(ctx.docStore['profiles/u1'].matricula_unrn).toBe('UNRN-123456');

      // addSecondaryEmail
      await expect(profileActions.addSecondaryEmail({ email: 'bad' }, ctx)).rejects.toThrow('Email secundario inválido');
      const secRes = await profileActions.addSecondaryEmail({ email: ' Alt@Gmail.com ' }, ctx);
      expect(secRes.secondary_emails).toContain('alt@gmail.com');

      // mergeProfiles
      ctx.docStore['profiles/source_u'] = {
        email: 'source@unrn.edu.ar',
        secondary_emails: ['extra@unrn.edu.ar'],
        github_user: 'sourcegh'
      };
      ctx.docStore['course_roster/c1_source_u'] = { course_id: 'c1', student_id: 'source_u', status: 'approved' };

      await expect(profileActions.mergeProfiles({ targetUid: 'u1', sourceUid: 'u1' }, ctx)).rejects.toThrow('inválidos');
      await expect(profileActions.mergeProfiles({ targetUid: 'u1', sourceUid: 'nonexistent' }, ctx)).rejects.toThrow('no existen');

      const mergeRes = await profileActions.mergeProfiles({ targetUid: 'u1', sourceUid: 'source_u' }, ctx);
      expect(mergeRes.success).toBe(true);
      expect(ctx.docStore['profiles/u1'].secondary_emails).toEqual(
        expect.arrayContaining(['alt@gmail.com', 'source@unrn.edu.ar', 'extra@unrn.edu.ar'])
      );
      expect(ctx.docStore['course_roster/c1_u1'].student_id).toBe('u1');

    });

    test('notificationActions: notifyCourseStudents, checkAndAlertStudentsAtRisk, sendDailySummaries', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['notifications/n1'] = {
        student_id: 'u1',
        read: false,
        created_at: { toDate: () => new Date() }
      };
      
      const list = await notificationActions.getStudentNotifications({}, ctx);
      expect(list.length).toBe(1);

      const res = await notificationActions.markNotificationsRead({ notificationIds: ['n1'] }, ctx);
      expect(res.success).toBe(true);

      // notifyCourseStudents
      await expect(notificationActions.notifyCourseStudents({ courseId: 'c1', message: 'Hi' }, ctx))
        .rejects.toThrow('No tienes acceso');

      ctx.docStore['course_teachers/c1_u1'] = { course_id: 'c1', teacher_id: 'u1' };
      ctx.docStore['course_roster/c1_s1'] = { course_id: 'c1', student_id: 's1' };
      ctx.docStore['profiles/s1'] = { notification_pref: 'daily_summary' };

      const notifyRes = await notificationActions.notifyCourseStudents({
        courseId: 'c1',
        message: 'Nueva clase publicada',
        link: '/dashboard/courses/c1'
      }, ctx);
      expect(notifyRes.success).toBe(true);

      // checkAndAlertStudentsAtRisk
      ctx.docStore['courses/c1'] = {
        name: 'Algoritmos',
        class_instances: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
      };
      // Un TP vencido sin entregar y asistencia baja: el motor de alertas lo detecta.
      ctx.docStore['assignments/a1'] = { course_id: 'c1', title: 'TP1', due_date: '2026-03-01' };
      ctx.docStore['assignments/a2'] = { course_id: 'c1', title: 'TP2' };
      for (const n of [1, 2, 3]) {
        ctx.docStore[`courses/c1/attendance/class_${n}`] = { classNumber: n, records: { s1: 'absent', s2: 'present' } };
      }
      ctx.docStore['notifications/existing'] = { student_id: 's1', message: 'Bienvenido' };

      const riskRes = await notificationActions.checkAndAlertStudentsAtRisk({ courseId: 'c1' }, ctx);
      expect(riskRes.success).toBe(true);
      expect(riskRes.alertsTriggeredCount).toBe(1);
      expect(ctx.docStore['student_alerts/c1_s1_overdue_tps']).toMatchObject({ status: 'active', type: 'overdue_tps' });
      expect(ctx.docStore['student_alerts/c1_s1_attendance_critical'].message).toContain('0%');
    });

    test('statsActions with submissions and on-time calculation', async () => {
      const ctx = createMockContext({ uid: 't1' });
      ctx.docStore['course_teachers/c1_t1'] = { teacher_id: 't1', course_id: 'c1' };
      ctx.docStore['courses/c1'] = { name: 'Course 1', class_instances: [{ id: 'cl1' }] };
      ctx.docStore['enrollments/e1'] = { course_id: 'c1', student_id: 's1' };
      ctx.docStore['assignments/a1'] = { course_id: 'c1', title: 'Task 1', due_date: '2026-05-10T00:00:00Z' };
      ctx.docStore['submissions/sub1'] = {
        assignment_id: 'a1',
        student_id: 's1',
        grade: '',
        submitted_at: { toDate: () => new Date('2026-05-01T00:00:00Z') }
      };

      const stats = await statsActions.getTeacherDashboardStats({}, ctx);
      expect(stats.pendingCorrections).toBe(1);

      const courseStats = await statsActions.getCourseDashboardStats({ courseId: 'c1' }, ctx);
      expect(courseStats.name).toBe('Course 1');
      expect(courseStats.onTimeSubmissions).toBe(1);
      expect(courseStats.pendingCorrections).toBe(1);
    });

    test('scheduleActions', async () => {
      const ctx = createMockContext({ uid: 't1' });
      ctx.docStore['course_teachers/c1_t1'] = { teacher_id: 't1', role: 'titular' };
      ctx.docStore['profiles/t1'] = { full_name: 'Teacher 1' };
      ctx.docStore['courses/c1'] = { name: 'Course 1' };
      
      const saveRes = await scheduleActions.saveScheduleVersion({ courseId: 'c1', title: 'v1', classInstances: [] }, ctx);
      expect(saveRes.success).toBe(true);

      const list = await scheduleActions.getScheduleVersions({ courseId: 'c1' }, ctx);
      expect(list.length).toBe(1);

      ctx.docStore[`schedule_versions/${list[0].id}`] = { class_instances: [] };

      const restoreRes = await scheduleActions.restoreScheduleVersion({ courseId: 'c1', versionId: list[0].id }, ctx);
      expect(restoreRes.success).toBe(true);

      const comp = await scheduleActions.getComparisonCourses({}, ctx);
      expect(comp.length).toBe(1);
    });

    test('tutoringActions', async () => {
      const ctx = createMockContext({ uid: 't1' });
      ctx.docStore['profiles/t1'] = { full_name: 'Tutor 1' };

      await tutoringActions.registerAsTutor({ courseId: 'c1', bio: 'Bio' }, ctx);
      const tutors = await tutoringActions.getCourseTutors({ courseId: 'c1' }, ctx);
      expect(tutors.length).toBe(1);

      const bookRes = await tutoringActions.bookTutoringSession({ courseId: 'c1', tutorId: 't1', datetime: '2025-01-01' }, ctx);
      expect(bookRes.success).toBe(true);

      const sessions = await tutoringActions.getTutoringSessions({ courseId: 'c1' }, ctx);
      expect(sessions.length).toBe(1);

      await tutoringActions.updateTutoringSessionStatus({ sessionId: sessions[0].id, status: 'confirmed' }, ctx);
      expect(ctx.docStore[`tutoring_sessions/${sessions[0].id}`].status).toBe('confirmed');
    });

    test('studyGroupActions: create, join, leave, findStudyBuddies, chatLinks, messages', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.admin.firestore.FieldValue.arrayUnion = (val) => ['u1', val];
      ctx.docStore['profiles/u1'] = { full_name: 'User 1', schedule_pref: 'nocturno' };
      ctx.docStore['profiles/u2'] = { full_name: 'User 2', email: 'u2@unrn.edu.ar', role: 'student', schedule_pref: 'nocturno' };
      ctx.docStore['course_roster/r1'] = { course_id: 'c1', student_id: 'u1' };
      ctx.docStore['course_roster/r2'] = { course_id: 'c1', student_id: 'u2' };

      const createRes = await studyGroupActions.createStudyGroup({ courseId: 'c1', name: 'Group 1' }, ctx);
      expect(createRes.success).toBe(true);

      ctx.docStore['study_groups/g1'] = {
        course_id: 'c1',
        name: 'Group 1',
        members: ['u1', 'u2'],
        created_at: { toDate: () => new Date() }
      };

      const groups = await studyGroupActions.getStudyGroups({ courseId: 'c1' }, ctx);
      expect(groups.length).toBeGreaterThan(0);

      // Join as non-member
      const u3Ctx = createMockContext({ uid: 'u3' });
      u3Ctx.admin.firestore.FieldValue.arrayUnion = (val) => ['u1', 'u2', val];
      u3Ctx.docStore['study_groups/g1'] = { course_id: 'c1', members: ['u1', 'u2'] };
      await studyGroupActions.joinStudyGroup({ groupId: 'g1' }, u3Ctx);

      // findStudyBuddies
      const buddies = await studyGroupActions.findStudyBuddies({ courseId: 'c1', schedulePrefs: 'nocturno' }, ctx);
      expect(buddies).toHaveLength(1);
      expect(buddies[0].id).toBe('u2');

      // updateStudyGroupChatLinks
      await studyGroupActions.updateStudyGroupChatLinks({
        groupId: 'g1',
        whatsappUrl: 'https://chat.whatsapp.com/abc',
        telegramUrl: 'https://t.me/abc',
        discordUrl: 'https://discord.gg/abc'
      }, ctx);
      expect(ctx.docStore['study_groups/g1'].whatsapp_url).toBe('https://chat.whatsapp.com/abc');

      // postStudyGroupMessage & getStudyGroupMessages
      await expect(studyGroupActions.postStudyGroupMessage({ groupId: 'g1', content: '   ' }, ctx))
        .rejects.toThrow('vacío');
      const msgRes = await studyGroupActions.postStudyGroupMessage({ groupId: 'g1', content: 'Hola equipo' }, ctx);
      expect(msgRes.success).toBe(true);

      const msgs = await studyGroupActions.getStudyGroupMessages({ groupId: 'g1' }, ctx);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].content).toBe('Hola equipo');

      // Leave when another member remains (updates members instead of deleting)
      await studyGroupActions.leaveStudyGroup({ groupId: 'g1' }, ctx);
      expect(ctx.docStore['study_groups/g1'].members).toEqual(['u2']);
    });

    test('moodleActions', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['profiles/u1'] = { full_name: 'User 1' };
      ctx.docStore['courses/c1'] = { name: 'Course 1', moodle_enabled: true };
      const res = await moodleActions.moodleAutoEnroll({ courseId: 'c1' }, ctx);
      expect(res.success).toBe(true);
      expect(res.status).toBe('pending');
    });

    test('courseActions: enroll codes, cloneCourseExtraData, updateRosterStudentStatus, syncGuaraniRoster, deleteCourse', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['courses/c1'] = {
        name: 'Course 1',
        invite_code: 'CODE123',
        teacher_invite_code: 'T-CODE',
        assistant_invite_code: 'A-CODE',
        class_instances: [{ id: 'ci1' }]
      };
      ctx.docStore['course_teachers/c1_u1'] = { course_id: 'c1', teacher_id: 'u1' };
      ctx.docStore['course_roster/c1_u1'] = { course_id: 'c1', student_id: 'u1' };
      ctx.docStore['profiles/u1'] = { full_name: 'User 1', email: 'u1@unrn.edu.ar' };

      const cDetails = await courseActions.getCourseDetails({ courseId: 'c1' }, ctx);
      expect(cDetails.id).toBe('c1');

      // Student view of getCourseDetails
      const stuCtx = createMockContext({ uid: 'stu_only', myProfile: { role: 'student' } });
      stuCtx.docStore['courses/c1'] = { name: 'Course 1', sync_secret: 'SECRET' };
      stuCtx.docStore['course_roster/c1_stu_only'] = { course_id: 'c1', student_id: 'stu_only' };
      const stuDetails = await courseActions.getCourseDetails({ courseId: 'c1' }, stuCtx);
      expect(stuDetails.sync_secret).toBeUndefined();
      expect(stuDetails.calendar_secret).toBeDefined();

      const createC = await courseActions.createCourse({ name: 'Course 2', github_org: 'org' }, ctx);
      expect(createC).toBeDefined();

      await courseActions.updateCourseName({ courseId: 'c1', name: 'New Name' }, ctx);
      expect(ctx.docStore['courses/c1'].name).toBe('New Name');

      const teachers = await courseActions.getCourseTeachers({ courseId: 'c1' }, ctx);
      expect(teachers.length).toBe(1);

      await courseActions.assignTeacher({ courseId: 'c1', teacherId: 'u2' }, ctx);
      await courseActions.removeTeacher({ courseId: 'c1', teacherId: 'u2' }, ctx);

      const tCourses = await courseActions.getTeacherCourses({}, ctx);
      expect(tCourses.length).toBeDefined();

      const sCourses = await courseActions.getStudentCourses({}, ctx);
      expect(sCourses.length).toBeDefined();

      const cSettings = await courseActions.getCourseSettings({ courseId: 'c1' }, ctx);
      expect(cSettings).toBeDefined();

      // updateCourseSettings with class_instances creates schedule_version
      await courseActions.updateCourseSettings({ courseId: 'c1', data: { class_instances: [{ id: 'ci1' }] } }, ctx);
      const roster = await courseActions.getCourseRoster({ courseId: 'c1' }, ctx);
      expect(roster.length).toBe(1);

      // enrollCourse with student code and invalid code on empty context
      await courseActions.enrollCourse({ code: 'CODE123' }, ctx);
      const emptyCtx = createMockContext({ uid: 'u1' });
      await expect(courseActions.enrollCourse({ code: 'INVALID_CODE' }, emptyCtx)).rejects.toThrow('Código de invitación inválido');

      // cloneCourseExtraData
      ctx.docStore['assignments/a_clone'] = { course_id: 'c1', title: 'Clone Me' };
      ctx.docStore['courses/c2'] = { name: 'Cloned Course' };
      const cloneRes = await courseActions.cloneCourseExtraData({ courseId: 'c1', newCourseId: 'c2' }, ctx);
      expect(cloneRes.success).toBe(true);

      // updateRosterStudentStatus (approved & removed)
      await courseActions.updateRosterStudentStatus({ courseId: 'c1', studentId: 's_new', status: 'approved' }, ctx);
      expect(ctx.docStore['course_roster/c1_s_new'].status).toBe('approved');
      await courseActions.updateRosterStudentStatus({ courseId: 'c1', studentId: 's_new', status: 'removed' }, ctx);
      expect(ctx.docStore['course_roster/c1_s_new']).toBeUndefined();

      // syncGuaraniRoster: existing matched + unmatched marked as observador
      ctx.docStore['course_roster/c1_prev_unmatched'] = { course_id: 'c1', student_id: 'prev_unmatched', status: 'approved' };
      ctx.docStore['enrollments/prev_unmatched_c1'] = { course_id: 'c1', student_id: 'prev_unmatched', status: 'approved' };
      const guaraniRes = await courseActions.syncGuaraniRoster({
        courseId: 'c1',
        rows: [
          { legajo: 'UNRN-99999', alumno: 'Nuevo Alumno', email: 'u1@unrn.edu.ar' }
        ]
      }, ctx);
      expect(guaraniRes.success).toBe(true);
      expect(ctx.docStore['course_roster/c1_prev_unmatched'].status).toBe('observador');

      // syncGuaraniRoster on empty profiles creates placeholder profile
      const emptyProfCtx = createMockContext({ uid: 'u1' });
      await courseActions.syncGuaraniRoster({
        courseId: 'c1',
        rows: [
          { legajo: 'UNRN-55555', alumno: 'Alumno Placeholder', email: 'placeholder@unrn.edu.ar' },
          { legajo: '', alumno: '', email: '' }
        ]
      }, emptyProfCtx);

      // deleteCourse
      await courseActions.deleteCourse({ courseId: 'c2' }, ctx);
      expect(ctx.docStore['courses/c2']).toBeUndefined();
    });

    test('assignmentActions: create, update, grade, toggleAccess, massToggleAccess, submitAssignment, archive, activity, commits, spreadsheet', async () => {
      global.fetch.mockImplementation(async (url) => {
        if (String(url).includes('spreadsheets')) {
          return {
            ok: true,
            text: async () => 'Matricula,Nota,Feedback\nUNRN-12345,9,Excelente\nUNRN-99999,99,Nota invalida'
          };
        }
        if (String(url).includes('/commits')) {
          return {
            ok: true,
            json: async () => [
              {
                sha: '1234567890abcdef',
                html_url: 'https://github.com/org/repo/commit/123',
                commit: { message: 'Initial commit', author: { name: 'Dev', date: '2026-04-01T10:00:00Z' } },
                author: { login: 'user1', avatar_url: 'https://example.com/a.png' }
              }
            ]
          };
        }
        if (String(url).includes('/pulls') || String(url).includes('/comments')) {
          return { ok: true, json: async () => [] };
        }
        return { ok: true, json: async () => ({ object: { sha: 'abc' } }), text: async () => '' };
      });

      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['courses/c1'] = { name: 'Course 1', github_token: 'token123', github_org: 'org123' };
      ctx.docStore['course_teachers/c1_u1'] = { course_id: 'c1', teacher_id: 'u1' };
      ctx.docStore['assignments/a1'] = {
        course_id: 'c1',
        title: 'Assignment 1',
        due_date: '2025-12-31',
        template_repo: 'org123/template-tp1'
      };
      ctx.docStore['submissions/a1_u1'] = {
        assignment_id: 'a1',
        student_id: 'u1',
        repo_url: 'https://github.com/org123/repo1'
      };
      ctx.docStore['profiles/u1'] = {
        role: 'teacher',
        full_name: 'User 1',
        github_user: 'user1',
        matricula_unrn: 'UNRN-12345'
      };

      const createA = await assignmentActions.createAssignment({ courseId: 'c1', title: 'New Task' }, ctx);
      expect(createA).toBeDefined();

      const tAssignments = await assignmentActions.getTeacherAssignments({ courseIds: ['c1'] }, ctx);
      expect(tAssignments.length).toBeGreaterThan(0);

      const sAssignments = await assignmentActions.getStudentAssignments({ courseIds: ['c1'] }, ctx);
      expect(sAssignments.assignments.length).toBeGreaterThan(0);

      const subs = await assignmentActions.getAssignmentSubmissions({ assignmentId: 'a1' }, ctx);
      expect(subs.length).toBeGreaterThan(0);

      await assignmentActions.toggleAccess({ submissionId: 'a1_u1', lock: true }, ctx);
      expect(ctx.docStore['submissions/a1_u1'].is_locked).toBe(true);

      await assignmentActions.massToggleAccess({ assignmentId: 'a1', lock: false }, ctx);

      await assignmentActions.gradeSubmission({ submissionId: 'a1_u1', grade: 10, feedback: 'Great' }, ctx);
      expect(ctx.docStore['submissions/a1_u1'].grade).toEqual("10");

      await assignmentActions.updateAssignment({ assignmentId: 'a1', data: { title: 'Updated Title' } }, ctx);
      expect(ctx.docStore['assignments/a1'].title).toBe('Updated Title');

      const archRes = await assignmentActions.archiveAssignment({ assignmentId: 'a1' }, ctx);
      expect(archRes.success).toBe(true);

      const acceptRes = await assignmentActions.acceptAssignment({ assignmentId: 'a1' }, ctx);
      expect(acceptRes.success).toBe(true);

      const activityRes = await assignmentActions.getStudentGithubActivity({ submissionId: 'a1_u1' }, ctx);
      expect(activityRes.commits).toHaveLength(1);

      const commitsRes = await assignmentActions.getStudentCommits({ submissionId: 'a1_u1' }, ctx);
      expect(commitsRes).toHaveLength(1);

      const submitRes = await assignmentActions.submitAssignment({ submissionId: 'a1_u1', message: 'Listo' }, ctx);
      expect(submitRes.success).toBe(true);

      const sheetRes = await assignmentActions.syncGradesFromSpreadsheet({
        assignmentId: 'a1',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet123/edit#gid=0'
      }, ctx);
      expect(sheetRes.success).toBe(true);
      expect(sheetRes.rejectedRows).toHaveLength(1);
    });
  });
});


