const adminActions = require('../actions/admin');
const announcementActions = require('../actions/announcements');
const assignmentActions = require('../actions/assignments');
const attendanceActions = require('../actions/attendance');
const backupActions = require('../actions/backups');
const courseActions = require('../actions/courses');
const moodleActions = require('../actions/moodle');
const notificationActions = require('../actions/notifications');
const profileActions = require('../actions/profile');
const scheduleActions = require('../actions/schedule');
const statsActions = require('../actions/stats');
const studyGroupActions = require('../actions/studyGroups');
const tutoringActions = require('../actions/tutoring');

describe('Full Coverage Actions Test Suite', () => {

  const createMockContext = (overrides = {}) => {
    const docStore = {};
    
    const getDocMock = jest.fn().mockImplementation((path) => {
      if (docStore[path]) {
        return Promise.resolve({
          exists: true,
          id: path.split('/').pop(),
          data: () => docStore[path],
          ref: { delete: jest.fn().mockResolvedValue(true) }
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
    test('markAttendance validation & success', async () => {
      const ctx = createMockContext({ uid: 'student1' });
      await expect(attendanceActions.markAttendance({}, ctx)).rejects.toThrow('Faltan datos de la clase');
      await expect(attendanceActions.markAttendance({ courseId: 'c1', classId: 'cls1' }, ctx)).rejects.toThrow('No estás inscripto');

      ctx.docStore['enrollments/student1_c1'] = { active: true };
      const res = await attendanceActions.markAttendance({ courseId: 'c1', classId: 'cls1' }, ctx);
      expect(res.success).toBe(true);
    });

    test('submitQrAttendance validations and geo distance', async () => {
      const ctx = createMockContext({ uid: 'student1', myProfile: { role: 'student' } });
      await expect(attendanceActions.submitQrAttendance({}, ctx)).rejects.toThrow('Faltan datos');

      ctx.docStore['profiles/student1'] = { role: 'student' };

      const teacherCtx = createMockContext({ uid: 'teacher1' });
      teacherCtx.docStore['profiles/teacher1'] = { role: 'teacher' };
      
      // Setup active QR first for teacher check
      teacherCtx.docStore['courses/c1/active_qr/current'] = { token: 'ABCDEF', classNumber: 1 };
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: 'ABCDEF' }, teacherCtx))
        .rejects.toThrow('Solo los estudiantes pueden firmar asistencia');

      // No active QR
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: 'ABCDEF' }, ctx))
        .rejects.toThrow('No hay un código de asistencia activo');

      // Setup active QR
      ctx.docStore['courses/c1/active_qr/current'] = {
        token: 'ABCDEF',
        classNumber: 1,
        created_at: { toDate: () => new Date() },
        lat: -41.133,
        lng: -71.310
      };

      // Invalid token
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: 'WRONG' }, ctx))
        .rejects.toThrow('código de asistencia ingresado no es válido');

      // Invalid class number
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 2, token: 'ABCDEF' }, ctx))
        .rejects.toThrow('clase diferente');

      // Expired token
      ctx.docStore['courses/c1/active_qr/current'].created_at = { toDate: () => new Date(Date.now() - 60000) };
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: 'ABCDEF' }, ctx))
        .rejects.toThrow('ha expirado');

      // Reset timestamp to now
      ctx.docStore['courses/c1/active_qr/current'].created_at = { toDate: () => new Date() };

      // Far distance (>150m)
      await expect(attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: 'ABCDEF', lat: -40.000, lng: -70.000 }, ctx))
        .rejects.toThrow('Estás demasiado lejos');

      // Valid distance (within 150m)
      const res = await attendanceActions.submitQrAttendance({ courseId: 'c1', classNumber: 1, token: 'ABCDEF', lat: -41.1331, lng: -71.3101 }, ctx);
      expect(res.success).toBe(true);
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

      const nonAdminCtx = createMockContext({ myProfile: { role: 'student' } });
      await expect(backupActions.createSystemBackup({}, nonAdminCtx)).rejects.toThrow();
      await expect(backupActions.downloadSystemBackup({ backupId }, nonAdminCtx)).rejects.toThrow();
    });
  });

  // 5. PROFILE & NOTIFICATIONS & STATS & OTHER MODULES
  describe('Profile, Notifications, Stats, Tutoring, StudyGroups, Schedule, Moodle Actions', () => {
    test('profileActions', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['profiles/u1'] = { full_name: 'User 1' };
      
      const p = await profileActions.getProfile({}, ctx);
      expect(p.full_name).toBe('User 1');

      await profileActions.updateProfile({ github_user: 'dev' }, ctx);
      expect(ctx.docStore['profiles/u1'].github_user).toBe('dev');

      await expect(profileActions.submitMatricula({ matricula: 'INVALID' }, ctx)).rejects.toThrow();
      await profileActions.submitMatricula({ matricula: 'UNRN-123456' }, ctx);
      expect(ctx.docStore['profiles/u1'].matricula_unrn).toBe('UNRN-123456');
    });

    test('notificationActions', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['notifications/n1'] = { student_id: 'u1', read: false };
      
      const list = await notificationActions.getStudentNotifications({}, ctx);
      expect(list.length).toBe(1);

      const res = await notificationActions.markNotificationsRead({ notificationIds: ['n1'] }, ctx);
      expect(res.success).toBe(true);
    });

    test('statsActions', async () => {
      const ctx = createMockContext({ uid: 't1' });
      ctx.docStore['course_teachers/c1_t1'] = { teacher_id: 't1', course_id: 'c1' };
      ctx.docStore['courses/c1'] = { name: 'Course 1', class_instances: [] };
      ctx.docStore['enrollments/e1'] = { course_id: 'c1', student_id: 's1' };
      ctx.docStore['assignments/a1'] = { course_id: 'c1', title: 'Task 1' };

      const stats = await statsActions.getTeacherDashboardStats({}, ctx);
      expect(stats.pendingCorrections).toBeDefined();

      const courseStats = await statsActions.getCourseDashboardStats({ courseId: 'c1' }, ctx);
      expect(courseStats.name).toBe('Course 1');
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

    test('studyGroupActions', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['profiles/u1'] = { full_name: 'User 1' };

      const createRes = await studyGroupActions.createStudyGroup({ courseId: 'c1', name: 'Group 1' }, ctx);
      expect(createRes.success).toBe(true);

      ctx.docStore['study_groups/g1'] = {
        course_id: 'c1',
        name: 'Group 1',
        members: ['u1'],
        created_at: { toDate: () => new Date() }
      };

      const groups = await studyGroupActions.getStudyGroups({ courseId: 'c1' }, ctx);
      expect(groups.length).toBeGreaterThan(0);

      await studyGroupActions.joinStudyGroup({ groupId: groups[0].id }, ctx);
      await studyGroupActions.leaveStudyGroup({ groupId: groups[0].id }, ctx);
    });

    test('moodleActions', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['profiles/u1'] = { full_name: 'User 1' };
      const res = await moodleActions.moodleAutoEnroll({ courseId: 'c1' }, ctx);
      expect(res.success).toBe(true);
    });

    test('courseActions', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['courses/c1'] = { name: 'Course 1', invite_code: 'CODE123' };
      ctx.docStore['course_teachers/c1_u1'] = { course_id: 'c1', teacher_id: 'u1' };
      ctx.docStore['course_roster/r1'] = { course_id: 'c1', student_id: 'u1' };
      ctx.docStore['profiles/u1'] = { full_name: 'User 1' };

      const cDetails = await courseActions.getCourseDetails({ courseId: 'c1' }, ctx);
      expect(cDetails.id).toBe('c1');

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

      await courseActions.updateCourseSettings({ courseId: 'c1', data: { key: 'val' } }, ctx);
      const roster = await courseActions.getCourseRoster({ courseId: 'c1' }, ctx);
      expect(roster.length).toBe(1);

      await courseActions.enrollCourse({ code: 'CODE123' }, ctx);
    });

    test('assignmentActions', async () => {
      const ctx = createMockContext({ uid: 'u1' });
      ctx.docStore['courses/c1'] = { name: 'Course 1', github_token: 'token123', github_org: 'org123' };
      ctx.docStore['course_teachers/c1_u1'] = { course_id: 'c1', teacher_id: 'u1' };
      ctx.docStore['assignments/a1'] = { course_id: 'c1', title: 'Assignment 1', due_date: '2025-12-31' };
      ctx.docStore['submissions/a1_u1'] = { assignment_id: 'a1', student_id: 'u1', repo_url: 'https://github.com/org123/repo1' };
      ctx.docStore['profiles/u1'] = { role: 'teacher', full_name: 'User 1', github_user: 'user1' };

      const createA = await assignmentActions.createAssignment({ courseId: 'c1', title: 'New Task' }, ctx);
      expect(createA).toBeDefined();

      const tAssignments = await assignmentActions.getTeacherAssignments({ courseIds: ['c1'] }, ctx);
      expect(tAssignments.length).toBeGreaterThan(0);

      const sAssignments = await assignmentActions.getStudentAssignments({ courseIds: ['c1'] }, ctx);
      expect(sAssignments.assignments.length).toBeGreaterThan(0);

      const subs = await assignmentActions.getAssignmentSubmissions({ assignmentId: 'a1' }, ctx);
      expect(subs.length).toBeGreaterThan(0);

      await assignmentActions.gradeSubmission({ submissionId: 'a1_u1', grade: 10, feedback: 'Great' }, ctx);
      expect(ctx.docStore['submissions/a1_u1'].grade).toEqual("10");

      await assignmentActions.updateAssignment({ assignmentId: 'a1', data: { title: 'Updated Title' } }, ctx);
      expect(ctx.docStore['assignments/a1'].title).toBe('Updated Title');
    });
  });
});
