# 006 Reportes de bodega (PDF y CSV)

## El qué y el porqué
El cliente necesita sacar reportes que respondan preguntas concretas de la bodega, no una lista plana de paquetes:
- De una prealerta: cuántos paquetes tenía, cuántos llegaron y cuáles faltan.
- De un cliente: cuánto le falta por llegar, cuánto tiene en bodega, cuánto está consolidado esperando pago o despacho, y cuánto ya salió.
- De la bodega completa: qué hay físicamente, qué está sin dueño, sin avisar o lleva muchos días.

La primera versión (una lista de paquetes con filtros encima) resultó vaga: no mostraba la prealerta, ni la etapa de cada paquete, ni cuántos llegaron de cuántos. Además, al consolidar, el paquete se muda de su prealerta y hoy no queda guardado de dónde vino, así que la prealerta "olvida" lo que ya llegó.

Por eso el reporte se arma como en los CRM: primero se elige qué pregunta se quiere responder (tipo de reporte), después los filtros y al final el formato.

## Etapas de un paquete
Vocabulario único que usan los tres reportes:
- **Por llegar**: prealertado y todavía no ha llegado a la oficina.
- **En bodega**: llegó, tiene dueño y aún no está consolidado.
- **Sin dueño**: llegó pero no se sabe de quién es.
- **Esperando pago**: está dentro de un consolidado que se está armando, por pagar o con el pago en revisión.
- **Listo para salir**: su consolidado está pagado y aún no se despacha.
- **En ruta**: despachado a Venezuela.
- **Entregado**: el envío se cerró como entregado.

Los paquetes descartados o de envíos cancelados no aparecen en ningún reporte.

## Requisitos

### Pantalla
- RF-1: EL SISTEMA mostrará en Bodega un solo botón "Generar reporte" que lleva a una pantalla propia, con un botón para volver a Bodega.
- RF-2: EL SISTEMA pedirá primero el tipo de reporte entre tres opciones (Inventario de bodega, Prealertas pendientes, Estado de cuenta de un cliente), cada una con una frase corta de qué responde; después mostrará solo los filtros que aplican a ese tipo, y al final los botones de PDF y CSV.
- RF-3: EL SISTEMA mostrará antes de descargar un resumen de lo que saldrá en el reporte (los mismos totales que trae el resumen del PDF), para que el operador vea si es lo que quiere.
- RF-4: EL SISTEMA mostrará cada filtro activo como una pastilla con su propia opción de quitarlo, más un "Limpiar todo" cuando haya al menos uno. Tipo de reporte y filtros quedan en la dirección web, así que no se pierden al recargar.
- RF-5: EL SISTEMA permitirá elegir el cliente con el buscador de clientes que ya usa el panel (nombre, casillero, correo o cédula).

### Origen de cada paquete
- RF-6: EL SISTEMA guardará en cada paquete la prealerta en la que el cliente lo avisó, y ese dato no cambiará cuando el paquete se consolide, se desarme el consolidado o se despache.
- RF-7: CUANDO un paquete llegue sin prealerta y después un cliente lo reclame al registrar su prealerta, EL SISTEMA guardará esa prealerta como su origen. SI el personal asigna a mano un paquete sin dueño, ENTONCES el paquete quedará como "sin prealerta". [Asumido, el dueño puede cambiarlo]
- RF-8: CUANDO se aplique este cambio, EL SISTEMA guardará como origen la prealerta actual de cada paquete que todavía esté dentro de una prealerta real. Los paquetes que ya estaban consolidados antes del cambio quedarán sin origen registrado y el reporte los contará aparte como "sin registro de prealerta".

### Inventario de bodega
- RF-9: EL SISTEMA listará todo lo que está físicamente en la oficina (En bodega, Sin dueño, Esperando pago, Listo para salir), agrupado por cliente; por cada paquete: tracking, etapa, prealerta de origen (tienda y fecha), peso, días en bodega, avisado y foto.
- RF-10: EL SISTEMA mostrará arriba un resumen con el total de paquetes, el peso total y cuántos hay en cada etapa, más cuántos están sin avisar.
- RF-11: EL SISTEMA permitirá filtrar este reporte por cliente, por etapa, por días en bodega (7, 15 o 30 o más) y por "solo sin avisar".

