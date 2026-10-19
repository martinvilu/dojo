const { deleteCourse, restoreCourse, enrollCourse, getTeacherCourses } = require('../src/modules/course/courses');
const { authorizeAction } = require('../src/authz');
const { cleanupAssignmentData, purgeDeletedCourses } = require('../src/modules/system/cleanup');

// Firestore en memoria con where/limit/batch suficientes para estas pruebas.
function memoryDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const docRef = (path) => ({
    path,
    id: path.split('/').pop(),
    get: async () => ({ exists: store.has(path), id: path.split('/').pop(), data: () => store.get(path), ref: docRef(path) }),
    set: async (d) => { store.set(path, d); },
    update: async (d) => {
      const next = { ...store.get(path) };
      for (const [k, v] of Object.entries(d)) {
        if (v && v.__delete) delete next[k]; else next[k] = v;
      }
      store.set(path, next);
    },
    delete: async () => { store.delete(path); }
  });
  const query = (name, filters = [], max = Infinity) => ({
    where: (field, op, value) => query(name, [...filters, [field, op, value]], max),
    limit: (n) => query(name, filters, n),
    get: async () => {
      const docs = [...store.entries()]
        .filter(([p]) => p.startsWith(`${name}/`) && p.split('/').length === 2)
        .filter(([, d]) => filters.every(([f, op, v]) => (op === '==' ? d[f] === v : op === '<=' ? d[f] <= v : false)))
        .slice(0, max)
        .map(([p, d]) => ({ id: p.split('/')[1], data: () => d, ref: docRef(p) }));
      return { empty: docs.length === 0, size: docs.length, docs };
    }
  });
  return {
    store,
    collection: (name) => ({ ...query(name), doc: (id) => docRef(`${name}/${id}`) }),
    batch: () => {
      const ops = [];
      return { delete: (ref) => ops.push(ref), commit: async () => { for (const r of ops) await r.delete(); } };
    }
  };
}
const admin = { firestore: { FieldValue: { delete: () => ({ __delete: true }), serverTimestamp: () => 'TS' } } };

describe('soft delete of courses (mejora 3.21)', () => {
  it('marks the course as deleted and lets an admin restore it', async () => {
    const db = memoryDb({ 'courses/c1': { name: 'Prog II' } });
    const res = await deleteCourse({ courseId: 'c1' }, { db, uid: 'admin1', admin });
    expect(res.purgeAfterDays).toBe(30);
    const deleted = db.store.get('courses/c1');
    expect(deleted.deleted_by).toBe('admin1');
    expect(deleted.purge_after.getTime() - deleted.deleted_at.getTime()).toBe(30 * 86400000);

    await restoreCourse({ courseId: 'c1' }, { db, admin });
    expect(db.store.get('courses/c1')).toEqual({ name: 'Prog II' });
  });

  it('hides deleted courses from listings and invite codes', async () => {
    const db = memoryDb({
      'courses/c1': { name: 'Activa', invite_code: 'AAA111' },
      'courses/c2': { name: 'Borrada', invite_code: 'BBB222', deleted_at: new Date() },
      'course_teachers/c1_t1': { course_id: 'c1', teacher_id: 't1' },
      'course_teachers/c2_t1': { course_id: 'c2', teacher_id: 't1' }
    });
    const courses = await getTeacherCourses({}, { db, uid: 't1' });
    expect(courses.map((c) => c.id)).toEqual(['c1']);
    await expect(enrollCourse({ code: 'BBB222' }, { db, uid: 's1', admin })).rejects.toThrow('Código de invitación inválido');
  });

  it('blocks course-scoped actions on deleted courses for everyone but admins', async () => {
    const db = memoryDb({
      'courses/c2': { name: 'Borrada', deleted_at: new Date() },
      'course_teachers/c2_t1': { course_id: 'c2', teacher_id: 't1' }
    });
    await expect(authorizeAction('getCourseSettings', { courseId: 'c2' }, { uid: 't1', db, profile: { role: 'teacher' } }))
      .rejects.toMatchObject({ code: 'not-found' });
    await expect(authorizeAction('getCourseSettings', { courseId: 'c2' }, { uid: 'a1', db, profile: { role: 'admin' } }))
      .resolves.toEqual({ courseId: 'c2' });
  });
});

describe('cleanup (mejoras 3.21 y 3.47)', () => {
  it('removes submissions and peer reviews of a deleted assignment', async () => {
    const db = memoryDb({
      'submissions/s1': { assignment_id: 'a1' },
      'submissions/s2': { assignment_id: 'a2' },
      'peer_reviews/r1': { assignment_id: 'a1' }
    });
    expect(await cleanupAssignmentData(db, 'a1')).toEqual({ submissions: 1, reviews: 1 });
    expect([...db.store.keys()]).toEqual(['submissions/s2']);
  });

  it('purges expired soft-deleted courses with their memberships', async () => {
    const past = new Date(Date.now() - 1000);
    const db = memoryDb({
      'courses/old': { deleted_at: past, purge_after: past },
      'courses/recent': { deleted_at: new Date(), purge_after: new Date(Date.now() + 86400000) },
      'course_roster/old_s1': { course_id: 'old' },
      'assignments/a1': { course_id: 'old' },
      'course_roster/recent_s1': { course_id: 'recent' }
    });
    expect(await purgeDeletedCourses(db, null)).toEqual(['old']);
    expect([...db.store.keys()].sort()).toEqual(['course_roster/recent_s1', 'courses/recent']);
  });
});
