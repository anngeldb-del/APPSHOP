// ============================================================
// local-auth.js
// Login local (sin Firebase, ver conexion.js): una contraseña
// guardada como hash+sal en localStorage de este dispositivo.
//
// OJO — esto NO es autenticación real como la de Firebase: solo
// evita que alguien casual que agarre el teléfono/compu vea los
// datos sin escribir la contraseña. Quien tenga acceso al archivo o
// al dispositivo puede evadirlo técnicamente. Si el negocio necesita
// seguridad de verdad (varios empleados, acceso remoto, etc.) hay
// que activar Firebase real (ver conexion.js).
//
// La primera vez que alguien entra, no hay contraseña configurada
// todavía: lo que se escriba en ese primer login se guarda como la
// contraseña del negocio (como configurar un PIN nuevo en un
// teléfono). auth.js no necesita saber nada de esto — se ve igual
// que un login normal.
// ============================================================

const CLAVE_REGISTRO = "nenes-local-auth";
const CLAVE_SESION = "nenes-local-auth-sesion";

function generarSal() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

async function calcularHash(texto, sal) {
  const datos = new TextEncoder().encode(`${sal}:${texto}`);
  const buffer = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function leerRegistro() {
  try {
    const crudo = localStorage.getItem(CLAVE_REGISTRO);
    return crudo ? JSON.parse(crudo) : null;
  } catch (_) {
    return null;
  }
}

function guardarRegistro(registro) {
  try {
    localStorage.setItem(CLAVE_REGISTRO, JSON.stringify(registro));
  } catch (_) {
    // Si el dispositivo bloquea localStorage no hay forma de recordar
    // la contraseña entre sesiones — cada intento de login la volverá
    // a configurar. Poco probable en la app real (no en un visor de
    // archivos restringido), pero no debe tronar la app si pasa.
  }
}

export const auth = { currentUser: null };

export function hayContrasenaConfigurada() {
  return Boolean(leerRegistro());
}

const authListeners = [];

export async function signInWithEmailAndPassword(authArg, correo, password) {
  if (!password) {
    throw Object.assign(new Error("Escribe una contraseña"), { code: "auth/invalid-credential" });
  }

  let registro = leerRegistro();
  if (!registro) {
    // Primer uso: esta contraseña queda configurada para el negocio.
    registro = { sal: generarSal() };
    registro.hash = await calcularHash(password, registro.sal);
    guardarRegistro(registro);
  } else {
    const hash = await calcularHash(password, registro.sal);
    if (hash !== registro.hash) {
      throw Object.assign(new Error("Contraseña incorrecta"), { code: "auth/wrong-password" });
    }
  }

  authArg.currentUser = { email: correo || "local" };
  try { sessionStorage.setItem(CLAVE_SESION, "1"); } catch (_) {}
  authListeners.forEach((fn) => fn(authArg.currentUser));
}

export async function signOut(authArg) {
  authArg.currentUser = null;
  try { sessionStorage.removeItem(CLAVE_SESION); } catch (_) {}
  authListeners.forEach((fn) => fn(null));
}

export function onAuthStateChanged(authArg, cb) {
  authListeners.push(cb);
  try {
    if (sessionStorage.getItem(CLAVE_SESION) === "1" && !authArg.currentUser) {
      authArg.currentUser = { email: "local" };
    }
  } catch (_) {}
  cb(authArg.currentUser);
}
