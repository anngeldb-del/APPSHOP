# Demo standalone — Nene's Shopping USA

`index.html` en esta carpeta es una versión **de demostración**, autocontenida en un solo
archivo, para mandarle a alguien y que la pruebe sin depender de Firebase.

## Qué es

Es el mismo código de la app real (mismo HTML/CSS/JS, mismo diseño) pero con Firebase
reemplazado por una base de datos y una sesión simuladas **en memoria, dentro del propio
archivo** — no hay backend, no hay red (salvo Google Fonts, que si no hay internet cae a
una fuente del sistema). Trae 8 clientes de ejemplo ya cargados con cuentas, cuotas y
pagos, para que el dashboard, las gráficas y los reportes se vean con datos reales desde
que se abre.

## Cómo usarlo

1. Abrir `index.html` — funciona haciendo doble clic (sirve directo desde el disco, sin
   servidor) o subiéndolo a cualquier hosting estático.
2. En el login, cualquier correo y contraseña funcionan (dice "Modo demo" debajo del
   botón).
3. Todo es funcional de verdad: crear/editar/eliminar clientes y cuentas, registrar pagos,
   cambiar de tema, envío masivo (abre WhatsApp real con el mensaje armado, aunque el
   número sea ficticio), descargar el reporte CSV y el respaldo JSON — esos dos si bajan
   archivos reales con los datos de ejemplo.
4. Recargar la página reinicia todo a los datos de ejemplo originales — es la forma de
   "resetear" el demo.

## Cómo se genera

`build_demo.py` (no incluido en el repo, se corrió una vez a mano) toma `index.html`,
`css/styles.css` y los módulos de `js/` reales, les quita los `import`/`export` (ya no
hacen falta al quedar todo en un solo archivo) y les inyecta un mock de Firestore + Auth
en memoria más los datos de ejemplo. Si el código real cambia y hace falta un demo
actualizado, hay que regenerarlo — este archivo no se actualiza solo.

**Este archivo es solo para mostrar la app — no es lo que se despliega en producción.**
La app real vive en la raíz del repo y sí necesita Firebase configurado
(`js/firebase-config.js`) para funcionar.
