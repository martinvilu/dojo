jest.mock('firebase-admin', () => ({
  firestore: Object.assign(() => ({}), {
    FieldValue: { serverTimestamp: () => 'TS' },
    Timestamp: { now: () => 'NOW' }
  })
}));
const { getProfile, getSecurityLog, maskIp } = require('../src/modules/auth/profile');

function memDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const ref = (path) => ({
    path,
    get: async () => ({ exists: store.has(path), data: () => (store.has(path) ? { ...store.get(path) } : undefined) }),
    set: async (d, o) => store.set(path, o && o.merge ? { ...(store.get(path) || {}), ...d } : d),
    update: async (d) => store.set(path, { ...store.get(path), ...d }),
    delete: async () => store.delete(path),
    collection: (name) => coll(`${path}/${name}`)
  });
  const coll = (prefix) => {
    const docs = () => [...store.keys()].filter((k) => k.startsWith(`${prefix}/`) && k.split('/').length === prefix.split('/').length + 1);
    const q = (skip = 0, max = Infinity) => ({
      orderBy: () => q(skip, max),
      offset: (n) => q(n, max),
      limit: (n) => q(skip, n),
      get: async () => {
        const sorted = docs().sort((a, b) => store.get(b).auth_time - store.get(a).auth_time).slice(skip, skip + max);
        return { empty: sorted.length === 0, docs: sorted.map((k) => ({ id: k.split('/').pop(), data: () => store.get(k), ref: ref(k) })) };
      }
    });
    return { doc: (id) => ref(`${prefix}/${id}`), ...q() };
  };
  return {
    store,
    collection: (name) => coll(name),
    batch: () => { const ops = []; return { delete: (r) => ops.push(r), commit: async () => { for (const r of ops) await r.delete(); } }; }
  };
}

const request = (ua = 'Mozilla/5.0 Firefox', ip = '200.1.2.3') => ({ rawRequest: { headers: { 'user-agent': ua, 'x-forwarded-for': `${ip}, 10.0.0.1` } } });

describe('getProfile identity (token, not payload)', () => {
  afterEach(() => { delete process.env.SEED_ADMIN_EMAILS; });

  it('creates the profile from the verified token and ignores payload emails', async () => {
    process.env.SEED_ADMIN_EMAILS = 'boss@unrn.edu.ar';
    const db = memDb();
    const p = await getProfile({ email: 'boss@unrn.edu.ar' }, {
      uid: 'u1', db, request: request(),
      authUser: { email: 'Alumno@UNRN.edu.ar', name: 'Ana Pérez', picture: 'https://lh3.example/a.png', auth_time: 1000, firebase: { sign_in_provider: 'google.com' } }
    });
    expect(p).toMatchObject({ email: 'alumno@unrn.edu.ar', full_name: 'Ana Pérez', role: 'student', account_status: 'pending' });
  });

  it('promotes seed emails only when they come from the token', async () => {
    process.env.SEED_ADMIN_EMAILS = 'boss@unrn.edu.ar';
    const db = memDb();
    const p = await getProfile({}, { uid: 'u2', db, request: request(), authUser: { email: 'boss@unrn.edu.ar', auth_time: 1 } });
    expect(p.role).toBe('admin');
  });

  it('backfills an empty email on existing profiles', async () => {
    const db = memDb({ 'profiles/u3': { role: 'student', email: '' } });
    const p = await getProfile({}, { uid: 'u3', db, request: request(), authUser: { email: 'tres@unrn.edu.ar', auth_time: 5 } });
    expect(p.email).toBe('tres@unrn.edu.ar');
    expect(db.store.get('profiles/u3').email).toBe('tres@unrn.edu.ar');
  });
});

describe('security log (mejora 3.44)', () => {
  it('records each new sign-in once and keeps the latest 20', async () => {
    const db = memDb({ 'profiles/u1': { role: 'student', email: 'a@unrn.edu.ar' } });
    for (let t = 1; t <= 22; t++) {
      await getProfile({}, { uid: 'u1', db, request: request(), authUser: { email: 'a@unrn.edu.ar', auth_time: t, firebase: { sign_in_provider: 'password' } } });
      // Refrescos de la misma sesión no duplican entradas.
      await getProfile({}, { uid: 'u1', db, request: request(), authUser: { email: 'a@unrn.edu.ar', auth_time: t } });
    }
    const log = await getSecurityLog({}, { uid: 'u1', db });
    expect(log).toHaveLength(20);
    expect(log[0]).toMatchObject({ id: '22', provider: 'password', ip: '200.1.2.x', user_agent: 'Mozilla/5.0 Firefox' });
  });

  it('masks ips for display', () => {
    expect(maskIp('190.12.34.56')).toBe('190.12.34.x');
    expect(maskIp('2800:810:4ef:1::5')).toBe('2800:810:4ef:…');
    expect(maskIp(null)).toBeNull();
  });
});

describe('institutional email domains (mejora 3.20)', () => {
  const { submitMatricula } = require('../src/modules/auth/profile');
  const settings = { 'globals/settings': { allowed_email_domains: ['unrn.edu.ar'] } };

  it('flags new accounts outside the allowed domains and blocks self-approval', async () => {
    const db = memDb({ ...settings });
    const p = await getProfile({}, { uid: 'g1', db, request: request(), authUser: { email: 'alguien@gmail.com', auth_time: 1 } });
    expect(p).toMatchObject({ account_status: 'pending', email_domain_blocked: true });
    await expect(submitMatricula({ matricula: 'UNRN-12345' }, { uid: 'g1', db })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('accepts the domain and its subdomains', async () => {
    const db = memDb({ ...settings });
    const a = await getProfile({}, { uid: 'a1', db, request: request(), authUser: { email: 'ana@unrn.edu.ar', auth_time: 1 } });
    const b = await getProfile({}, { uid: 'b1', db, request: request(), authUser: { email: 'beto@alumnos.unrn.edu.ar', auth_time: 1 } });
    expect(a.email_domain_blocked).toBe(false);
    expect(b.email_domain_blocked).toBe(false);
  });

  it('does not restrict anything when no domains are configured', async () => {
    const db = memDb();
    const p = await getProfile({}, { uid: 'c1', db, request: request(), authUser: { email: 'x@gmail.com', auth_time: 1 } });
    expect(p.email_domain_blocked).toBe(false);
  });
});
