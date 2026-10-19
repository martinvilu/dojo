const { buildCourseReportCsv, requestCourseExport, processExportJob, getExportDownloadUrl, escapeCsv } = require('../src/modules/course/exportJobs');
const { purgeExpiredExports } = require('../src/modules/system/cleanup');

function memDb(initial) {
  const store = new Map(Object.entries(initial));
  const matches = (d, [f, op, v]) => (op === 'in' ? v.includes(d[f]) : d[f] === v);
  const coll = (prefix, filters = []) => ({
    where: (f, op, v) => coll(prefix, [...filters, [f, op, v]]),
    add: async (d) => { const id = `j${store.size}`; store.set(`${prefix}/${id}`, d); return { id }; },
    get: async () => ({
      docs: [...store.keys()]
        .filter((k) => k.startsWith(`${prefix}/`) && k.split('/').length === prefix.split('/').length + 1 && filters.every((fl) => matches(store.get(k), fl)))
        .map((k) => ({ id: k.split('/').pop(), data: () => store.get(k) }))
    }),
    doc: (id) => ({
      get: async () => ({ exists: store.has(`${prefix}/${id}`), data: () => store.get(`${prefix}/${id}`) }),
      update: async (d) => store.set(`${prefix}/${id}`, { ...store.get(`${prefix}/${id}`), ...d }),
      collection: (n) => coll(`${prefix}/${id}/${n}`)
    })
  });
  return { store, collection: (n) => coll(n) };
}

const DATA = {
  'courses/c1': { name: 'Prog II' },
  'course_roster/c1_s1': { course_id: 'c1', student_id: 's1' },
  'enrollments/s2_c1': { course_id: 'c1', student_id: 's2' },
  'enrollments/s9_c2': { course_id: 'c2', student_id: 's9' },
  'profiles/s1': { full_name: 'Zoe; "Z"', email: 'z@x', matricula_unrn: 'UNRN-1', commissions: { c1: 'A' } },
  'profiles/s2': { full_name: 'Ana', email: 'a@x' },
  'assignments/a1': { course_id: 'c1', title: 'TP1' },
  'assignments/a2': { course_id: 'c1', title: 'TP2' },
  'submissions/x1': { assignment_id: 'a1', student_id: 's1', grade: '9' },
  'submissions/x2': { assignment_id: 'a2', student_id: 's2', status: 'submitted' },
  'courses/c1/attendance/class_1': { records: { s1: 'present', s2: 'absent' } },
  'courses/c1/attendance/class_2': { records: { s1: 'late' } },
  'course_teachers/c1_t1': { role: 'titular' }
};

describe('background course exports (mejoras 3.16 y 3.32)', () => {
  it('builds one row per student with attendance and grades', async () => {
    const { csv, students } = await buildCourseReportCsv(memDb({ ...DATA }), 'c1');
    const lines = csv.trim().split('\n');
    expect(students).toBe(2);
    expect(lines[0]).toBe('estudiante;email;matricula;github;comision;clases_registradas;presentes;asistencia_%;TP1;TP2');
    expect(lines[1]).toBe('Ana;a@x;;;;1;0;0;;Entregado');
    expect(lines[2]).toBe('"Zoe; ""Z""";z@x;UNRN-1;;A;2;2;100;9;');
    expect(csv).not.toContain('s9');
  });

  it('queues, processes and notifies, then serves a short-lived signed url', async () => {
    const db = memDb({ ...DATA });
    const saved = {};
    const bucket = { file: (path) => ({ save: async (buf, opts) => { saved[path] = { buf, opts }; }, getSignedUrl: jest.fn(async (o) => [`https://signed/${path}?exp=${o.expires}`]) }) };
    const { jobId } = await requestCourseExport({ courseId: 'c1' }, { uid: 't1', db });
    const path = await processExportJob({ db, bucket, serverTimestamp: () => 'TS' }, jobId, db.store.get(`export_jobs/${jobId}`));
    expect(path).toBe(`exports/c1/${jobId}.csv`);
    expect(saved[path].opts.contentType).toContain('text/csv');
    expect(db.store.get(`export_jobs/${jobId}`)).toMatchObject({ status: 'ready', students: 2 });
    const notification = [...db.store.entries()].find(([k]) => k.startsWith('notifications/'))[1];
    expect(notification).toMatchObject({ student_id: 't1', type: 'export_ready', link: `/dashboard?export=${jobId}` });

    const res = await getExportDownloadUrl({ jobId }, { uid: 't1', db, bucket, getMyProfile: async () => ({ role: 'teacher' }) });
    expect(res.url).toContain('https://signed/');
    expect(res.expiresInSeconds).toBe(900);
    await expect(getExportDownloadUrl({ jobId }, { uid: 'intruso', db, bucket, getMyProfile: async () => ({ role: 'student' }) }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('marks failed jobs and ignores non-queued ones', async () => {
    const db = memDb({ ...DATA, 'export_jobs/bad': { course_id: 'c1', status: 'queued', requested_by: 't1' } });
    const bucket = { file: () => ({ save: async () => { throw new Error('bucket caído'); } }) };
    await expect(processExportJob({ db, bucket, serverTimestamp: () => 'TS' }, 'bad', db.store.get('export_jobs/bad'))).rejects.toThrow('bucket caído');
    expect(db.store.get('export_jobs/bad')).toMatchObject({ status: 'failed', error: 'bucket caído' });
    expect(await processExportJob({ db, bucket, serverTimestamp: () => 'TS' }, 'bad', { status: 'ready' })).toBeNull();
  });

  it('purges exports older than seven days', async () => {
    const now = Date.parse('2026-10-19T00:00:00Z');
    const del = jest.fn().mockResolvedValue();
    const files = [
      { metadata: { timeCreated: '2026-10-01T00:00:00Z' }, delete: del },
      { metadata: { timeCreated: '2026-10-18T00:00:00Z' }, delete: jest.fn() }
    ];
    expect(await purgeExpiredExports({ getFiles: async () => [files] }, now)).toBe(1);
    expect(del).toHaveBeenCalled();
  });

  it('escapes csv values', () => {
    expect(escapeCsv('a;b')).toBe('"a;b"');
    expect(escapeCsv(null)).toBe('');
  });
});
