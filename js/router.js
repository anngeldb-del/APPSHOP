// ============================================================
// router.js
// Router simple por hash (#/ruta). No recarga la página.
// Cada módulo nuevo del proyecto se registra en MODULES abajo:
// eso es lo único que hay que tocar para agregar una sección.
//
// A diferencia del boilerplate genérico, aquí las pantallas ya
// vienen fijas en index.html (pantalla-dashboard, pantalla-clientes,
// detalle-cliente) porque el diseño de Nene's Shopping USA las
// define explícitamente. El router solo decide cuál mostrar y le
// pasa el control de datos a cada módulo (que se inicializa una
// sola vez y luego reacciona a Firestore por su cuenta).
const MODULES = [
  { path: "dashboard", pantallaId: "pantalla-dashboard" },
  { path: "clientes", pantallaId: "pantalla-clientes" },
  { path: "envios", pantallaId: "pantalla-envios" },
  // { path: "reportes", pantallaId: "pantalla-reportes" },
];

import { render as renderDashboard } from "./modules/dashboard.js";
import { render as renderClientes, irADetalle as clientesIrADetalle } from "./modules/clientes.js";
import { render as renderEnvios } from "./modules/envios.js";
import { iniciarTour } from "./tour.js";

const pantallas = MODULES.map((m) => document.getElementById(m.pantallaId));
const detalleCliente = document.getElementById("detalle-cliente");
const navItems = document.querySelectorAll(".nav-item");
const btnMenus = document.querySelectorAll(".btn-menu");
const btnCerrarMenu = document.getElementById("btn-cerrar-menu");
const btnVerTour = document.getElementById("btn-ver-tour");
const drawer = document.getElementById("menu-drawer");

let currentUser = null;
let inicializado = false;

function ocultarTodas() {
  pantallas.forEach((p) => p.classList.add("oculto"));
  detalleCliente.classList.add("oculto");
}

function marcarNavActivo(pantallaId) {
  navItems.forEach((btn) => {
    btn.classList.toggle("activo", btn.dataset.pantalla === pantallaId);
  });
}

function abrirDrawer() {
  drawer.classList.add("abierto");
}

function cerrarDrawer() {
  drawer.classList.remove("abierto");
}

function renderRoute() {
  const hash = location.hash.replace("#/", "");
  const [ruta, subId] = hash.split("/");

  ocultarTodas();

  if (ruta === "clientes" && subId) {
    detalleCliente.classList.remove("oculto");
    marcarNavActivo("pantalla-clientes");
    clientesIrADetalle(subId);
    return;
  }

  const mod = MODULES.find((m) => m.path === ruta) || MODULES[0];
  document.getElementById(mod.pantallaId).classList.remove("oculto");
  marcarNavActivo(mod.pantallaId);
}

export function initRouter(user) {
  currentUser = user;

  if (!inicializado) {
    renderDashboard(document.getElementById("pantalla-dashboard"), currentUser);
    renderClientes(document.getElementById("pantalla-clientes"), currentUser);
    renderEnvios(document.getElementById("pantalla-envios"), currentUser);

    navItems.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mod = MODULES.find((m) => m.pantallaId === btn.dataset.pantalla);
        location.hash = `#/${mod ? mod.path : MODULES[0].path}`;
        cerrarDrawer();
      });
    });

    btnMenus.forEach((btn) => btn.addEventListener("click", abrirDrawer));
    btnCerrarMenu.addEventListener("click", cerrarDrawer);
    drawer.addEventListener("click", (e) => {
      if (e.target === drawer) cerrarDrawer();
    });

    btnVerTour.addEventListener("click", () => {
      cerrarDrawer();
      iniciarTour();
    });

    window.addEventListener("hashchange", renderRoute);
    inicializado = true;
  }

  if (!location.hash) location.hash = `#/${MODULES[0].path}`;
  renderRoute();
}
