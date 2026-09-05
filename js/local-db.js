// ============================================================
// local-db.js
// Reemplazo de Firestore para cuando la app corre en "modo local"
// (sin backend en la nube — ver conexion.js). Implementa el mismo
// API que usa el resto del código (collection, doc, addDoc,
// onSnapshot, query/where/orderBy/limit/startAfter, runTransaction,
// writeBatch, getCountFromServer, getAggregateFromServer, sum) para
// que dashboard.js, clientes.js, envios.js y estado-cuenta.js corran
// sin cambios, sin importar de dónde vengan los datos.
//
// Los documentos viven en IndexedDB (persisten entre sesiones y
// reinicios del navegador/teléfono) pero se mantienen espejados en
// un Map en memoria para poder reusar la misma lógica de consultas
// ya probada en el demo. Toda escritura se aplica primero en
// memoria (para que la UI reaccione al instante) y luego se guarda
// en IndexedDB (para que sobreviva a un reinicio).
//
// Esto NO es una base de datos en la nube: vive solo en este
// dispositivo/navegador. Si se borra el sitio, se resetea el
// teléfono, o se usa en otro dispositivo, estos datos no viajan con
// la app — por eso el dashboard recuerda exportar un respaldo
// (ver modules/dashboard.js).
// ============================================================

const NOMBRE_DB = "nenes-local-db";
const VERSION_DB = 1;
const ALMACEN = "documentos"; // un solo almacén: { path, data }

let dbPromise = null;
function abrirDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE_DB, VERSION_DB);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(ALMACEN, { keyPath: "path" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const tienda = new Map(); // colección (path) -> Map(id -> data)

function coleccionDe(path) {
  if (!tienda.has(path)) tienda.set(path, new Map());
  return tienda.get(path);
}

function generarId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

class Timestamp {
  constructor(fecha) { this._fecha = fecha; }
  toDate() { return this._fecha; }
}

function resolverSentinels(data, actual) {
  const salida = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && v.__sentinel === "serverTimestamp") salida[k] = new Timestamp(new Date());
    else if (v && v.__sentinel === "increment") salida[k] = (actual[k] || 0) + v.n;
    else salida[k] = v;
  }
  return salida;
}

// Timestamp no se puede guardar tal cual en IndexedDB de forma
// legible entre sesiones (es una clase nuestra, no algo nativo) —
// se serializa como { __ts: isoString } y se reconstruye al leer.
function paraGuardar(data) {
  const salida = {};
  for (const [k, v] of Object.entries(data)) {
    salida[k] = v instanceof Timestamp ? { __ts: v.toDate().toISOString() } : v;
  }
  return salida;
}

function alLeer(data) {
  const salida = {};
  for (const [k, v] of Object.entries(data || {})) {
    salida[k] = v && v.__ts ? new Timestamp(new Date(v.__ts)) : v;
  }
  return salida;
}

// ---------------------------------------------------------------
// Arranque: carga todo IndexedDB a memoria una sola vez. El resto
// de la app debe esperar a que esto termine antes de leer/escribir
// (ver conexion.js / auth.js).
// ---------------------------------------------------------------
let listoPromise = null;
export function inicializar() {
  if (listoPromise) return listoPromise;
  listoPromise = (async () => {
    const db = await abrirDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ALMACEN, "readonly");
      const req = tx.objectStore(ALMACEN).getAll();
      req.onsuccess = () => {
        for (const registro of req.result) {
          const partes = registro.path.split("/");
          const id = partes.pop();
          const colPath = partes.join("/");
          coleccionDe(colPath).set(id, alLeer(registro.data));
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  })();
  return listoPromise;
}

async function persistir(path, data) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN, "readwrite");
    tx.objectStore(ALMACEN).put({ path, data: paraGuardar(data) });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function eliminarPersistido(path) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN, "readwrite");
    tx.objectStore(ALMACEN).delete(path);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const db = { __db: true };

export function collection(dbArg, ...segmentos) {
  return { __col: true, path: segmentos.join("/") };
}

export function collectionGroup(dbArg, nombre) {
  return { __col: true, __group: nombre, path: nombre };
}

export function doc(refODb, ...segmentos) {
  if (refODb && refODb.__col) {
    const id = segmentos[0] || generarId();
    return { __doc: true, path: `${refODb.path}/${id}`, id };
  }
  const path = segmentos.join("/");
  return { __doc: true, path, id: segmentos[segmentos.length - 1] };
}

export function query(ref, ...constraints) {
  return { __query: true, ref, constraints };
}
export function where(field, op, value) { return { __c: "where", field, op, value }; }
export function orderBy(field, dir = "asc") { return { __c: "orderBy", field, dir }; }
export function limit(n) { return { __c: "limit", n }; }
export function startAfter(cursor) { return { __c: "startAfter", cursor }; }
export function sum(field) { return { __agg: "sum", field }; }
export function serverTimestamp() { return { __sentinel: "serverTimestamp" }; }
export function increment(n) { return { __sentinel: "increment", n }; }

function docsDeGrupo(nombre) {
  const resultado = [];
  for (const [path, mapa] of tienda.entries()) {
    const partes = path.split("/");
    if (partes[partes.length - 1] === nombre) {
      for (const [id, data] of mapa.entries()) resultado.push({ id, data, colPath: path });
    }
  }
  return resultado;
}

