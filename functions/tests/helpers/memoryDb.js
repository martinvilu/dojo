/**
 * Firestore en memoria para tests de handlers: colecciones y subcolecciones,
 * get/set/update/delete/add, where('==' | 'in') encadenados y getAll.
 * `docs` es un mapa "ruta/del/doc" -> datos, inspeccionable desde el test.
 */
const DELETE = Symbol('delete');

function memoryDb(initial = {}) {
  const docs = { ...initial };
  let autoId = 0;

  const snapshot = (path) => ({
    id: path.split('/').pop(),
    exists: docs[path] !== undefined,
    data: () => (docs[path] === undefined ? undefined : { ...docs[path] }),
    ref: docRef(path),
  });

  const applyUpdate = (path, data, merge) => {
    const next = merge ? { ...(docs[path] || {}) } : {};
    for (const [key, value] of Object.entries(data)) {
      if (value === DELETE) delete next[key];
      else next[key] = value;
    }
    docs[path] = next;
  };

  function docRef(path) {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => snapshot(path),
      set: async (data, opts) => applyUpdate(path, data, opts && opts.merge),
      update: async (data) => {
        if (docs[path] === undefined) throw Object.assign(new Error(`No document: ${path}`), { code: 5 });
        applyUpdate(path, data, true);
      },
      create: async (data) => {
        if (docs[path] !== undefined) throw Object.assign(new Error('exists'), { code: 6 });
        applyUpdate(path, data, false);
      },
      delete: async () => { delete docs[path]; },
      collection: (name) => collectionRef(`${path}/${name}`),
    };
  }

  function query(prefix, filters) {
    const matches = (data) => filters.every(([field, op, value]) => {
      if (op === '==') return data[field] === value;
      if (op === 'in') return value.includes(data[field]);
      throw new Error(`Unsupported operator ${op}`);
    });
    return {
      where: (field, op, value) => query(prefix, [...filters, [field, op, value]]),
      orderBy: () => query(prefix, filters),
      limit: () => query(prefix, filters),
      get: async () => {
        const depth = prefix.split('/').length + 1;
        const paths = Object.keys(docs).filter((p) => p.startsWith(`${prefix}/`) && p.split('/').length === depth);
        const snaps = paths.filter((p) => matches(docs[p])).map(snapshot);
        return { docs: snaps, size: snaps.length, empty: snaps.length === 0, forEach: (fn) => snaps.forEach(fn) };
      },
    };
  }

  function collectionRef(prefix) {
    return {
      ...query(prefix, []),
      doc: (id) => docRef(`${prefix}/${id || `auto${++autoId}`}`),
      add: async (data) => {
        const ref = docRef(`${prefix}/auto${++autoId}`);
        await ref.set(data);
        return ref;
      },
    };
  }

  return {
    docs,
    collection: collectionRef,
    getAll: async (...refs) => refs.map((r) => snapshot(r.path)),
  };
}

/** Contexto de handler como el que arma el dispatcher `api`. */
function handlerContext(db, uid) {
  return {
    uid,
    db,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP', delete: () => DELETE } } },
    getMyProfile: async () => db.docs[`profiles/${uid}`] || null,
  };
}

module.exports = { memoryDb, handlerContext, DELETE };
