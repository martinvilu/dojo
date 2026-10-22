/**
 * Firestore en memoria para tests de handlers: colecciones y subcolecciones,
 * get/set/update/delete/add, where('==' | 'in') encadenados y getAll.
 * `docs` es un mapa "ruta/del/doc" -> datos, inspeccionable desde el test.
 */
const DELETE = Symbol('delete');
const arrayUnion = (...items) => ({ __op: 'union', items });
const arrayRemove = (...items) => ({ __op: 'remove', items });

function memoryDb(initial = {}) {
  const docs = { ...initial };
  let autoId = 0;

  // Como en Firestore, el snapshot congela los datos al momento de leer.
  const snapshot = (path) => {
    const frozen = docs[path] === undefined ? undefined : structuredClone(docs[path]);
    return {
      id: path.split('/').pop(),
      exists: frozen !== undefined,
      data: () => (frozen === undefined ? undefined : structuredClone(frozen)),
      ref: docRef(path),
    };
  };

  const applyUpdate = (path, data, merge, dotted = false) => {
    const next = merge ? structuredClone(docs[path] || {}) : {};
    for (const [key, value] of Object.entries(data)) {
      // update() interpreta "a.b" como campo anidado, igual que Firestore.
      const parts = dotted ? key.split('.') : [key];
      let node = next;
      parts.slice(0, -1).forEach((p) => { node = node[p] = node[p] && typeof node[p] === 'object' ? node[p] : {}; });
      const leaf = parts[parts.length - 1];
      if (value === DELETE) delete node[leaf];
      else if (value && value.__op === 'union') node[leaf] = [...new Set([...(node[leaf] || []), ...value.items])];
      else if (value && value.__op === 'remove') node[leaf] = (node[leaf] || []).filter((x) => !value.items.includes(x));
      else node[leaf] = value;
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
        applyUpdate(path, data, true, true);
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
      if (op === 'array-contains') return Array.isArray(data[field]) && data[field].includes(value);
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

  // Transacciones serializadas: alcanza para tests de un solo proceso.
  const runTransaction = async (fn) => fn({
    get: async (ref) => (typeof ref.get === 'function' && ref.path ? snapshot(ref.path) : ref.get()),
    set: (ref, data, opts) => applyUpdate(ref.path, data, opts && opts.merge),
    update: (ref, data) => applyUpdate(ref.path, data, true, true),
    delete: (ref) => { delete docs[ref.path]; },
  });

  return {
    docs,
    collection: collectionRef,
    runTransaction,
    getAll: async (...refs) => refs.map((r) => snapshot(r.path)),
  };
}

/** Contexto de handler como el que arma el dispatcher `api`. */
function handlerContext(db, uid) {
  return {
    uid,
    db,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP', delete: () => DELETE, arrayUnion, arrayRemove } } },
    getMyProfile: async () => db.docs[`profiles/${uid}`] || null,
  };
}

module.exports = { memoryDb, handlerContext, DELETE };
