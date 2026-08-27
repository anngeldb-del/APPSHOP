// ============================================================
// utils.js
// Helpers compartidos entre módulos: formato de dinero/fechas,
// toast de notificación, debounce para el buscador, exportar CSV
// y armar enlaces de WhatsApp.
// ============================================================

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function formatoMoneda(valor) {
  const n = Number(valor) || 0;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Versión compacta para espacios chicos (gráficas): $1.2K en vez de $1,200.00
export function formatoMonedaCorta(valor) {
  const n = Number(valor) || 0;
  if (Math.abs(n) >= 1000) {
    return "$" + (n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "K";
  }
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function sumarDias(fechaISO, dias) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setDate(fecha.getDate() + dias);
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "Ago 26" a partir de un año y un mes 0-indexado
export function etiquetaMes(anio, mesIndex) {
  return `${MESES_CORTOS[mesIndex]} ${String(anio).slice(2)}`;
}

// Últimos n meses (incluyendo el actual), del más viejo al más reciente.
export function ultimosMeses(n) {
  const hoy = new Date();
  const meses = [];
  for (let i = n - 1; i >= 0; i--) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({
      clave: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`,
      anio: f.getFullYear(),
      mes: f.getMonth()
    });
  }
  return meses;
}

let toastTimeout = null;
export function mostrarToast(mensaje) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = mensaje;
  toast.classList.add("mostrar");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("mostrar"), 2600);
}

export function debounce(fn, espera = 300) {
  let temporizador = null;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), espera);
  };
}

// Descarga un reporte como CSV (Excel lo abre directamente). Se eligió CSV
// y no un .xlsx real para no meter una librería externa al PWA: el stack
// del proyecto es HTML/JS puro sin build step, y CSV con BOM UTF-8 abre
// perfecto en Excel con acentos y todo.
export function descargarCSV(nombreArchivo, filas) {
  const escapar = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const contenido = filas.map((fila) => fila.map(escapar).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Arma un link de WhatsApp Click-to-Chat. Asume número de EE.UU./Canadá
// (10 dígitos -> antepone "1"); si el teléfono ya trae lada internacional
// completa, se manda tal cual.
export function urlWhatsApp(telefono, mensaje) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  const numero = digitos.length === 10 ? "1" + digitos : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
