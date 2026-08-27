// ============================================================
// modules/envios.js
// Envío masivo de estados de cuenta por WhatsApp.
//
// WhatsApp Click-to-Chat (wa.me) solo abre UN chat por clic, y los
// navegadores bloquean ventanas abiertas por script sin que la
// persona las inicie — automatizar el envío a varios números a la
// vez violaría además los términos de WhatsApp y arriesga que los
// números terminen marcados como spam. Por eso esto arma una fila
// de clientes con saldo pendiente y deja un botón "Enviar" por
// cliente: un clic = un chat abierto, para mandar rápido a todos
// sin exponer los números a un envío automatizado.
// ============================================================

import { db } from "../firebase-config.js";
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { formatoMoneda, urlWhatsApp, mostrarToast } from "../utils.js";
import { armarMensajeEstadoCuenta } from "../estado-cuenta.js";

export function render(container, user) {
  const listaEl = container.querySelector("#envios-lista");
  const vacioEl = container.querySelector("#envios-vacio");
  const btnTodos = container.querySelector("#btn-envios-todos");
  const btnNinguno = container.querySelector("#btn-envios-ninguno");
  const btnComenzar = container.querySelector("#btn-envios-comenzar");
  const contadorEl = container.querySelector("#envios-contador");
  const colaEl = container.querySelector("#envios-cola");

  let clientesConSaldo = [];
  let seleccionados = new Set();
  let cola = null; // { ids, indice, enviados }

  async function cargarClientes() {
    listaEl.innerHTML = `<p style="color:var(--tinta-suave);font-size:0.85rem;">Cargando…</p>`;
    colaEl.innerHTML = "";
    cola = null;

    try {
      const snap = await getDocs(query(collection(db, "clientes"), orderBy("nombreBusqueda")));
      clientesConSaldo = [];
      snap.forEach((d) => {
        const c = d.data();
        if ((c.saldoPendiente || 0) > 0) clientesConSaldo.push({ id: d.id, ...c });
      });
      seleccionados = new Set(clientesConSaldo.filter((c) => c.telefono).map((c) => c.id));
      pintarLista();
    } catch (err) {
      console.error("Error cargando clientes para envío masivo:", err);
      listaEl.innerHTML = `<p style="color:var(--peligro);font-size:0.85rem;">No se pudo cargar la lista.</p>`;
    }
  }

  function actualizarContador() {
    contadorEl.textContent = `${seleccionados.size} de ${clientesConSaldo.length} seleccionados`;
    btnComenzar.disabled = seleccionados.size === 0;
  }

  function pintarLista() {
    if (clientesConSaldo.length === 0) {
      listaEl.innerHTML = "";
      vacioEl.classList.remove("oculto");
      btnComenzar.disabled = true;
      contadorEl.textContent = "";
      return;
    }
    vacioEl.classList.add("oculto");

    listaEl.innerHTML = clientesConSaldo
      .map(
        (c) => `
      <label class="envio-item${c.telefono ? "" : " envio-item--sin-telefono"}">
        <input type="checkbox" data-id="${c.id}" ${seleccionados.has(c.id) ? "checked" : ""} ${c.telefono ? "" : "disabled"}>
        <span class="envio-info">
          <strong>${escaparHtml(c.nombre || "")}</strong>
          <small>${c.telefono ? escaparHtml(c.telefono) : "Sin teléfono — no se puede enviar"}</small>
        </span>
        <span class="envio-saldo">${formatoMoneda(c.saldoPendiente)}</span>
      </label>`
      )
      .join("");

    listaEl.querySelectorAll("input[type=checkbox]").forEach((chk) => {
      chk.addEventListener("change", () => {
        if (chk.checked) seleccionados.add(chk.dataset.id);
        else seleccionados.delete(chk.dataset.id);
        actualizarContador();
      });
    });
    actualizarContador();
  }

  btnTodos.addEventListener("click", () => {
    seleccionados = new Set(clientesConSaldo.filter((c) => c.telefono).map((c) => c.id));
    pintarLista();
  });

  btnNinguno.addEventListener("click", () => {
    seleccionados = new Set();
    pintarLista();
  });

  function pintarCola() {
    if (!cola) {
      colaEl.innerHTML = "";
      return;
    }

    if (cola.indice >= cola.ids.length) {
      colaEl.innerHTML = `
        <div class="vacio">
          <div class="vacio-ico">✅</div>
          <h3>Listo</h3>
          <p>Se abrieron ${cola.enviados} de ${cola.ids.length} chats de WhatsApp.</p>
        </div>`;
      return;
    }

    const cliente = clientesConSaldo.find((c) => c.id === cola.ids[cola.indice]);
    colaEl.innerHTML = `
      <div class="panel envio-cola-panel">
        <span class="etiqueta-panel">Envío ${cola.indice + 1} de ${cola.ids.length}</span>
        <h3>${escaparHtml(cliente.nombre || "")}</h3>
        <p style="color:var(--tinta-suave);font-size:0.85rem;margin:2px 0 14px;">${escaparHtml(cliente.telefono || "")} · Saldo ${formatoMoneda(cliente.saldoPendiente)}</p>
        <button class="btn btn-whatsapp" id="btn-envio-actual">📲 Enviar a ${escaparHtml(cliente.nombre || "")}</button>
        <button class="btn btn-reporte" id="btn-envio-saltar" style="margin-top:8px;">Saltar</button>
      </div>`;

    colaEl.querySelector("#btn-envio-actual").addEventListener("click", async () => {
      const btn = colaEl.querySelector("#btn-envio-actual");
      btn.disabled = true;
      try {
        const datos = await armarMensajeEstadoCuenta(cliente.id);
        if (datos?.telefono) {
          window.open(urlWhatsApp(datos.telefono, datos.mensaje), "_blank");
          cola.enviados++;
        }
      } catch (err) {
        console.error("Error preparando envío:", err);
        mostrarToast("No se pudo preparar este envío");
      } finally {
        avanzarCola();
      }
    });

    colaEl.querySelector("#btn-envio-saltar").addEventListener("click", avanzarCola);
  }

  function avanzarCola() {
    cola.indice++;
    pintarCola();
  }

  btnComenzar.addEventListener("click", () => {
    if (seleccionados.size === 0) return;
    cola = { ids: Array.from(seleccionados), indice: 0, enviados: 0 };
    pintarCola();
    colaEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.addEventListener("datos:cambiaron", cargarClientes);
  cargarClientes();
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}
