// ============================================================
// conexion.js
// ÚNICO lugar que decide de dónde vienen los datos y el login: de
// Firebase real (la nube) o del almacenamiento local de este
// dispositivo (ver local-db.js / local-auth.js). Todo el resto del
// código (auth.js, dashboard.js, clientes.js, envios.js,
// estado-cuenta.js) importa de aquí en vez de importar Firebase
// directo — así no le importa cuál de los dos está activo.
//
// Para activar Firebase más adelante (cuando el cliente decida
// pagarlo): cambia MODO_LOCAL a false y llena firebase-config.js con
// las credenciales reales del proyecto. Nada más se toca.
// ============================================================

export const MODO_LOCAL = true;

const firestoreUrl = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const authUrl = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let db, auth;
let collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot,
  query, orderBy, where, limit, startAfter, serverTimestamp, increment,
  writeBatch, runTransaction, collectionGroup, getCountFromServer,
  getAggregateFromServer, sum;
let signInWithEmailAndPassword, signOut, onAuthStateChanged;

if (MODO_LOCAL) {
  const local = await import("./local-db.js");
  await local.inicializar();
  ({
    db, collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot,
    query, orderBy, where, limit, startAfter, serverTimestamp, increment,
    writeBatch, runTransaction, collectionGroup, getCountFromServer,
    getAggregateFromServer, sum
  } = local);

  const localAuth = await import("./local-auth.js");
  ({ auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } = localAuth);
} else {
  const config = await import("./firebase-config.js");
  db = config.db;
  auth = config.auth;

  const firestore = await import(/* @vite-ignore */ firestoreUrl);
  ({
    collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot,
    query, orderBy, where, limit, startAfter, serverTimestamp, increment,
    writeBatch, runTransaction, collectionGroup, getCountFromServer,
    getAggregateFromServer, sum
  } = firestore);

  const authMod = await import(/* @vite-ignore */ authUrl);
  ({ signInWithEmailAndPassword, signOut, onAuthStateChanged } = authMod);
}

export {
  db, auth,
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot,
  query, orderBy, where, limit, startAfter, serverTimestamp, increment,
  writeBatch, runTransaction, collectionGroup, getCountFromServer,
  getAggregateFromServer, sum,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
};
