# Plan 006: Reportes de bodega

## Decisión
Tres tipos de reporte (Inventario de bodega, Prealertas pendientes, Estado de cuenta) armados en el backend a partir de una sola fuente: la lista de paquetes con su **etapa** y su **prealerta de origen**. Para que la prealerta sepa "llegaron X de Y" aunque los paquetes se consoliden, cada paquete guarda desde ahora el id de la prealerta donde se avisó (`prealertaOrigenId`), que nunca se cambia al mover el paquete.

La pantalla web pide primero el tipo, luego los filtros de ese tipo, muestra un resumen previo que viene del mismo backend que genera el PDF (así no pueden diferir) y al final descarga PDF o CSV con `fetch`.

## Pasos
1. **Base de datos:** columna opcional `prealertaOrigenId` en `Paquete`, con relación a `Envio` (`onDelete: SetNull`) e índice.
2. **Migración `20261127000000_paquete_prealerta_origen`:** crea la columna, el índice y la relación, y rellena el origen de los paquetes que hoy siguen dentro de una prealerta real (tipo ALERTA cuya tienda no sea "Sin prealerta" ni "Devuelto a bodega"). No borra ni mueve nada.
3. **Repositorios (Prisma y memoria):** el paquete expone `prealertaOrigenId`; `crear` y `agregarPaquetes` lo llenan cuando el envío es una prealerta real; `moverPaquetes` no lo toca; `actualizarPaquete` acepta cambiarlo. Nuevo método `paquetesPorOrigen(prealertaIds)` que devuelve esos paquetes con el estado y tipo del envío donde están ahora.
4. **Servicio de envíos:** al reclamar un paquete sin dueño desde una prealerta, se guarda esa prealerta como su origen; la asignación manual del personal deja el origen vacío.
5. **Dominio puro `reportes.ts`:** `etapaDePaquete(...)` (las siete etapas de la spec), `armarInventario`, `armarPrealertasPendientes`, `armarEstadoDeCuenta`, cada uno con su resumen. Sin acceso a datos: reciben listas y devuelven la estructura del reporte. Reemplaza a `informeBodega.ts`.
6. **Servicio `ReporteService`:** junta los datos (envíos en bodega, prealertas activas, paquetes por origen, consolidados del cliente y entregados recientes), valida filtros y tipo, y llama al dominio. Exige sesión de personal.
7. **Archivos:** el PDF reutiliza la banda de marca, tarjetas de resumen, tabla con filas alternas y pie de página que ya existen, con una sección por tipo. El CSV reutiliza `aCsv` con una fila por paquete.
8. **Rutas:** `GET /api/staff/reportes/:tipo` (resumen y detalle en JSON para la pantalla), `GET /api/staff/reportes/:tipo.pdf` y `.csv`. Se quita `/api/staff/bodega/exportar.pdf`; `/api/staff/bodega/exportar.csv` se deja como está.
9. **Web:** `ReporteBodega.tsx` se rehace: selector de tipo (tres tarjetas), filtros según tipo, pastillas de filtros activos con "Limpiar todo", resumen previo, botones PDF/CSV y enlace a Envíos en el estado de cuenta. Todo el estado en la dirección web.
10. **Pruebas:** dominio (las siete etapas, "llegaron X de Y" con paquetes consolidados, despachados y descartados, listas vacías), migración en memoria, rutas (sin sesión de personal → 401, nombres de archivo), CSV/PDF sin datos sensibles, y la pantalla (cambio de tipo, filtros en la URL, estado de cuenta sin cliente).

## Opciones descartadas
- **No guardar el origen:** por prealerta solo se podría decir qué falta, no cuántos llegaron, que es justo lo que se pidió.
- **Deducir el origen de los hitos del paquete:** los hitos guardan la etapa y la fecha, no el envío; no alcanza.
- **Tabla aparte con el historial de movimientos de cada paquete:** resuelve más de lo que se necesita y agrega escrituras en cada movimiento.
- **Un solo reporte con muchos filtros:** es lo que hoy confunde; el operador no sabe qué combinación responde su pregunta.
- **Calcular el resumen previo en el navegador:** podría no coincidir con el PDF; se pide al mismo backend.

## Riesgos
- La migración toca Supabase real: respaldo antes y aplicarla una sola vez con `npm run db:deploy -w backend`. La columna es opcional, así que el código viejo sigue funcionando mientras tanto.
- Los paquetes consolidados antes del cambio no tienen origen: el reporte los cuenta aparte como "sin registro de prealerta" para no dar números falsos.
- Los reportes cargan los envíos activos en memoria del servidor, igual que hoy la pantalla de Bodega; con el volumen actual alcanza. Si crece mucho, se pasa el filtrado a la base de datos.
- Una prealerta cuyo envío de origen se borre deja `prealertaOrigenId` vacío (no rompe nada).
