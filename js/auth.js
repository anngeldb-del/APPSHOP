// ============================================================
// auth.js
// Maneja login, logout y el cambio de pantalla login <-> app-shell.
// No mezclar lógica de negocio aquí: solo autenticación.
// ============================================================

import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initRouter } from "./router.js";
import { iniciarTourSiEsPrimeraVez } from "./tour.js";

const pantallaLogin = document.getElementById("pantalla-login");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("form-login");
const loginError = document.getElementById("login-error");
const loginBtn = loginForm.querySelector("button[type=submit]");
const btnSalir = document.getElementById("btn-salir");

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
  } catch (err) {
    mostrarError(traducirErrorFirebase(err.code));
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
});

btnSalir.addEventListener("click", async () => {
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
