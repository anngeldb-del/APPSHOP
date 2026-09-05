// ============================================================
// auth.js
// Maneja login, logout y el cambio de pantalla login <-> app-shell.
// No mezclar lógica de negocio aquí: solo autenticación.
// ============================================================

import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, MODO_LOCAL } from "./conexion.js";
import { initRouter } from "./router.js";
import { iniciarTourSiEsPrimeraVez } from "./tour.js";

const pantallaLogin = document.getElementById("pantalla-login");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("form-login");
const loginError = document.getElementById("login-error");
const loginHintLocal = document.getElementById("login-hint-local");
const loginBtn = loginForm.querySelector("button[type=submit]");
const btnSalir = document.getElementById("btn-salir");

// En modo local (sin Firebase) el primer login configura la
// contraseña del negocio — se avisa para que no parezca un error.
if (MODO_LOCAL) {
  import("./local-auth.js").then(({ hayContrasenaConfigurada }) => {
    loginHintLocal.classList.toggle("oculto", hayContrasenaConfigurada());
  });
}

function mostrarError(msg) {
  loginError.textContent = msg;
}

function limpiarError() {
  loginError.textContent = "";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  limpiarError();
  loginBtn.disabled = true;
  loginBtn.textContent = "Entrando...";

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged se encarga de mostrar el app-shell
    loginHintLocal.classList.add("oculto");
  } catch (err) {
    mostrarError(traducirErrorFirebase(err.code));
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
});

btnSalir.addEventListener("click", async () => {
  document.getElementById("menu-drawer")?.classList.remove("abierto");
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    pantallaLogin.classList.add("oculto");
    appShell.classList.remove("oculto");
    initRouter(user);
    setTimeout(iniciarTourSiEsPrimeraVez, 600);
  } else {
    appShell.classList.add("oculto");
    pantallaLogin.classList.remove("oculto");
  }
});

function traducirErrorFirebase(code) {
  const mapa = {
    "auth/invalid-email": "Correo inválido.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "Ese usuario no existe.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos."
  };
  return mapa[code] || "No se pudo iniciar sesión. Intenta de nuevo.";
}
