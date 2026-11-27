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

## Cómo sé que está listo
- Entro a Bodega sin ningún filtro y pulso "Descargar PDF": se descarga un PDF con el resumen arriba y todos los paquetes agrupados por cliente, con su subtotal.
- Filtro por "sin avisar" (o "sin dueño", o días) antes de descargar: el PDF trae solo esos paquetes.
- Busco un cliente por nombre o casillero y descargo: el PDF sale solo con los paquetes de ese cliente, como su inventario.
- Marco "Incluir lo que falta por llegar" y descargo: el PDF también muestra, dentro de cada cliente, los paquetes que aún no llegan, marcados "Esperado".
- Si el filtro no encuentra ningún paquete, el PDF se genera igual, sin romperse, con el aviso de "sin paquetes".
- Si intento la descarga sin haber iniciado sesión como personal, la respuesta es "no autorizado".
- Las pruebas automáticas del proyecto pasan.

## Fuera de alcance
- Mandar el PDF automáticamente por WhatsApp o correo (el operador lo descarga y decide qué hacer con él).
- Programar el envío periódico del informe (por ejemplo, todos los lunes).
- Reporte financiero (cobros, pagos, totales en dólares); este informe es solo del inventario físico.
- Cambiar o quitar el CSV que ya existe; el PDF se agrega aparte.
