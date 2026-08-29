// ============================================================
// tour.js
// Recorrido guiado corto por la app: resalta un elemento a la vez
// con una burbuja explicando qué es, y navega entre pantallas. Se
// dispara solo la primera vez que alguien entra (localStorage) y
// se puede volver a ver desde el menú → "Ver tour rápido".
// ============================================================

const CLAVE_TOUR = "nenes-tour-visto";

const PASOS = [
  {
    titulo: "Bienvenido a Nene's Shopping USA",
    texto: "Un recorrido de 30 segundos por lo más importante. Puedes saltarlo cuando quieras."
  },
  {
    pantalla: "dashboard",
    selector: "#dashboard-kpis",
    titulo: "Tus números clave",
    texto: "Clientes, cuentas activas, saldo pendiente, inversión y ganancia — todo de un vistazo."
  },
  {
    pantalla: "dashboard",
    selector: "#dashboard-grafica-ganancia",
    titulo: "Ganancia por mes",
    texto: "La ganancia de los últimos 6 meses. Se calcula con el costo que le pongas a cada cuenta al crearla."
  },
  {
    pantalla: "dashboard",
    selector: "#btn-descargar-reporte",
    titulo: "Reportes y respaldo",
    texto: "Descarga un reporte en Excel/CSV, o un respaldo completo del negocio en JSON, cuando quieras."
  },
  {
    abrirMenu: true,
    selector: ".drawer-item[data-pantalla=\"pantalla-clientes\"]",
    titulo: "El menú",
    texto: "Desde aquí te mueves entre Dashboard, Clientes y Envío masivo."
  },
  {
    abrirMenu: true,
    selector: ".drawer-tema",
    titulo: "Modo oscuro / claro",
    texto: "Cambia el tema cuando quieras — la app recuerda tu preferencia la próxima vez."
  },
  {
    pantalla: "clientes",
    selector: ".buscador",
    titulo: "Buscar clientes",
    texto: "Busca por nombre. Doble tap en una tarjeta abre el detalle de ese cliente."
  },
  {
    pantalla: "clientes",
    selector: "#btn-nuevo-cliente",
    titulo: "Nuevo cliente",
    texto: "Nombre, teléfono, dirección y notas. Desde su detalle le creas cuentas a pagos, le cobras y le mandas su estado de cuenta por WhatsApp."
  },
  {
    pantalla: "envios",
    selector: ".envios-acciones",
    titulo: "Envío masivo",
    texto: "Manda el estado de cuenta por WhatsApp a todos los que deben — uno por uno, con un clic cada uno."
  },
  {
    titulo: "Listo",
    texto: "Eso es lo básico. Puedes volver a ver este recorrido cuando quieras desde el menú → \"Ver tour rápido\"."
  }
];

let pasoActual = 0;
let overlay = null;

function crearDom() {
  overlay = document.createElement("div");
  overlay.id = "tour-overlay";
  overlay.innerHTML = `
    <div id="tour-resaltado"></div>
    <div id="tour-burbuja">
      <div class="tour-progreso"></div>
      <h3 id="tour-titulo"></h3>
      <p id="tour-texto"></p>
      <div class="tour-acciones">
        <button type="button" id="tour-saltar" class="tour-btn-fantasma">Saltar</button>
        <div style="flex:1;"></div>
        <button type="button" id="tour-anterior" class="tour-btn-fantasma">Atrás</button>
        <button type="button" id="tour-siguiente" class="btn btn-primario tour-btn-siguiente">Siguiente</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#tour-saltar").addEventListener("click", cerrarTour);
  overlay.querySelector("#tour-anterior").addEventListener("click", () => irAPaso(pasoActual - 1));
  overlay.querySelector("#tour-siguiente").addEventListener("click", () => {
    if (pasoActual >= PASOS.length - 1) cerrarTour();
    else irAPaso(pasoActual + 1);
  });
  window.addEventListener("resize", reposicionarActual);
}

function reposicionarActual() {
  if (overlay) posicionar(PASOS[pasoActual]?.selector);
}

function posicionar(selector) {
  const resaltado = overlay.querySelector("#tour-resaltado");
  const burbuja = overlay.querySelector("#tour-burbuja");
  const el = selector ? document.querySelector(selector) : null;

  if (!el) {
    resaltado.style.display = "none";
    burbuja.style.top = "50%";
    burbuja.style.bottom = "";
    burbuja.style.left = "50%";
    burbuja.style.transform = "translate(-50%, -50%)";
    return;
  }

  el.scrollIntoView({ block: "center", behavior: "instant" });
  const r = el.getBoundingClientRect();
  const pad = 8;
  resaltado.style.display = "block";
  resaltado.style.top = `${Math.max(0, r.top - pad)}px`;
  resaltado.style.left = `${Math.max(0, r.left - pad)}px`;
  resaltado.style.width = `${r.width + pad * 2}px`;
  resaltado.style.height = `${r.height + pad * 2}px`;

  const espacioAbajo = window.innerHeight - r.bottom;
  const vaArriba = espacioAbajo < 220;
  burbuja.style.transform = "none";
  burbuja.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - 312))}px`;
  if (vaArriba) {
    burbuja.style.bottom = `${window.innerHeight - r.top + 12}px`;
    burbuja.style.top = "";
  } else {
    burbuja.style.top = `${r.bottom + 12}px`;
    burbuja.style.bottom = "";
  }
}

function irAPaso(indice) {
  pasoActual = Math.max(0, Math.min(indice, PASOS.length - 1));
  const paso = PASOS[pasoActual];
  const drawer = document.getElementById("menu-drawer");

  if (paso.pantalla) location.hash = `#/${paso.pantalla}`;
  drawer.classList.toggle("abierto", Boolean(paso.abrirMenu));

  const espera = paso.abrirMenu ? 300 : 80;
  setTimeout(() => {
    if (!overlay) return;
    overlay.querySelector("#tour-titulo").textContent = paso.titulo;
    overlay.querySelector("#tour-texto").textContent = paso.texto;
    overlay.querySelector(".tour-progreso").textContent = `${pasoActual + 1} / ${PASOS.length}`;
    overlay.querySelector("#tour-anterior").style.visibility = pasoActual === 0 ? "hidden" : "visible";
    overlay.querySelector("#tour-siguiente").textContent = pasoActual === PASOS.length - 1 ? "Entendido" : "Siguiente";
    posicionar(paso.selector);
  }, espera);
}

// Igual que en tema.js: en visores de archivos con origen aislado
// (WhatsApp/Telegram al abrir un .html adjunto) localStorage lanza
// SecurityError. Sin este blindaje, ese error corta la ejecución del
// resto del script. respaldoVisto cubre esa sesión mientras tanto.
let respaldoVisto = false;

function cerrarTour() {
  window.removeEventListener("resize", reposicionarActual);
  if (overlay) overlay.remove();
  overlay = null;
  const drawer = document.getElementById("menu-drawer");
  if (drawer) drawer.classList.remove("abierto");
  respaldoVisto = true;
  try {
    localStorage.setItem(CLAVE_TOUR, "1");
  } catch (_) {}
}

export function iniciarTour() {
  if (overlay) return;
  crearDom();
  irAPaso(0);
}

export function iniciarTourSiEsPrimeraVez() {
  let visto = respaldoVisto;
  try {
    visto = respaldoVisto || Boolean(localStorage.getItem(CLAVE_TOUR));
  } catch (_) {}
  if (!visto) iniciarTour();
}
