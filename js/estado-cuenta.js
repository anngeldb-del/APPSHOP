// ============================================================
// estado-cuenta.js
// Arma el texto del estado de cuenta de un cliente (cuotas
// pendientes por cuenta activa + saldo total). Lo usan tanto el
// botón individual en el detalle de cliente como el envío masivo
// (modules/clientes.js y modules/envios.js), para no duplicar la
// misma lectura de Firestore en dos lugares.
// ============================================================

import { db, collection, doc, getDoc, getDocs, query, where, orderBy } from "./conexion.js";
import { formatoMoneda, formatoFecha } from "./utils.js";

export async function armarMensajeEstadoCuenta(clienteId) {
  const clienteSnap = await getDoc(doc(db, "clientes", clienteId));
  if (!clienteSnap.exists()) return null;
  const cliente = clienteSnap.data();

  const cuentasSnap = await getDocs(
    query(collection(db, "clientes", clienteId, "cuentas"), where("estado", "==", "activa"))
  );

  const lineas = [];
  for (const cuentaDoc of cuentasSnap.docs) {
    const cuenta = cuentaDoc.data();
    const cuotasSnap = await getDocs(
      query(
        collection(db, "clientes", clienteId, "cuentas", cuentaDoc.id, "cuotas"),
        where("pagado", "==", false),
        orderBy("numero")
      )
    );
    if (cuotasSnap.empty) continue;
    lineas.push(`*${cuenta.articulo}* (pendiente ${formatoMoneda(cuenta.saldoPendiente)}):`);
    cuotasSnap.forEach((cuotaDoc) => {
      const cuota = cuotaDoc.data();
      lineas.push(`  Pago ${cuota.numero}/${cuenta.numCuotas} — ${formatoMoneda(cuota.monto)} — vence ${formatoFecha(cuota.fechaVencimiento)}`);
    });
  }

  return {
    nombre: cliente.nombre || "",
    telefono: cliente.telefono || "",
    saldoPendiente: cliente.saldoPendiente || 0,
    mensaje: [
      `Hola ${cliente.nombre || ""}, este es tu estado de cuenta con Nene's Shopping USA:`,
      "",
      ...(lineas.length ? lineas : ["No tienes pagos pendientes por ahora. ¡Gracias!"]),
      "",
      `Saldo total pendiente: ${formatoMoneda(cliente.saldoPendiente || 0)}`,
      "",
      "Gracias por tu preferencia."
    ].join("\n")
  };
}
