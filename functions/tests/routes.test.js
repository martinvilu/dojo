const { memoryDb, handlerContext } = require('./helpers/memoryDb');
const { authorizeAction } = require('../src/authz');
const { slugify, buildCoursePath, termFor } = require('../src/lib/routes');
const { ensureStudentPublicId } = require('../src/lib/publicIds');
const routes = require('../src/modules/course/routes');

function seed() {
  return memoryDb({
    'courses/c1': { name: 'Programación I', commissions: ['Comisión 1', 'Comisión 2'] },
    'courses/c2': { name: 'Otra' },
    'profiles/titular': { role: 'teacher' },
    'profiles/ta': { role: 'teacher' },
    'profiles/ana': { role: 'student', student_public_id: 'st_aaaaaaaaaa' },
    'profiles/beto': { role: 'student', student_public_id: 'st_bbbbbbbbbb' },
    'profiles/outsider': { role: 'student' },
    'student_public_ids/st_aaaaaaaaaa': { uid: 'ana' },
    'student_public_ids/st_bbbbbbbbbb': { uid: 'beto' },
    'course_teachers/c1_titular': { course_id: 'c1', teacher_id: 'titular', role: 'titular' },
    'course_teachers/c1_ta': { course_id: 'c1', teacher_id: 'ta', role: 'ayudante' },
    'course_teachers/c2_titular': { course_id: 'c2', teacher_id: 'titular', role: 'titular' },
    'course_roster/c1_ana': { course_id: 'c1', student_id: 'ana', status: 'approved' },
    'course_roster/c1_beto': { course_id: 'c1', student_id: 'beto', status: 'approved' },
    'assignments/a1': { course_id: 'c1', title: 'TP 1' },
  });
}

const call = async (db, uid, action, payload) => {
  const authorized = await authorizeAction(action, payload, { uid, db, profile: db.docs[`profiles/${uid}`] });
  return routes[action](authorized, handlerContext(db, uid));
};
const route = { asignatura: 'b6003-programacion-1', anio: '2026', cuatrimestre: '1c', comision: 'comision-1' };

describe('route helpers', () => {
  test('slugify strips accents and symbols', () => {
    expect(slugify('Comisión 1')).toBe('comision-1');
    expect(slugify('  B6003 — Programación I ')).toBe('b6003-programacion-i');
    expect(slugify('TP 1: Git & GitHub')).toBe('tp-1-git-github');
  });

  test('buildCoursePath never contains internal IDs', () => {
    const course = { id: 'c1', route_slug: 'b6003-programacion-1', route_year: 2026, route_term: '1c' };
    expect(buildCoursePath(course, { commission: 'Comisión 1', subTab: 'students' })).toBe('/b6003-programacion-1/2026/1c/comision-1/planilla');
    expect(buildCoursePath(course, { subTab: 'settings' })).toBe('/b6003-programacion-1/2026/1c/todas/admin/configuracion');
    expect(buildCoursePath(course, { studentPublicId: 'st_aaaaaaaaaa', practica: 'tp-1' })).toBe('/b6003-programacion-1/2026/1c/todas/estudiantes/st_aaaaaaaaaa/practicas/tp-1');
    expect(buildCoursePath({ id: 'c1' }, { subTab: 'students' })).toBeNull();
    expect(termFor(new Date('2026-03-10'))).toBe('1c');
    expect(termFor(new Date('2026-08-10'))).toBe('2c');
  });

  test('public IDs are opaque, unique and created once', async () => {
    const db = memoryDb({ 'profiles/u1': { role: 'student' } });
    const id = await ensureStudentPublicId(db, 'u1');
    expect(id).toMatch(/^st_[0-9a-f]{10}$/);
    expect(db.docs[`student_public_ids/${id}`].uid).toBe('u1');
    expect(await ensureStudentPublicId(db, 'u1', id)).toBe(id);
  });
});

describe('setCourseRoute', () => {
  test('only the titular sets it and the triple asignatura/año/cuatrimestre is unique', async () => {
    const db = seed();
    const payload = { courseId: 'c1', slug: 'B6003 Programación 1', year: 2026, term: '1c' };
    await expect(call(db, 'ta', 'setCourseRoute', payload)).rejects.toThrow(/titular/);
    expect(await call(db, 'titular', 'setCourseRoute', payload)).toEqual({ slug: 'b6003-programacion-1', year: 2026, term: '1c' });
    expect(db.docs['course_slugs/b6003-programacion-1__2026__1c'].course_id).toBe('c1');

    await expect(call(db, 'titular', 'setCourseRoute', { ...payload, courseId: 'c2' })).rejects.toMatchObject({ code: 'already-exists' });

    // Changing the route frees the previous key.
    await call(db, 'titular', 'setCourseRoute', { ...payload, term: '2c' });
    expect(db.docs['course_slugs/b6003-programacion-1__2026__1c']).toBeUndefined();
    expect(db.docs['courses/c1'].route_term).toBe('2c');
  });
});

describe('resolveCourseRoute', () => {
  const ready = async () => {
    const db = seed();
    await call(db, 'titular', 'setCourseRoute', { courseId: 'c1', slug: 'b6003-programacion-1', year: 2026, term: '1c' });
    return db;
  };

  test('resolves course, commission and practice for members', async () => {
    const db = await ready();
    expect(await call(db, 'ana', 'resolveCourseRoute', { ...route, practica: 'tp-1' }))
      .toEqual({ courseId: 'c1', commission: 'Comisión 1', studentId: null, assignmentId: 'a1', isStaff: false });
  });

  test('outsiders and unknown routes get the same not-found', async () => {
    const db = await ready();
    await expect(call(db, 'outsider', 'resolveCourseRoute', route)).rejects.toMatchObject({ code: 'not-found' });
    await expect(call(db, 'ana', 'resolveCourseRoute', { ...route, anio: '2027' })).rejects.toMatchObject({ code: 'not-found' });
  });

  test('a student only resolves their own public ID; staff resolve anyone in the roster', async () => {
    const db = await ready();
    expect((await call(db, 'ana', 'resolveCourseRoute', { ...route, studentPublicId: 'st_aaaaaaaaaa' })).studentId).toBe('ana');
    await expect(call(db, 'ana', 'resolveCourseRoute', { ...route, studentPublicId: 'st_bbbbbbbbbb' })).rejects.toMatchObject({ code: 'not-found' });
    expect((await call(db, 'ta', 'resolveCourseRoute', { ...route, studentPublicId: 'st_bbbbbbbbbb' })).studentId).toBe('beto');
    await expect(call(db, 'ta', 'resolveCourseRoute', { ...route, studentPublicId: 'ana' })).rejects.toMatchObject({ code: 'not-found' });
  });
});