function resolverDocs(refOQuery) {
  let ref = refOQuery;
  let constraints = [];
  if (refOQuery.__query) {
    ref = refOQuery.ref;
    constraints = refOQuery.constraints;
  }

  let base = ref.__group
    ? docsDeGrupo(ref.__group)
    : Array.from(coleccionDe(ref.path).entries()).map(([id, data]) => ({ id, data, colPath: ref.path }));

  for (const c of constraints.filter((c) => c.__c === "where")) {
    base = base.filter((d) => {
      const v = d.data[c.field];
      if (c.op === "==") return v === c.value;
      if (c.op === ">=") return v >= c.value;
      if (c.op === "<=") return v <= c.value;
      return true;
    });
  }

  const ordenC = constraints.find((c) => c.__c === "orderBy");
  if (ordenC) {
    base.sort((a, b) => {
      const av = a.data[ordenC.field];
      const bv = b.data[ordenC.field];
      let cmp;
      if (av instanceof Timestamp && bv instanceof Timestamp) cmp = av.toDate() - bv.toDate();
      else if (av < bv) cmp = -1;
      else if (av > bv) cmp = 1;
      else cmp = 0;
      return ordenC.dir === "desc" ? -cmp : cmp;
    });
  }

  const startC = constraints.find((c) => c.__c === "startAfter");
  if (startC) {
    const idx = base.findIndex((d) => d.id === startC.cursor.id);
    if (idx >= 0) base = base.slice(idx + 1);
  }

  const limitC = constraints.find((c) => c.__c === "limit");
  if (limitC) base = base.slice(0, limitC.n);

  return base;
}

function envolverDoc(d) {
  return {
    id: d.id,
    data: () => ({ ...d.data }),
    exists: () => true,
    ref: { __doc: true, path: `${d.colPath}/${d.id}`, id: d.id }
  };
}

function envolverQuerySnapshot(docs) {
  const envueltos = docs.map(envolverDoc);
  return { docs: envueltos, empty: envueltos.length === 0, size: envueltos.length, forEach: (fn) => envueltos.forEach(fn) };
}

export async function getDocs(refOQuery) {
  return envolverQuerySnapshot(resolverDocs(refOQuery));
}

export async function getDoc(docRef) {
  const partes = docRef.path.split("/");
  const id = partes.pop();
  const colPath = partes.join("/");
  const mapa = coleccionDe(colPath);
  if (!mapa.has(id)) return { exists: () => false, data: () => undefined, id };
  return envolverDoc({ id, data: mapa.get(id), colPath });
}

export async function addDoc(collectionRef, data) {
  const id = generarId();
  const final = resolverSentinels(data, {});
  coleccionDe(collectionRef.path).set(id, final);
  const path = `${collectionRef.path}/${id}`;
  await persistir(path, final);
  notificarTodos();
  return { id, path };
}

export async function updateDoc(docRef, data) {
  const partes = docRef.path.split("/");
  const id = partes.pop();
  const mapa = coleccionDe(partes.join("/"));
  const actual = mapa.get(id) || {};
  const final = { ...actual, ...resolverSentinels(data, actual) };
  mapa.set(id, final);
  await persistir(docRef.path, final);
  notificarTodos();
}

export async function deleteDoc(docRef) {
  const partes = docRef.path.split("/");
  const id = partes.pop();
  coleccionDe(partes.join("/")).delete(id);
  await eliminarPersistido(docRef.path);
  notificarTodos();
}

function aplicarEnMemoria(op) {
  const partes = op.ref.path.split("/");
  const id = partes.pop();
  const mapa = coleccionDe(partes.join("/"));
  if (op.tipo === "set") {
    const final = resolverSentinels(op.data, {});
    mapa.set(id, final);
    return { path: op.ref.path, data: final, borrar: false };
  }
  if (op.tipo === "update") {
    const actual = mapa.get(id) || {};
    const final = { ...actual, ...resolverSentinels(op.data, actual) };
    mapa.set(id, final);
    return { path: op.ref.path, data: final, borrar: false };
  }
  mapa.delete(id);
  return { path: op.ref.path, borrar: true };
}

async function aplicarYPersistir(ops) {
  const resultados = ops.map(aplicarEnMemoria);
  for (const r of resultados) {
    if (r.borrar) await eliminarPersistido(r.path);
    else await persistir(r.path, r.data);
  }
  notificarTodos();
}

export function writeBatch() {
  const ops = [];
  return {
    set(ref, data) { ops.push({ tipo: "set", ref, data }); },
    update(ref, data) { ops.push({ tipo: "update", ref, data }); },
    delete(ref) { ops.push({ tipo: "delete", ref }); },
    async commit() { await aplicarYPersistir(ops); }
  };
}

export async function runTransaction(dbArg, fn) {
  const ops = [];
  const tx = {
    get: (ref) => getDoc(ref),
    set(ref, data) { ops.push({ tipo: "set", ref, data }); },
    update(ref, data) { ops.push({ tipo: "update", ref, data }); },
    delete(ref) { ops.push({ tipo: "delete", ref }); }
  };
  const resultado = await fn(tx);
  await aplicarYPersistir(ops);
  return resultado;
}

export async function getCountFromServer(refOQuery) {
  const docs = resolverDocs(refOQuery);
  return { data: () => ({ count: docs.length }) };
}

export async function getAggregateFromServer(refOQuery, especificacion) {
  const docs = resolverDocs(refOQuery);
  const resultado = {};
  for (const [alias, spec] of Object.entries(especificacion)) {
    if (spec.__agg === "sum") resultado[alias] = docs.reduce((acc, d) => acc + (d.data[spec.field] || 0), 0);
  }
  return { data: () => resultado };
}

let contadorListeners = 0;
const listeners = new Map();

export function onSnapshot(refOQuery, callback) {
  const idL = contadorListeners++;
  const ejecutar = () => {
    if (refOQuery.__doc) getDoc(refOQuery).then(callback);
    else getDocs(refOQuery).then(callback);
  };
  listeners.set(idL, ejecutar);
  ejecutar();
  return () => listeners.delete(idL);
}

function notificarTodos() {
  listeners.forEach((fn) => fn());
}
