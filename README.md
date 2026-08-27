# Nene's Shopping USA — Cuentas y Cuotas

PWA en HTML/JS puro (ES6 modules, sin build) para llevar clientes, artículos vendidos a
cuotas y sus pagos. Firebase Auth + Firestore como backend. Desarrollado por Code-Reset
(Ing. Luis Ángel Díaz Bernal) sobre el boilerplate base de Code-Reset.

## Antes de usarla en producción

1. Crear el proyecto en Firebase Console (Auth con método Correo/Contraseña + Firestore).
2. Editar `js/firebase-config.js` con el `firebaseConfig` real del proyecto.
3. Crear en Firebase Auth los usuarios del personal que va a usar la app (no hay registro
   público, solo login).
4. Desplegar `firestore.rules` y `firestore.indexes.json` (Firebase Console, o `firebase
   deploy --only firestore:rules,firestore:indexes` con Firebase CLI). Los índices son
   necesarios porque el dashboard hace consultas de grupo de colecciones
   (`collectionGroup`) sobre `cuentas`, y el envío de estado de cuenta por WhatsApp filtra
   `cuotas` pendientes ordenadas por número.
5. Activar GitHub Pages (Settings → Pages → rama `main`, carpeta `/root`) o el hosting que
   se use para desplegar.
6. Subir `CACHE_VERSION` en `service-worker.js` cada vez que se toque el shell base
   (index.html, css/styles.css, o cualquier archivo listado en `CORE_ASSETS`).

## Modelo de datos (Firestore)

```
clientes/{clienteId}
  nombre, nombreBusqueda (nombre en minúsculas, para buscar), telefono, direccion, notas,
  saldoPendiente (suma de saldoPendiente de sus cuentas), creadoEn

clientes/{clienteId}/cuentas/{cuentaId}
  articulo, montoTotal, costo (opcional), numCuotas, fechaInicio, frecuenciaDias,
  montoCuota, saldoPendiente, estado ("activa" | "pagada"), creadoEn

clientes/{clienteId}/cuentas/{cuentaId}/cuotas/{cuotaId}
  numero, fechaVencimiento, monto, pagado, fechaPago, metodoPago, montoPagado

clientes/{clienteId}/pagos/{pagoId}
  cuentaId, articulo, cuotaId, cuotaNumero, monto, metodoPago, fecha, creadoEn
```

`pagos` es un registro aparte de las cuotas: cada vez que se registra un pago se crea aquí
una ficha permanente (además de marcar la cuota como pagada), para poder ver el historial
completo de un cliente sin depender de que la cuota "recuerde" su propio pago.

`saldoPendiente` en cliente y cuenta se mantiene con transacciones/`increment()` al crear
una cuenta o registrar un pago — no se recalcula leyendo todo cada vez.

## Módulos

- `js/modules/dashboard.js`: KPIs generales (clientes, cuentas activas/totales, saldo
  pendiente, inversión y ganancia totales) usando consultas de agregación
  (`getCountFromServer` / `getAggregateFromServer`), más el desglose de ganancia de los
  últimos 6 meses (gráfica + lista) y la descarga del reporte general en CSV. La inversión,
  la ganancia y el desglose mensual se calculan leyendo cada cuenta en el cliente (Firestore
  no soporta "group by" en agregaciones) — para el volumen de un negocio así es aceptable;
  si crece mucho conviene precalcularlo con una Cloud Function.
- `js/modules/clientes.js`: lista de clientes con búsqueda y paginación, alta y edición de
  cliente (con notas libres), detalle de cliente (cuentas + cuotas + historial de pagos),
  alta y edición de cuenta con generador de calendario de cuotas, registro de pagos, y el
  envío del estado de cuenta al cliente por WhatsApp (Click-to-Chat, sin backend adicional).
- `js/modules/envios.js`: envío masivo de estados de cuenta — lista a los clientes con
  saldo pendiente, dejas marcados a quién enviarle, y arma una fila para ir uno por uno.
- `js/charts.js`: gráfica de barras en SVG puro, sin librerías externas.
- `js/tema.js`: modo oscuro/claro con preferencia guardada en `localStorage`; el `<head>`
  de `index.html` aplica el tema antes de pintar para no parpadear.
- `js/utils.js`: formato de dinero/fechas, toast, debounce, exportar CSV y armar enlaces de
  WhatsApp.
- `js/estado-cuenta.js`: arma el texto del estado de cuenta de un cliente (lo comparten el
  botón individual del detalle de cliente y el envío masivo, para no leer Firestore dos veces
  con la misma lógica).

