// ============================================================
// tema.js
// Modo oscuro/claro. La preferencia se guarda en localStorage y
// se aplica como atributo data-tema en <html>. El script inline en
// el <head> de index.html ya la aplica antes de pintar (para no
// parpadear); este módulo solo conecta el interruptor del menú.
// ============================================================

const CLAVE = "nenes-tema";

// Algunos visores de archivos (p. ej. el de WhatsApp/Telegram al abrir
// un .html adjunto) cargan la página en un origen aislado donde el
// navegador bloquea localStorage por completo (lanza SecurityError).
// Sin este blindaje, ese error detiene TODO el script — incluido el
// código que conecta el botón de login más abajo. Con el try/catch,
// el tema simplemente no se recuerda ahí, pero el resto de la app sigue
// funcionando. respaldo es la copia en memoria para esa sesión.
let respaldoTema = "oscuro";

function guardarTema(tema) {
  try {
    localStorage.setItem(CLAVE, tema);
  } catch (_) {
    respaldoTema = tema;
  }
}

function leerTema() {
  try {
    return localStorage.getItem(CLAVE) || "oscuro";
  } catch (_) {
    return respaldoTema;
  }
}

function actualizarInterruptor(tema) {
  const interruptor = document.getElementById("interruptor-tema");
  const etiqueta = document.getElementById("etiqueta-tema");
  if (interruptor) interruptor.checked = tema === "claro";
  if (etiqueta) etiqueta.textContent = tema === "oscuro" ? "Modo oscuro" : "Modo claro";
}

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  guardarTema(tema);
  actualizarInterruptor(tema);
}

function obtenerTema() {
  return leerTema();
}

function initTema() {
  actualizarInterruptor(obtenerTema());
  const interruptor = document.getElementById("interruptor-tema");
  if (interruptor) {
    interruptor.addEventListener("change", () => {
      aplicarTema(interruptor.checked ? "claro" : "oscuro");
    });
  }
}

initTema();
