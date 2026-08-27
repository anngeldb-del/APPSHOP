// ============================================================
// modules/clientes.js
// Dueño de: lista de clientes (búsqueda + paginación), alta de
// cliente, detalle de cliente (cuentas a cuotas), alta de cuenta
// con generador de calendario de cuotas, y registro de pagos.
// Todo lo relacionado a clientes/cuentas/cuotas vive aquí para no
// tocar el código de otros módulos.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { formatoMoneda, formatoFecha, sumarDias, mostrarToast, debounce, urlWhatsApp } from "../utils.js";
import { armarMensajeEstadoCuenta } from "../estado-cuenta.js";

const PAGE_SIZE = 10;

// ---- estado de lista/paginación ----
let terminoBusqueda = "";
let pageStarts = [null];
let paginaActual = 0;
let hayMasPaginas = false;

// ---- estado de detalle de cliente ----
let clienteActualId = null;
let clienteActualData = null;
let unsubListeners = [];

// ---- estado del modal de pago ----
let pagoContexto = null;

// ---- estado del modal de editar cuenta ----
let cuentaEditando = null;

// asignada dentro de render(); irADetalle() la usa desde el router
let abrirDetalleImpl = null;

function redondear2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function avisarCambio() {
  document.dispatchEvent(new CustomEvent("datos:cambiaron"));
}

function limpiarListeners() {
  unsubListeners.forEach((unsub) => unsub());
  unsubListeners = [];
}

function abrirModal(id) {
  document.getElementById(id).classList.add("abierto");
}

function cerrarModal(id) {
  document.getElementById(id).classList.remove("abierto");
}

// Borra la cuenta, sus cuotas, y descuenta lo que le quedaba pendiente
// del saldo del cliente.
async function eliminarCuenta(clienteId, cuentaId) {
  const cuentaSnap = await getDoc(doc(db, "clientes", clienteId, "cuentas", cuentaId));
  if (!cuentaSnap.exists()) return;
  const saldo = cuentaSnap.data().saldoPendiente || 0;

  const cuotasSnap = await getDocs(collection(db, "clientes", clienteId, "cuentas", cuentaId, "cuotas"));
  const lote = writeBatch(db);
  cuotasSnap.forEach((d) => lote.delete(d.ref));
  lote.delete(doc(db, "clientes", clienteId, "cuentas", cuentaId));
  if (saldo) lote.update(doc(db, "clientes", clienteId), { saldoPendiente: increment(-saldo) });
  await lote.commit();
}

// Solo deja eliminar clientes sin cuentas, para no perder historial de
// ventas/pagos por accidente. Si tiene cuentas, hay que borrarlas primero.
async function eliminarCliente(clienteId) {
  const cuentasSnap = await getDocs(collection(db, "clientes", clienteId, "cuentas"));
  if (!cuentasSnap.empty) {
    mostrarToast("No se puede eliminar: el cliente tiene cuentas registradas");
    return false;
  }
  await deleteDoc(doc(db, "clientes", clienteId));
  return true;
}