## Reportes y WhatsApp

- **Reporte (Dashboard → "Descargar reporte")**: genera un CSV con la lista de clientes y
  su saldo, la ganancia de los últimos 6 meses, e inversión/ganancia totales. Se eligió CSV
  (con BOM UTF-8, abre directo en Excel) y no un `.xlsx` real para no meter una librería
  externa al PWA — el stack del proyecto es HTML/JS puro sin build step.
- **Estado de cuenta por WhatsApp (detalle de cliente)**: arma un mensaje con las cuotas
  pendientes de cada cuenta activa y abre `wa.me` con el texto precargado. Asume números de
  EE.UU./Canadá (antepone "1" a números de 10 dígitos); si se opera en otro país hay que
  ajustar `urlWhatsApp()` en `js/utils.js`.
- **Envío masivo (menú → "Envío masivo")**: WhatsApp Click-to-Chat solo abre un chat por
  clic — no existe una forma legítima de disparar varios mensajes a la vez desde el
  navegador sin la API de negocio de pago de Meta, y automatizarlo sin que la persona lo
  inicie viola los términos de WhatsApp y arriesga que los números queden marcados como
  spam. Por eso esta pantalla arma una fila con los clientes seleccionados (por defecto,
  todos los que tienen saldo pendiente y teléfono) y deja un botón "Enviar" por cliente:
  sigue siendo mucho más rápido que ir a buscar a cada uno manualmente, pero cada mensaje
  lo abre la propia persona con un clic. Si más adelante quieres automatización real
  (recordatorios programados, sin intervención manual), eso ya requiere la API oficial de
  WhatsApp Business y un backend — es un cambio de stack que hay que platicar aparte.

## Editar y eliminar

- **Cliente** (detalle de cliente → ✎): edita nombre, teléfono y dirección. Eliminar solo
  se permite si el cliente no tiene ninguna cuenta registrada — así no se puede borrar
  historial de ventas/pagos sin querer; si tiene cuentas, hay que eliminarlas primero.
- **Cuenta** (tarjeta de la cuenta → ✎): edita artículo y costo (para la ganancia). El
  monto total, número de cuotas y el calendario no se editan ahí a propósito — cambiarlos
  después de generadas las cuotas es ambiguo (¿se recalculan las que ya se pagaron?); si
  están mal, se elimina la cuenta y se crea de nuevo. Eliminar una cuenta borra sus cuotas
  y descuenta lo que le quedaba pendiente del saldo del cliente.

Ambas eliminaciones piden confirmación (`confirm()` del navegador — nativo, sin componente
nuevo) porque no se pueden deshacer.

## Notas, historial de pagos y respaldo

- **Notas por cliente**: campo libre en el alta y edición de cliente (ej. "vive cerca del
  mercado", "paga en efectivo", "difícil de localizar por las tardes"). Se muestra en el
  detalle del cliente solo cuando tiene algo escrito.
- **Historial de pagos** (detalle de cliente, sección colapsable): los últimos 20 pagos del
  cliente, con artículo, cuota, fecha, monto y método — lee la subcolección `pagos`, no las
  cuotas, así que no se pierde nada aunque una cuota ya solo muestre su último estado.
- **Exportar respaldo completo** (Dashboard → "Exportar respaldo completo (JSON)"): descarga
  un `.json` con todos los clientes y, anidado, sus cuentas, cuotas y pagos — un respaldo de
  verdad, no solo el resumen que trae el reporte CSV. Como recorre todo Firestore
  (cliente → cuentas → cuotas/pagos) tarda unos segundos si hay muchos clientes; para un
  negocio de este tamaño es aceptable, pero si crece mucho convendría moverlo a una Cloud
  Function que arme el respaldo del lado del servidor.

## Cómo agregar un módulo nuevo

1. Copia `js/modules/dashboard.js` y renómbralo.
2. Escribe su lógica y su propio `render(container, user)`.
3. Regístralo en `js/router.js` dentro del arreglo `MODULES` (y agrega su pantalla/nav si
   aplica en `index.html`).

## Reglas de Firestore

Ya incluidas en `firestore.rules`: solo usuarios autenticados leen/escriben, todo pasa por
`autenticado()` (recordando el bug real de NEXORA: una función de permisos que existía
pero nunca se llamaba, y todos terminaban con acceso de admin). Si más adelante se
necesitan roles (ej. cajero vs. administrador), agregar un campo de rol en el documento del
usuario y validarlo explícitamente en cada `match`, no dejarlo como función sin usar.
