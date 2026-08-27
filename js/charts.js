// ============================================================
// charts.js
// Gráfica de barras en SVG puro (sin librerías externas) para no
// meter una dependencia nueva solo por una gráfica — encaja con
// el stack "sin build step" del proyecto y funciona offline.
// ============================================================

export function graficaBarras(contenedor, { etiquetas, valores, formateador = (v) => v }) {
  const ancho = 320;
  const alto = 170;
  const margenInferior = 26;
  const margenSuperior = 24;
  const n = Math.max(1, valores.length);
  const max = Math.max(1, ...valores.map((v) => Math.abs(v)));
  const espacio = ancho / n;
  const anchoBarra = Math.min(38, espacio * 0.5);

  const barras = valores
    .map((v, i) => {
      const alturaDisponible = alto - margenInferior - margenSuperior;
      const alturaBarra = Math.max((alturaDisponible * Math.abs(v)) / max, v === 0 ? 0 : 3);
      const x = i * espacio + (espacio - anchoBarra) / 2;
      const y = alto - margenInferior - alturaBarra;
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${anchoBarra.toFixed(1)}" height="${alturaBarra.toFixed(1)}" rx="4" class="barra-ganancia" />
        <text x="${(x + anchoBarra / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="barra-valor">${formateador(v)}</text>
        <text x="${(x + anchoBarra / 2).toFixed(1)}" y="${alto - 8}" text-anchor="middle" class="barra-etiqueta">${etiquetas[i] ?? ""}</text>
      `;
    })
    .join("");

  contenedor.innerHTML = `
    <svg viewBox="0 0 ${ancho} ${alto}" class="grafica-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ganancia por mes">
      <defs>
        <linearGradient id="gradiente-barra-ganancia" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" class="grad-inicio" />
          <stop offset="100%" class="grad-fin" />
        </linearGradient>
      </defs>
      <line x1="0" y1="${alto - margenInferior}" x2="${ancho}" y2="${alto - margenInferior}" class="grafica-eje" />
      ${barras}
    </svg>
  `;
}
