// ============================================================
// modules/dashboard.js
// KPIs generales (clientes, cuentas, saldo pendiente, inversión y
// ganancia) más el desglose de ganancia por mes con gráfica, y la
// descarga del reporte general en CSV.
//
// Clientes/cuentas activas/saldo usan consultas de agregación de
// Firestore (count/sum) para no leer todo. La inversión, la
// ganancia y el desglose mensual sí necesitan leer cada cuenta
// (Firestore no soporta "group by" en agregaciones) — para un
// negocio de este tamaño es aceptable; si el volumen de cuentas
// crece mucho, convendría precalcular esto con una Cloud Function.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  getCountFromServer,
  getAggregateFromServer,
  sum
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { formatoMoneda, formatoMonedaCorta, etiquetaMes, ultimosMeses, descargarCSV, mostrarToast } from "../utils.js";
import { graficaBarras } from "../charts.js";

function redondear2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// Lee todas las cuentas (collectionGroup) y calcula inversión,
// ganancia y ganancia agrupada por mes ("YYYY-MM" -> monto).
// Las cuentas sin costo capturado no entran (no se puede saber su
// ganancia).
async function calcularFinanzas() {
  const snap = await getDocs(collectionGroup(db, "cuentas"));
  let inversionTotal = 0;
  let gananciaTotal = 0;
  const porMes = new Map();

  snap.forEach((d) => {
    const c = d.data();
    if (c.costo == null || !c.creadoEn?.toDate) return;
    const ganancia = redondear2((c.montoTotal || 0) - c.costo);
    inversionTotal = redondear2(inversionTotal + c.costo);
    gananciaTotal = redondear2(gananciaTotal + ganancia);

    const fecha = c.creadoEn.toDate();
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    porMes.set(clave, redondear2((porMes.get(clave) || 0) + ganancia));
  });

  return { inversionTotal, gananciaTotal, porMes };
}

export function render(container, user) {
  const kpisEl = container.querySelector("#dashboard-kpis");
  const clientesTotalEl = container.querySelector("#dashboard-clientes-total");
  const cuentasTotalEl = container.querySelector("#dashboard-cuentas-total");
  const versionEl = container.querySelector("#version-app");
  const graficaEl = container.querySelector("#dashboard-grafica-ganancia");
  const listaGananciaEl = container.querySelector("#dashboard-ganancia-lista");
  const btnReporte = container.querySelector("#btn-descargar-reporte");

  versionEl.textContent = "1.1.0";

  // se guarda el último cálculo para no repetir la lectura de cuentas
  // cuando el usuario le da a "Descargar reporte" justo después de cargar
  let ultimasFinanzas = null;

  async function cargarDashboard() {
    kpisEl.innerHTML = Array(6)
      .fill('<div class="kpi-card"><div class="kpi-label">…</div><div class="kpi-valor">…</div></div>')
      .join("");
    graficaEl.innerHTML = "";
    listaGananciaEl.innerHTML = "";

    try {
      const clientesRef = collection(db, "clientes");
      const cuentasRef = collectionGroup(db, "cuentas");
      const cuentasActivasQuery = query(cuentasRef, where("estado", "==", "activa"));

      const [clientesCount, cuentasCount, cuentasActivasCount, saldoAgg, finanzas] = await Promise.all([
        getCountFromServer(clientesRef),
        getCountFromServer(cuentasRef),
        getCountFromServer(cuentasActivasQuery),
        getAggregateFromServer(clientesRef, { total: sum("saldoPendiente") }),
        calcularFinanzas()
      ]);

      ultimasFinanzas = finanzas;

      const totalClientes = clientesCount.data().count;
      const totalCuentas = cuentasCount.data().count;
      const cuentasActivas = cuentasActivasCount.data().count;
      const saldoPendiente = saldoAgg.data().total || 0;

      kpisEl.innerHTML = `
        <div class="kpi-card"><div class="kpi-label">Clientes</div><div class="kpi-valor">${totalClientes}</div></div>
        <div class="kpi-card"><div class="kpi-label">Cuentas activas</div><div class="kpi-valor">${cuentasActivas}</div></div>
        <div class="kpi-card kpi-card--alerta"><div class="kpi-label">Saldo pendiente</div><div class="kpi-valor">${formatoMoneda(saldoPendiente)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Cuentas totales</div><div class="kpi-valor">${totalCuentas}</div></div>
        <div class="kpi-card kpi-card--dorado"><div class="kpi-label">Inversión total</div><div class="kpi-valor">${formatoMoneda(finanzas.inversionTotal)}</div></div>
        <div class="kpi-card kpi-card--exito"><div class="kpi-label">Ganancia total</div><div class="kpi-valor">${formatoMoneda(finanzas.gananciaTotal)}</div></div>
      `;

      clientesTotalEl.textContent = totalClientes;
      cuentasTotalEl.textContent = `${cuentasActivas} / ${totalCuentas}`;

      const meses = ultimosMeses(6);
      const etiquetas = meses.map((m) => etiquetaMes(m.anio, m.mes));
      const valores = meses.map((m) => finanzas.porMes.get(m.clave) || 0);

      graficaBarras(graficaEl, { etiquetas, valores, formateador: formatoMonedaCorta });

      listaGananciaEl.innerHTML = meses
        .map((m, i) => `<div class="resumen-cuenta"><span>${etiquetaMes(m.anio, m.mes)}</span><strong>${formatoMoneda(valores[i])}</strong></div>`)
        .join("");
    } catch (err) {
      console.error("Error cargando el dashboard:", err);
      kpisEl.innerHTML = `<div class="kpi-card" style="grid-column:1/-1;">No se pudieron cargar los datos.</div>`;
    }
  }

  btnReporte.addEventListener("click", async () => {
    btnReporte.disabled = true;
    btnReporte.textContent = "Generando…";
    try {
      const [clientesSnap, finanzas] = await Promise.all([
        getDocs(query(collection(db, "clientes"), orderBy("nombreBusqueda"))),
        ultimasFinanzas ? Promise.resolve(ultimasFinanzas) : calcularFinanzas()
      ]);

      const filasClientes = [];
      clientesSnap.forEach((d) => {
        const c = d.data();
        filasClientes.push([c.nombre || "", c.telefono || "", (c.saldoPendiente || 0).toFixed(2)]);
      });

      const meses = ultimosMeses(6);
      const filasGanancia = meses.map((m) => [etiquetaMes(m.anio, m.mes), (finanzas.porMes.get(m.clave) || 0).toFixed(2)]);

      const filas = [
        ["Reporte Nene's Shopping USA", new Date().toLocaleDateString("es-MX")],
        [],
        ["Clientes"],
        ["Nombre", "Teléfono", "Saldo pendiente"],
        ...filasClientes,
        [],
        ["Ganancia por mes"],
        ["Mes", "Ganancia"],
        ...filasGanancia,
        [],
        ["Resumen"],
        ["Inversión total", finanzas.inversionTotal.toFixed(2)],
        ["Ganancia total", finanzas.gananciaTotal.toFixed(2)]
      ];

      descargarCSV(`reporte-nenes-shopping-${new Date().toISOString().slice(0, 10)}.csv`, filas);
      mostrarToast("Reporte descargado");
    } catch (err) {
      console.error("Error generando el reporte:", err);
      mostrarToast("No se pudo generar el reporte");
    } finally {
      btnReporte.disabled = false;
      btnReporte.textContent = "⬇ Descargar reporte (Excel / CSV)";
    }
  });

  document.addEventListener("datos:cambiaron", cargarDashboard);
  cargarDashboard();
}