### Prealertas pendientes
- RF-12: EL SISTEMA listará las prealertas que tienen al menos un paquete por llegar, agrupadas por cliente; por cada prealerta: tienda, fecha del aviso, días desde el aviso, "llegaron X de Y" y la lista de trackings que faltan.
- RF-13: EL SISTEMA mostrará arriba un resumen con cuántas prealertas están pendientes, cuántos paquetes faltan por llegar en total y cuántos clientes tienen algo pendiente.
- RF-14: EL SISTEMA permitirá filtrar este reporte por cliente. No se marca ninguna prealerta como "atrasada"; solo se muestran los días desde el aviso.

### Estado de cuenta de un cliente
- RF-15: EL SISTEMA exigirá elegir un cliente para este reporte; sin cliente elegido, los botones de descarga no se activan y la pantalla dice por qué.
- RF-16: EL SISTEMA mostrará los totales del cliente por etapa (Por llegar, En bodega, Esperando pago, Listo para salir, En ruta, Entregado) y el detalle: sus prealertas con "llegaron X de Y" y lo que falta, sus paquetes en bodega y sus consolidados que aún no se entregan, con su estado.
- RF-17: Los entregados se mostrarán solo de los últimos [NECESITA ACLARACIÓN: ¿cuántos días hacia atrás? propuesta: 30] días; para todo su historial, la pantalla y el PDF indicarán que está en Envíos, y la pantalla tendrá el enlace a Envíos filtrado por ese cliente.

### Descarga
- RF-18: EL SISTEMA generará los tres reportes en PDF (con la marca, resumen arriba y detalle agrupado) y en CSV (una fila por paquete, con las mismas columnas que el detalle), al momento y sin guardarlos en el servidor.
- RF-19: Los archivos se llamarán `inventario-AAAA-MM-DD`, `prealertas-pendientes-AAAA-MM-DD` y `estado-de-cuenta-CASILLERO-AAAA-MM-DD`, con su extensión.
- RF-20: SI ningún paquete cumple los filtros, ENTONCES EL SISTEMA generará igual el archivo, con el resumen en cero y un aviso de "sin resultados".
- RF-21: SI la descarga falla (por ejemplo, la sesión venció), ENTONCES EL SISTEMA mostrará un mensaje claro en la pantalla en vez de no hacer nada.
- RF-22: EL SISTEMA solo permitirá ver o descargar reportes a una sesión de personal (operador o administrador).
- RF-23: Ningún reporte incluirá datos sensibles del cliente (cédula, teléfono, dirección, datos de entrega); solo nombre y casillero.

## Cómo sé que está listo
- En Bodega veo un solo botón "Generar reporte"; me lleva a la pantalla de reportes y "Volver a bodega" me regresa.
- Elijo "Prealertas pendientes" con un cliente que tiene una prealerta de 5 paquetes donde llegaron 3 (aunque ya los haya consolidado): el reporte dice "llegaron 3 de 5" y lista los 2 trackings que faltan, con los días desde el aviso.
- Elijo "Inventario de bodega": veo todo lo físico agrupado por cliente, con la etapa de cada paquete, y el resumen por etapa cuadra con la lista.
- Elijo "Estado de cuenta", sin cliente no puedo descargar y la pantalla me dice que elija uno; con cliente veo sus totales por etapa, sus prealertas y el enlace a su historial en Envíos.
- Pongo filtros, recargo la página y siguen ahí con su pastilla; los quito uno a uno o con "Limpiar todo".
- El resumen que veo en pantalla antes de descargar coincide con el resumen del PDF.
- Descargo cada tipo en PDF y CSV: los nombres de archivo siguen el formato acordado y el PDF cabe en una sola hoja cuando hay pocos datos.
- Con filtros que no encuentran nada, el archivo se genera con el aviso de "sin resultados".
- Con la sesión vencida, la pantalla muestra el error en vez de no hacer nada; sin sesión de personal, las rutas responden "no autorizado".
- Ningún PDF ni CSV trae cédula, teléfono ni dirección.
- Las pruebas automáticas del proyecto pasan.

## Fuera de alcance
- Marcar prealertas como "atrasadas".
- Mandar reportes por WhatsApp o correo, o programarlos para que salgan solos.
- Reportes de dinero (cobros, pagos, totales en dólares).
- Que el cliente vea su estado de cuenta desde su propia cuenta.
- Recuperar la prealerta de origen de los paquetes que ya estaban consolidados antes de este cambio.
- Cambiar o quitar la descarga CSV de la lista de Envíos.
