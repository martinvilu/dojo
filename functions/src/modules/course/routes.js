/**
 * URLs semánticas de cátedra (plan F5).
 *
 *   courses/{id}.route_slug / route_year / route_term
 *   course_slugs/{slug}__{año}__{cuatrimestre} -> { course_id }  (unicidad)
 *
 * `resolveCourseRoute` traduce una URL a IDs internos solo para quien tiene
 * acceso al curso, y un alias `st_…` solo para la cátedra o el propio
 * estudiante: los uid nunca viajan en el HTML ni en la URL.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { slugify, courseRouteKey, TERMS, SLUG_RE, PUBLIC_ID_RE, ALL_COMMISSIONS } = require('../../lib/routes');
const { isCourseStaff, isCourseMember } = require('../../authz');
const { assertCanEditRules } = require('./academic');

const notFound = () => new HttpsError('not-found', 'No encontramos esa página de cátedra o no tenés acceso.');

async function setCourseRoute(payload, context) {
    const { db, uid, getMyProfile } = context;
    const { courseId } = payload;
    const slug = slugify(payload.slug);
    const year = Number(payload.year);
    const term = payload.term;
    try {
        await assertCanEditRules(db, courseId, uid, getMyProfile ? await getMyProfile() : null);
    } catch {
        throw new HttpsError('permission-denied', 'Solo el profesor titular puede cambiar la URL de la cátedra.');
    }
    if (!SLUG_RE.test(slug)) throw new HttpsError('invalid-argument', 'La asignatura solo admite letras, números y guiones (ej. b6003-programacion-1).');
    if (!TERMS.includes(term)) throw new HttpsError('invalid-argument', 'Cuatrimestre inválido.');

    const courseRef = db.collection('courses').doc(courseId);
    const newKeyRef = db.collection('course_slugs').doc(courseRouteKey(slug, year, term));
    await db.runTransaction(async (tx) => {
        const [courseSnap, taken] = await Promise.all([tx.get(courseRef), tx.get(newKeyRef)]);
        if (!courseSnap.exists) throw notFound();
        if (taken.exists && taken.data().course_id !== courseId) {
            throw new HttpsError('already-exists', 'Otra cátedra ya usa esa asignatura, año y cuatrimestre.');
        }
        const current = courseSnap.data();
        if (current.route_slug) {
            const oldKey = courseRouteKey(current.route_slug, current.route_year, current.route_term);
            if (oldKey !== newKeyRef.id) tx.delete(db.collection('course_slugs').doc(oldKey));
        }
        tx.set(newKeyRef, { course_id: courseId });
        tx.update(courseRef, { route_slug: slug, route_year: year, route_term: term });
    });
    return { slug, year, term };
}

async function resolveCourseRoute(payload, context) {
    const { db, uid, getMyProfile } = context;
    const { asignatura, anio, cuatrimestre, comision, studentPublicId, practica } = payload;

    const keySnap = await db.collection('course_slugs').doc(courseRouteKey(asignatura, Number(anio), cuatrimestre)).get();
    if (!keySnap.exists) throw notFound();
    const courseId = keySnap.data().course_id;

    const profile = getMyProfile ? await getMyProfile() : null;
    const isAdmin = Boolean(profile && profile.role === 'admin');
    const staff = isAdmin || await isCourseStaff(db, courseId, uid);
    // Mismo error para "no existe" y "no tenés acceso": no se enumeran cátedras.
    if (!staff && !(await isCourseMember(db, courseId, uid))) throw notFound();

    const course = (await db.collection('courses').doc(courseId).get()).data() || {};
    let commission = null;
    if (comision && comision !== ALL_COMMISSIONS) {
        commission = (course.commissions || []).find((c) => slugify(c) === comision) || null;
    }

    let studentId = null;
    if (studentPublicId) {
        if (!PUBLIC_ID_RE.test(studentPublicId)) throw notFound();
        const idSnap = await db.collection('student_public_ids').doc(studentPublicId).get();
        if (!idSnap.exists) throw notFound();
        studentId = idSnap.data().uid;
        if (!staff && studentId !== uid) throw notFound();
        if (!(await isCourseMember(db, courseId, studentId))) throw notFound();
    }

    let assignmentId = null;
    if (practica) {
        const assignments = await db.collection('assignments').where('course_id', '==', courseId).get();
        const match = assignments.docs.find((d) => d.id === practica || slugify(d.data().title) === practica);
        if (!match) throw notFound();
        assignmentId = match.id;
    }

    return { courseId, commission, studentId, assignmentId, isStaff: staff };
}

module.exports = { setCourseRoute, resolveCourseRoute };
