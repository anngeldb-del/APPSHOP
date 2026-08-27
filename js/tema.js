// ============================================================
// tema.js
// Modo oscuro/claro. La preferencia se guarda en localStorage y
// se aplica como atributo data-tema en <html>. El script inline en
// el <head> de index.html ya la aplica antes de pintar (para no
// parpadear); este módulo solo conecta el interruptor del menú.
// ============================================================

const CLAVE = "nenes-tema";

function actualizarInterruptor(tema) {
  const interruptor = document.getElementById("interruptor-tema");
  const etiqueta = document.getElementById("etiqueta-tema");
  if (interruptor) interruptor.checked = tema === "claro";
  if (etiqueta) etiqueta.textContent = tema === "oscuro" ? "Modo oscuro" : "Modo claro";
}

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  localStorage.setItem(CLAVE, tema);
  actualizarInterruptor(tema);
}

function obtenerTema() {
  return localStorage.getItem(CLAVE) || "oscuro";
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