export function render(container, user) {
  const buscador = document.getElementById("buscador-clientes");
  const listaEl = document.getElementById("lista-clientes");
  const vacioEl = document.getElementById("clientes-vacio");
  const btnAnterior = document.getElementById("btn-pag-anterior");
  const btnSiguiente = document.getElementById("btn-pag-siguiente");
  const btnNuevoCliente = document.getElementById("btn-nuevo-cliente");
  const formNuevoCliente = document.getElementById("form-nuevo-cliente");

  const dcNombre = document.getElementById("dc-nombre");
  const dcTelefono = document.getElementById("dc-telefono");
  const dcSaldo = document.getElementById("dc-saldo");
  const cuentasClienteEl = document.getElementById("cuentas-cliente");
  const btnVolverCliente = document.getElementById("btn-volver-cliente");
  const btnWhatsAppCliente = document.getElementById("btn-whatsapp-cliente");
  const btnEditarCliente = document.getElementById("btn-editar-cliente");
  const formEditarCliente = document.getElementById("form-editar-cliente");
  const btnEliminarCliente = document.getElementById("btn-eliminar-cliente");
  const btnNuevaCuenta = document.getElementById("btn-nueva-cuenta");
  const formNuevaCuenta = document.getElementById("form-nueva-cuenta");
  const generadorCuotas = document.getElementById("generador-cuotas");
  const formEditarCuenta = document.getElementById("form-editar-cuenta");
  const btnEliminarCuenta = document.getElementById("btn-eliminar-cuenta");

  const formPago = document.getElementById("form-registrar-pago");
  const pagoResumen = document.getElementById("pago-resumen");

  // ---------------- Lista de clientes ----------------

  function construirQuery(cursor) {
    const clientesRef = collection(db, "clientes");
    if (terminoBusqueda) {
      const termino = terminoBusqueda.toLowerCase();
      const constraints = [
        orderBy("nombreBusqueda"),
        where("nombreBusqueda", ">=", termino),
        where("nombreBusqueda", "<=", termino + ""),
        limit(PAGE_SIZE + 1)
      ];
      if (cursor) constraints.splice(3, 0, startAfter(cursor));
      return query(clientesRef, ...constraints);
    }
    const constraints = [orderBy("nombreBusqueda"), limit(PAGE_SIZE + 1)];
    if (cursor) constraints.splice(1, 0, startAfter(cursor));
    return query(clientesRef, ...constraints);
  }

  function pintarClienteCard(id, cliente) {
    const saldo = cliente.saldoPendiente || 0;
    const div = document.createElement("div");
    div.className = "cliente-card";
    div.dataset.id = id;
    div.innerHTML = `
      <div class="cc-info">
        <h4>${escaparHtml(cliente.nombre || "")}</h4>
        <p>${escaparHtml(cliente.telefono || "Sin teléfono")}</p>
      </div>
      <div class="cc-saldo ${saldo <= 0 ? "al-dia" : ""}">${formatoMoneda(saldo)}</div>
    `;
    div.addEventListener("dblclick", () => {
      location.hash = `#/clientes/${id}`;
    });
    return div;
  }

  async function cargarPagina(indice) {
    listaEl.innerHTML = `<p style="color:var(--tinta-suave);font-size:0.85rem;">Cargando…</p>`;
    try {
      const snap = await getDocs(construirQuery(pageStarts[indice]));
      const docs = snap.docs;
      hayMasPaginas = docs.length > PAGE_SIZE;
      const pagina = docs.slice(0, PAGE_SIZE);

      listaEl.innerHTML = "";
      if (pagina.length === 0) {
        vacioEl.classList.remove("oculto");
      } else {
        vacioEl.classList.add("oculto");
        pagina.forEach((d) => listaEl.appendChild(pintarClienteCard(d.id, d.data())));
      }

      if (hayMasPaginas) pageStarts[indice + 1] = pagina[pagina.length - 1];
      paginaActual = indice;
      btnAnterior.disabled = paginaActual === 0;
      btnSiguiente.disabled = !hayMasPaginas;
    } catch (err) {
      console.error("Error cargando clientes:", err);
      listaEl.innerHTML = `<p style="color:var(--peligro);font-size:0.85rem;">No se pudo cargar la lista.</p>`;
    }
  }

  buscador.addEventListener(
    "input",
    debounce(() => {
      terminoBusqueda = buscador.value.trim();
      pageStarts = [null];
      cargarPagina(0);
    }, 350)
  );

  btnAnterior.addEventListener("click", () => {
    if (paginaActual > 0) cargarPagina(paginaActual - 1);
  });

  btnSiguiente.addEventListener("click", () => {
    if (hayMasPaginas) cargarPagina(paginaActual + 1);
  });

  document.addEventListener("datos:cambiaron", () => cargarPagina(paginaActual));

  cargarPagina(0);

  // ---------------- Alta de cliente ----------------

  btnNuevoCliente.addEventListener("click", () => abrirModal("modal-nuevo-cliente"));

  formNuevoCliente.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("nc-nombre").value.trim();
    const telefono = document.getElementById("nc-telefono").value.trim();
    const direccion = document.getElementById("nc-direccion").value.trim();
    if (!nombre) return;

    const btn = formNuevoCliente.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await addDoc(collection(db, "clientes"), {
        nombre,
        nombreBusqueda: nombre.toLowerCase(),
        telefono,
        direccion,
        saldoPendiente: 0,
        creadoEn: serverTimestamp()
      });
      formNuevoCliente.reset();
      cerrarModal("modal-nuevo-cliente");
      mostrarToast("Cliente guardado");
      pageStarts = [null];
      cargarPagina(0);
      avisarCambio();
    } catch (err) {
      console.error("Error guardando cliente:", err);
      mostrarToast("No se pudo guardar el cliente");
    } finally {
      btn.disabled = false;
    }
  });

  // ---------------- Detalle de cliente ----------------

  btnVolverCliente.addEventListener("click", () => {
    limpiarListeners();
    location.hash = "#/clientes";
  });

  btnWhatsAppCliente.addEventListener("click", async () => {
    if (!clienteActualId) return;
    btnWhatsAppCliente.disabled = true;
    try {
      const datos = await armarMensajeEstadoCuenta(clienteActualId);
      if (!datos) return;
      if (!datos.telefono) {
        mostrarToast("Este cliente no tiene teléfono registrado");
        return;
      }
      window.open(urlWhatsApp(datos.telefono, datos.mensaje), "_blank");
    } catch (err) {
      console.error("Error armando el estado de cuenta:", err);
      mostrarToast("No se pudo preparar el estado de cuenta");
    } finally {
      btnWhatsAppCliente.disabled = false;
    }
  });

  btnEditarCliente.addEventListener("click", () => {
    if (!clienteActualId || !clienteActualData) return;
    document.getElementById("ec-nombre").value = clienteActualData.nombre || "";
    document.getElementById("ec-telefono").value = clienteActualData.telefono || "";
    document.getElementById("ec-direccion").value = clienteActualData.direccion || "";
    abrirModal("modal-editar-cliente");
  });

  formEditarCliente.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!clienteActualId) return;
    const nombre = document.getElementById("ec-nombre").value.trim();
    const telefono = document.getElementById("ec-telefono").value.trim();
    const direccion = document.getElementById("ec-direccion").value.trim();
    if (!nombre) return;

    const btn = formEditarCliente.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await updateDoc(doc(db, "clientes", clienteActualId), {
        nombre,
        nombreBusqueda: nombre.toLowerCase(),
        telefono,
        direccion
      });
      cerrarModal("modal-editar-cliente");
      mostrarToast("Cliente actualizado");
      avisarCambio();
    } catch (err) {
      console.error("Error actualizando cliente:", err);
      mostrarToast("No se pudo actualizar el cliente");
    } finally {
      btn.disabled = false;
    }
  });

  btnEliminarCliente.addEventListener("click", async () => {
    if (!clienteActualId) return;
    const nombre = clienteActualData?.nombre || "este cliente";
    if (!confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;

    btnEliminarCliente.disabled = true;
    try {
      const eliminado = await eliminarCliente(clienteActualId);
      if (eliminado) {
        cerrarModal("modal-editar-cliente");
        mostrarToast("Cliente eliminado");
        limpiarListeners();
        avisarCambio();
        location.hash = "#/clientes";
      }
    } catch (err) {
      console.error("Error eliminando cliente:", err);
      mostrarToast("No se pudo eliminar el cliente");
    } finally {
      btnEliminarCliente.disabled = false;
    }
  });

  function calcularCuotas({ montoTotal, numCuotas, fechaInicio, frecuenciaDias }) {
    const montoCuota = redondear2(montoTotal / numCuotas);
    const cuotas = [];
    let acumulado = 0;
    for (let i = 0; i < numCuotas; i++) {
      const esUltima = i === numCuotas - 1;
      const monto = esUltima ? redondear2(montoTotal - acumulado) : montoCuota;
      acumulado = redondear2(acumulado + monto);
      cuotas.push({
        numero: i + 1,
        fechaVencimiento: sumarDias(fechaInicio, i * frecuenciaDias),
        monto
      });
    }
    return cuotas;
  }

  function leerFormularioCuenta() {
    const montoTotal = parseFloat(document.getElementById("nc2-monto-total").value);
    const numCuotas = parseInt(document.getElementById("nc2-num-cuotas").value, 10);
    const fechaInicio = document.getElementById("nc2-fecha-inicio").value;
    const frecuenciaDias = parseInt(document.getElementById("nc2-frecuencia").value, 10);
    if (!montoTotal || !numCuotas || !fechaInicio || montoTotal <= 0 || numCuotas <= 0) return null;
    return { montoTotal, numCuotas, fechaInicio, frecuenciaDias };
  }

  function actualizarPreviewCuotas() {
    const datos = leerFormularioCuenta();
    if (!datos) {
      generadorCuotas.innerHTML = "Completa monto, cuotas y fecha para ver el calendario.";
      return;
    }
    const cuotas = calcularCuotas(datos);
    generadorCuotas.innerHTML = cuotas
      .map((c) => `<div class="gc-fila"><span>Cuota ${c.numero} · ${formatoFecha(c.fechaVencimiento)}</span><span>${formatoMoneda(c.monto)}</span></div>`)
      .join("");
  }

  ["nc2-monto-total", "nc2-num-cuotas", "nc2-fecha-inicio", "nc2-frecuencia"].forEach((id) => {
    document.getElementById(id).addEventListener("input", actualizarPreviewCuotas);
  });

  btnNuevaCuenta.addEventListener("click", () => {
    if (!clienteActualId) return;
    formNuevaCuenta.reset();
    document.getElementById("nc2-fecha-inicio").valueAsDate = new Date();
    actualizarPreviewCuotas();
    abrirModal("modal-nueva-cuenta");
  });

  formNuevaCuenta.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!clienteActualId) return;
    const datos = leerFormularioCuenta();
    if (!datos) return;

    const articulo = document.getElementById("nc2-articulo").value.trim();
    const costoRaw = document.getElementById("nc2-costo").value;
    const costo = costoRaw ? parseFloat(costoRaw) : null;
    const cuotas = calcularCuotas(datos);

    const btn = formNuevaCuenta.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const cuentaRef = await addDoc(collection(db, "clientes", clienteActualId, "cuentas"), {
        articulo,
        montoTotal: datos.montoTotal,
        costo,
        numCuotas: datos.numCuotas,
        fechaInicio: datos.fechaInicio,
        frecuenciaDias: datos.frecuenciaDias,
        montoCuota: redondear2(datos.montoTotal / datos.numCuotas),
        saldoPendiente: datos.montoTotal,
        estado: "activa",
        creadoEn: serverTimestamp()
      });

      const lote = writeBatch(db);
      cuotas.forEach((cuota) => {
        const cuotaRef = doc(collection(db, "clientes", clienteActualId, "cuentas", cuentaRef.id, "cuotas"));
        lote.set(cuotaRef, { ...cuota, pagado: false });
      });
      await lote.commit();

      await updateDoc(doc(db, "clientes", clienteActualId), {
        saldoPendiente: increment(datos.montoTotal)
      });

      formNuevaCuenta.reset();
      cerrarModal("modal-nueva-cuenta");
      mostrarToast("Cuenta creada");
      avisarCambio();
    } catch (err) {
      console.error("Error guardando cuenta:", err);
      mostrarToast("No se pudo guardar la cuenta");
    } finally {
      btn.disabled = false;
    }
  });

  formEditarCuenta.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!cuentaEditando) return;
    const articulo = document.getElementById("ecu-articulo").value.trim();
    const costoRaw = document.getElementById("ecu-costo").value;
    const costo = costoRaw ? parseFloat(costoRaw) : null;
    if (!articulo) return;

    const btn = formEditarCuenta.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await updateDoc(doc(db, "clientes", cuentaEditando.clienteId, "cuentas", cuentaEditando.cuentaId), {
        articulo,
        costo
      });
      cerrarModal("modal-editar-cuenta");
      mostrarToast("Cuenta actualizada");
      avisarCambio();
    } catch (err) {
      console.error("Error actualizando cuenta:", err);
      mostrarToast("No se pudo actualizar la cuenta");
    } finally {
      btn.disabled = false;
    }
  });

  btnEliminarCuenta.addEventListener("click", async () => {
    if (!cuentaEditando) return;
    if (!confirm("¿Eliminar esta cuenta y todas sus cuotas? Esta acción no se puede deshacer.")) return;

    btnEliminarCuenta.disabled = true;
    try {
      await eliminarCuenta(cuentaEditando.clienteId, cuentaEditando.cuentaId);
      cerrarModal("modal-editar-cuenta");
      mostrarToast("Cuenta eliminada");
      cuentaEditando = null;
      avisarCambio();
    } catch (err) {
      console.error("Error eliminando cuenta:", err);
      mostrarToast("No se pudo eliminar la cuenta");
    } finally {
      btnEliminarCuenta.disabled = false;
    }
  });

  function pintarCuota(clienteId, cuentaId, cuota) {
    const div = document.createElement("div");
    div.className = "cuota-item";
    if (cuota.pagado) {
      div.innerHTML = `
        <div class="cu-info"><strong>Cuota ${cuota.numero}</strong> · ${formatoFecha(cuota.fechaVencimiento)}</div>
        <div class="cuota-pagada">Pagada ✓</div>
      `;
    } else {
      div.innerHTML = `
        <div class="cu-info"><strong>Cuota ${cuota.numero}</strong> · ${formatoFecha(cuota.fechaVencimiento)} · <span class="cu-monto">${formatoMoneda(cuota.monto)}</span></div>
        <button class="btn-pagar">Pagar</button>
      `;
      div.querySelector(".btn-pagar").addEventListener("click", () => {
        pagoContexto = { clienteId, cuentaId, cuotaId: cuota.id, monto: cuota.monto };
        pagoResumen.textContent = `Cuota ${cuota.numero} — vence ${formatoFecha(cuota.fechaVencimiento)}`;
        document.getElementById("pago-monto").value = cuota.monto;
        abrirModal("modal-pago");
      });
    }
    return div;
  }

  function pintarCuentaCard(clienteId, cuentaId, cuenta) {
    const div = document.createElement("div");
    div.className = "cuenta-card";
    const pagado = redondear2(cuenta.montoTotal - cuenta.saldoPendiente);
    const porcentaje = cuenta.montoTotal > 0 ? Math.min(100, Math.round((pagado / cuenta.montoTotal) * 100)) : 0;
    div.innerHTML = `
      <div class="ca-header">
        <div>
          <h4>${escaparHtml(cuenta.articulo || "Artículo")}</h4>
          <div class="ca-fecha">Desde ${formatoFecha(cuenta.fechaInicio)}</div>
        </div>
        <div class="ca-header-acciones">
          <span class="badge ${cuenta.estado === "pagada" ? "badge-pagada" : "badge-activa"}">${cuenta.estado === "pagada" ? "Pagada" : "Activa"}</span>
          <button class="icon-btn-mini btn-editar-cuenta" title="Editar cuenta">✎</button>
        </div>
      </div>
      <div class="progreso-barra"><div class="progreso-relleno" style="width:${porcentaje}%;"></div></div>
      <div class="ca-montos">
        <span>Pagado: <strong>${formatoMoneda(pagado)}</strong></span>
        <span>Pendiente: <strong>${formatoMoneda(cuenta.saldoPendiente)}</strong></span>
      </div>
      <div class="lista-cuotas" id="cuotas-${cuentaId}"></div>
    `;

    div.querySelector(".btn-editar-cuenta").addEventListener("click", () => {
      cuentaEditando = { clienteId, cuentaId };
      document.getElementById("ecu-articulo").value = cuenta.articulo || "";
      document.getElementById("ecu-costo").value = cuenta.costo ?? "";
      abrirModal("modal-editar-cuenta");
    });

    const cuotasEl = div.querySelector(`#cuotas-${cuentaId}`);
    const unsubCuotas = onSnapshot(
      query(collection(db, "clientes", clienteId, "cuentas", cuentaId, "cuotas"), orderBy("numero")),
      (snap) => {
        cuotasEl.innerHTML = "";
        snap.forEach((d) => cuotasEl.appendChild(pintarCuota(clienteId, cuentaId, { id: d.id, ...d.data() })));
      }
    );
    unsubListeners.push(unsubCuotas);

    return div;
  }

  abrirDetalleImpl = function abrirDetalle(clienteId) {
    limpiarListeners();
    clienteActualId = clienteId;

    const clienteRef = doc(db, "clientes", clienteId);
    const unsubCliente = onSnapshot(clienteRef, (snap) => {
      if (!snap.exists()) return;
      const cliente = snap.data();
      clienteActualData = cliente;
      dcNombre.textContent = cliente.nombre || "—";
      dcTelefono.textContent = cliente.telefono || "Sin teléfono";
      dcSaldo.textContent = formatoMoneda(cliente.saldoPendiente || 0);
    });
    unsubListeners.push(unsubCliente);

    const unsubCuentas = onSnapshot(
      query(collection(db, "clientes", clienteId, "cuentas"), orderBy("creadoEn", "desc")),
      (snap) => {
        cuentasClienteEl.innerHTML = "";
        if (snap.empty) {
          cuentasClienteEl.innerHTML = `<div class="vacio"><div class="vacio-ico">🛍️</div><h3>Sin cuentas todavía</h3><p>Toca ＋ para registrar la primera compra a cuotas.</p></div>`;
          return;
        }
        snap.forEach((d) => cuentasClienteEl.appendChild(pintarCuentaCard(clienteId, d.id, d.data())));
      }
    );
    unsubListeners.push(unsubCuentas);
  };

  // ---------------- Registrar pago ----------------

  formPago.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pagoContexto) return;
    const monto = redondear2(parseFloat(document.getElementById("pago-monto").value));
    const metodoPago = document.getElementById("pago-metodo").value;
    if (!monto || monto <= 0) return;

    const { clienteId, cuentaId, cuotaId } = pagoContexto;
    const cuentaRef = doc(db, "clientes", clienteId, "cuentas", cuentaId);
    const cuotaRef = doc(db, "clientes", clienteId, "cuentas", cuentaId, "cuotas", cuotaId);
    const clienteRef = doc(db, "clientes", clienteId);

    const btn = formPago.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await runTransaction(db, async (tx) => {
        const cuentaSnap = await tx.get(cuentaRef);
        if (!cuentaSnap.exists()) throw new Error("Cuenta no encontrada");
        const cuenta = cuentaSnap.data();
        const nuevoSaldoCuenta = Math.max(0, redondear2((cuenta.saldoPendiente || 0) - monto));
        const nuevoEstado = nuevoSaldoCuenta <= 0 ? "pagada" : "activa";

        tx.update(cuotaRef, {
          pagado: true,
          fechaPago: new Date().toISOString().slice(0, 10),
          metodoPago,
          montoPagado: monto
        });
        tx.update(cuentaRef, { saldoPendiente: nuevoSaldoCuenta, estado: nuevoEstado });
        tx.update(clienteRef, { saldoPendiente: increment(-monto) });
      });

      formPago.reset();
      cerrarModal("modal-pago");
      mostrarToast("Pago registrado");
      pagoContexto = null;
      avisarCambio();
    } catch (err) {
      console.error("Error registrando pago:", err);
      mostrarToast("No se pudo registrar el pago");
    } finally {
      btn.disabled = false;
    }
  });

  // ---------------- Cierre genérico de modales ----------------

  document.querySelectorAll("[data-cerrar-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".modal-fondo").classList.remove("abierto");
    });
  });

  document.querySelectorAll(".modal-fondo").forEach((fondo) => {
    fondo.addEventListener("click", (e) => {
      if (e.target === fondo) fondo.classList.remove("abierto");
    });
  });
}

export function irADetalle(clienteId) {
  if (abrirDetalleImpl) abrirDetalleImpl(clienteId);
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}
