# 006 Informe de bodega en PDF

## El qué y el porqué
Hoy la pantalla de Bodega solo se puede descargar como CSV (una tabla cruda para abrir en Excel). El cliente pidió poder descargar un informe para saber qué hay en bodega, cuánto tiene cada cliente y cuánto falta por llegar, en un documento que se pueda leer o imprimir directamente: un PDF.

El informe reutiliza los mismos datos y filtros que ya tiene la pantalla de Bodega (buscar, sin dueño, sin avisar, días en bodega), así que descargarlo filtrado por un cliente puntual ya sirve como "inventario de ese cliente".

## Requisitos

- RF-1: EL SISTEMA generará un informe de bodega en PDF a partir de los mismos filtros que ya existen en la pantalla de Bodega (búsqueda, sin dueño, sin avisar, días en bodega).
- RF-2: EL SISTEMA mostrará, al inicio del PDF, un resumen con el total de paquetes, el peso total, cuántos están sin dueño y cuántos sin avisar.
- RF-3: EL SISTEMA agrupará el detalle del PDF por cliente, mostrando debajo de cada cliente sus paquetes (tracking, peso, recibido, días en bodega, avisado, foto, tipo de envío) y el subtotal de paquetes y peso de ese cliente.
- RF-4: CUANDO el operador marque la opción "Incluir lo que falta por llegar", EL SISTEMA agregará también, dentro de cada cliente, los paquetes prealertados que aún no han llegado a la bodega, mostrados como "Esperado" en vez de fecha de recibido, y sumará su cantidad al resumen por separado del total ya recibido.
- RF-5: EL SISTEMA no incluirá en el PDF ningún dato sensible del cliente (cédula, teléfono, dirección); solo nombre y número de casillero, igual que el CSV actual.
- RF-6: CUANDO se pulse "Descargar PDF" en la pantalla de Bodega, EL SISTEMA generará el archivo al momento (no se guarda en el servidor) y lo entregará con nombre `bodega-AAAA-MM-DD.pdf`.
- RF-7: SI ningún paquete cumple los filtros pedidos, ENTONCES EL SISTEMA generará igual el PDF, con el resumen en cero y un aviso de "sin paquetes" en vez de la tabla vacía.
- RF-8: EL SISTEMA solo permitirá descargar este informe a una sesión de personal (operador o administrador), igual que el resto de la pantalla de Bodega.
- RF-9: EL SISTEMA mostrará un solo botón "Generar reporte" en la pantalla de Bodega (en vez de dos botones de descarga sueltos), que lleva a una pantalla propia con sus propios filtros (buscar, sin dueño, sin avisar, días en bodega), la elección de formato (PDF o CSV) y la opción "Incluir lo que falta por llegar", para que el operador pueda armar el reporte que quiera (incluyendo el de un solo cliente) sin tener que adivinar entre varios botones ni ir y volver a Bodega. La opción de incluir lo que falta por llegar aplica a los dos formatos. Esa pantalla arranca con los filtros que traía Bodega y tiene un botón para volver con los filtros que queden puestos.
- RF-10: SI la descarga del reporte falla (por ejemplo, la sesión venció), ENTONCES EL SISTEMA mostrará un mensaje claro de error en la pantalla, en vez de quedarse en silencio sin descargar nada.
- RF-11: EL SISTEMA permitirá elegir un cliente puntual en la pantalla de reporte con el mismo buscador de clientes (autocompletar por nombre, casillero, correo o cédula) que ya se usa en el resto del panel, en vez de solo un cuadro de texto libre. Al elegir un cliente, el reporte queda limitado a sus paquetes (en bodega y, si se marca, los que le faltan por llegar).
- RF-12: CUANDO haya un cliente elegido, EL SISTEMA mostrará un enlace a su historial completo (incluyendo lo ya despachado y entregado) en la pantalla de Envíos, que ya existe y permite buscar por cliente con todos los estados.
- RF-13: EL SISTEMA mostrará, cuando haya al menos un filtro activo (cliente, mostrar, días, incluir lo que falta por llegar), una pastilla por cada uno con su propia opción de quitarlo solo a él, más un enlace "Limpiar todo". Todos los filtros de esta pantalla (incluido "incluir lo que falta por llegar") quedan en la dirección web, para que no se pierdan ni queden sin forma de quitarlos si se recarga la página.

## Cómo sé que está listo
- Entro a Bodega sin ningún filtro y pulso "Descargar PDF": se descarga un PDF con el resumen arriba y todos los paquetes agrupados por cliente, con su subtotal.
- Filtro por "sin avisar" (o "sin dueño", o días) antes de descargar: el PDF trae solo esos paquetes.
- Busco un cliente por nombre o casillero y descargo: el PDF sale solo con los paquetes de ese cliente, como su inventario.
- Marco "Incluir lo que falta por llegar" y descargo: el PDF también muestra, dentro de cada cliente, los paquetes que aún no llegan, marcados "Esperado".
- Si el filtro no encuentra ningún paquete, el PDF se genera igual, sin romperse, con el aviso de "sin paquetes".
- Si intento la descarga sin haber iniciado sesión como personal, la respuesta es "no autorizado".
- Veo un solo botón "Generar reporte"; al pulsarlo entro a una pantalla con sus propios filtros, PDF, CSV y la casilla de "lo que falta por llegar", sin botones sueltos adicionales, y con un botón para volver a Bodega con los filtros que queden puestos.
- Desde esa pantalla elijo un cliente con el buscador (no escribo texto libre) y descargo: el reporte sale solo con los paquetes de ese cliente, sin tener que volver a Bodega.
- Con un cliente elegido, veo un enlace a su historial completo en Envíos, y al abrirlo veo también lo que ya se le despachó o entregó.
- Con cualquier filtro puesto, veo su pastilla con su propia opción de quitarlo, y un "Limpiar todo". Si recargo la página con un filtro puesto, la pastilla y la opción de quitarlo siguen ahí (no se pierden).
- Si fuerzo un error en la descarga (por ejemplo, con la sesión vencida), la pantalla muestra un mensaje de error en vez de no hacer nada.
- Las pruebas automáticas del proyecto pasan.

## Fuera de alcance
- Mandar el PDF automáticamente por WhatsApp o correo (el operador lo descarga y decide qué hacer con él).
- Programar el envío periódico del informe (por ejemplo, todos los lunes).
- Reporte financiero (cobros, pagos, totales en dólares); este informe es solo del inventario físico.
- Cambiar o quitar el CSV que ya existe; el PDF se agrega aparte.
