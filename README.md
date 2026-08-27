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
   deploy --only firestore:rules,firestore:indexes` con Firebase CLI). El índice de
   `estado` en `cuentas` es necesario porque el dashboard hace una consulta de grupo de
   colecciones (`collectionGroup`) filtrando por ese campo.
5. Activar GitHub Pages (Settings → Pages → rama `main`, carpeta `/root`) o el hosting que
   se use para desplegar.
6. Subir `CACHE_VERSION` en `service-worker.js` cada vez que se toque el shell base
   (index.html, css/styles.css, o cualquier archivo listado en `CORE_ASSETS`).

## Modelo de datos (Firestore)

```
clientes/{clienteId}
  nombre, nombreBusqueda (nombre en minúsculas, para buscar), telefono, direccion,
  saldoPendiente (suma de saldoPendiente de sus cuentas), creadoEn

clientes/{clienteId}/cuentas/{cuentaId}
  articulo, montoTotal, costo (opcional), numCuotas, fechaInicio, frecuenciaDias,
  montoCuota, saldoPendiente, estado ("activa" | "pagada"), creadoEn

clientes/{clienteId}/cuentas/{cuentaId}/cuotas/{cuotaId}
  numero, fechaVencimiento, monto, pagado, fechaPago, metodoPago, montoPagado
```

`saldoPendiente` en cliente y cuenta se mantiene con transacciones/`increment()` al crear
una cuenta o registrar un pago — no se recalcula leyendo todo cada vez.

## Módulos

- `js/modules/dashboard.js`: KPIs generales (clientes, cuentas activas/totales, saldo
  pendiente) usando consultas de agregación (`getCountFromServer` / `getAggregateFromServer`).
- `js/modules/clientes.js`: lista de clientes con búsqueda y paginación, alta de cliente,
  detalle de cliente (cuentas + cuotas), alta de cuenta con generador de calendario de
  cuotas, y registro de pagos.

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
