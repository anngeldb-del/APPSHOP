// ============================================================
// modules/dashboard.js
// KPIs generales: clientes registrados, cuentas activas/totales
// y saldo pendiente total. Se apoya en collectionGroup + consultas
// de agregación (count/sum) para no tener que leer todos los
// documentos en el navegador.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection,
  collectionGroup,
  query,
  where,
  getCountFromServer,
  getAggregateFromServer,
  sum
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { formatoMoneda } from "../utils.js";

export function render(container, user) {
  const kpisEl = container.querySelector("#dashboard-kpis");
  const clientesTotalEl = container.querySelector("#dashboard-clientes-total");
  const cuentasTotalEl = container.querySelector("#dashboard-cuentas-total");
  const versionEl = container.querySelector("#version-app");

  versionEl.textContent = "1.0.0";

  async function cargarKpis() {
    kpisEl.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Clientes</div><div class="kpi-valor">…</div></div>
      <div class="kpi-card"><div class="kpi-label">Cuentas activas</div><div class="kpi-valor">…</div></div>
      <div class="kpi-card"><div class="kpi-label">Saldo pendiente</div><div class="kpi-valor">…</div></div>
      <div class="kpi-card"><div class="kpi-label">Cuentas totales</div><div class="kpi-valor">…</div></div>
    `;

    try {
      const clientesRef = collection(db, "clientes");
      const cuentasRef = collectionGroup(db, "cuentas");
      const cuentasActivasQuery = query(cuentasRef, where("estado", "==", "activa"));

      const [clientesCount, cuentasCount, cuentasActivasCount, saldoAgg] = await Promise.all([
        getCountFromServer(clientesRef),
        getCountFromServer(cuentasRef),
        getCountFromServer(cuentasActivasQuery),
        getAggregateFromServer(clientesRef, { total: sum("saldoPendiente") })
      ]);

      const totalClientes = clientesCount.data().count;
      const totalCuentas = cuentasCount.data().count;
      const cuentasActivas = cuentasActivasCount.data().count;
      const saldoPendiente = saldoAgg.data().total || 0;

      kpisEl.innerHTML = `
        <div class="kpi-card"><div class="kpi-label">Clientes</div><div class="kpi-valor">${totalClientes}</div></div>
        <div class="kpi-card"><div class="kpi-label">Cuentas activas</div><div class="kpi-valor">${cuentasActivas}</div></div>
        <div class="kpi-card"><div class="kpi-label">Saldo pendiente</div><div class="kpi-valor">${formatoMoneda(saldoPendiente)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Cuentas totales</div><div class="kpi-valor">${totalCuentas}</div></div>
      `;

      clientesTotalEl.textContent = totalClientes;
      cuentasTotalEl.textContent = `${cuentasActivas} / ${totalCuentas}`;
    } catch (err) {
      console.error("Error cargando KPIs:", err);
      kpisEl.innerHTML = `<div class="kpi-card" style="grid-column:1/-1;">No se pudieron cargar los datos.</div>`;
    }
  }

  document.addEventListener("datos:cambiaron", cargarKpis);
  cargarKpis();
}
