# Tareas 006 · Reportes de bodega

Una tarea a la vez, con sus pruebas unitarias. La casilla se marca solo cuando Luis confirma que la prueba manual pasó. Rama: `informe-bodega-pdf`. Todo se prueba con `npm run dev`, en el teléfono y en la laptop; no se despliega a Netlify para probar.

## Ya hecho en la primera versión (se reutiliza)
- `pdfkit` instalado; PDF con marca (franja azul, tarjetas de resumen, tabla con filas alternas, pie con número de página, una sola hoja si cabe).
- Descarga con `fetch` y mensaje de error en pantalla; pastillas de filtros activos con "Limpiar todo"; botón único "Generar reporte" en Bodega y botón "Volver a bodega".

## Parte 1 · Origen de cada paquete
- **T-1** Agregar `prealertaOrigenId` a `Paquete` en `schema.prisma` y la migración `20261127000000_paquete_prealerta_origen` que crea la columna, el índice, la relación y rellena el origen de los paquetes que siguen en una prealerta real. Cubre: RF-6, RF-8. Hecho cuando: la migración corre en una base local limpia y los paquetes de prealertas existentes quedan con su origen. `[ ] Hecha y probada`
- **T-2** Exponer y guardar el origen en los repositorios de Prisma y memoria (`crear`, `agregarPaquetes`, `actualizarPaquete`), sin que `moverPaquetes` lo cambie, y agregar `paquetesPorOrigen`. Cubre: RF-6. Hecho cuando: una prueba crea una prealerta, consolida sus paquetes y el origen sigue igual. `[ ] Hecha y probada`
- **T-3** Guardar el origen al reclamar un paquete sin dueño desde una prealerta, y dejarlo vacío en la asignación manual. Cubre: RF-7. Hecho cuando: pruebas de los dos caminos pasan. `[ ] Hecha y probada`

## Parte 2 · Dominio de reportes
- **T-4** Crear `domain/reportes.ts` con `etapaDePaquete` y sus pruebas para las siete etapas, más descartados y cancelados (que no aparecen). Cubre: etapas de la spec. Hecho cuando: cada etapa tiene su prueba y pasan. `[ ] Hecha y probada`
- **T-5** `armarInventario` con resumen por etapa, sin avisar, peso total y filtros (cliente, etapa, días, solo sin avisar). Cubre: RF-9, RF-10, RF-11, RF-20. Hecho cuando: pruebas de caso feliz, lista vacía y filtros combinados pasan. `[ ] Hecha y probada`
- **T-6** `armarPrealertasPendientes` con "llegaron X de Y", trackings que faltan, días desde el aviso y resumen; los paquetes sin origen registrado se cuentan aparte. Cubre: RF-12, RF-13, RF-14, RF-8. Hecho cuando: una prueba con una prealerta de 5 (3 consolidados y despachados, 2 por llegar) dice "3 de 5" y lista los 2. `[ ] Hecha y probada`
- **T-7** `armarEstadoDeCuenta` con totales por etapa y detalle de prealertas, bodega y consolidados abiertos; entregados solo dentro de la ventana de días acordada. Cubre: RF-15, RF-16, RF-17. Hecho cuando: pruebas con un cliente en todas las etapas cuadran los totales. `[ ] Hecha y probada`

## Parte 3 · Servicio, archivos y rutas
- **T-7b** Aplicar el periodo (desde/hasta) en los tres armadores del dominio: por fecha de llegada, de aviso o de entrega según el reporte, y rechazar un rango invertido. Cubre: RF-17, RF-24, RF-25, RF-26. Hecho cuando: pruebas con paquetes dentro y fuera del rango, rango de un solo día y rango invertido pasan. `[ ] Hecha y probada`
- **T-8** `ReporteService`: junta los datos, valida tipo y filtros, exige sesión de personal y llama al dominio. Cubre: RF-22. Hecho cuando: pruebas con repositorios en memoria devuelven los tres reportes y rechazan a un cliente. `[ ] Hecha y probada`
- **T-9** PDF de los tres tipos reutilizando el diseño actual, con aviso "sin resultados" cuando no hay datos. Cubre: RF-18, RF-20, RF-23. Hecho cuando: se genera un PDF válido por tipo, en una hoja si cabe, y ninguno trae cédula, teléfono ni dirección. `[ ] Hecha y probada`
- **T-10** CSV de los tres tipos con una fila por paquete. Cubre: RF-18, RF-23. Hecho cuando: pruebas revisan columnas y que no haya datos sensibles. `[ ] Hecha y probada`
- **T-11** Rutas `/api/staff/reportes/:tipo`, `.pdf` y `.csv` con nombres de archivo acordados; quitar `/api/staff/bodega/exportar.pdf`. Cubre: RF-19, RF-22. Hecho cuando: sin sesión de personal responden 401 y con sesión entregan el archivo con el nombre correcto. `[ ] Hecha y probada`

## Parte 4 · Pantalla
- **T-12** Rehacer `ReporteBodega.tsx`: selector de tipo con frase corta, filtros según tipo, buscador de clientes, periodo con "Desde", "Hasta" y atajos de 30, 60 y 90 días, pastillas y "Limpiar todo", todo en la URL. Cubre: RF-1, RF-2, RF-4, RF-5, RF-24, RF-26. Hecho cuando: al cambiar de tipo cambian los filtros, y al recargar se conserva todo. `[ ] Hecha y probada`
- **T-13** Resumen previo desde `/api/staff/reportes/:tipo`, estado de cuenta bloqueado sin cliente (con el motivo a la vista) y enlace a Envíos del cliente. Cubre: RF-3, RF-15, RF-17. Hecho cuando: el resumen en pantalla coincide con el del PDF y sin cliente no se puede descargar el estado de cuenta. `[ ] Hecha y probada`
- **T-14** Descarga PDF/CSV de los tres tipos con error visible si falla. Cubre: RF-18, RF-21. Hecho cuando: los seis archivos bajan con su nombre y una sesión vencida muestra el mensaje. `[ ] Hecha y probada`

## Parte 5 · Cierre
- **T-15** Prueba manual con `npm run dev` en teléfono y laptop siguiendo "Cómo sé que está listo" de `spec.md`. Cubre: RF-1 a RF-23. Hecho cuando: todos los puntos se cumplen. `[ ] Hecha y probada`
