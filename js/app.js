// ============================================================
// app.js
// Punto de entrada: registra el service worker e importa auth.js,
// que a su vez arranca el router una vez que hay sesión.
// ============================================================

import "./tema.js";
import "./auth.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("Service worker no registrado:", err);
    });
  });
}
