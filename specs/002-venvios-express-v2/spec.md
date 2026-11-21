# 002 · Venvios Express: del casillero a la entrega

Estado: BORRADOR para aprobar. Reemplaza a `001-recepcion-y-despacho`, que queda solo como historia.

## Qué es y por qué

Venvios Express es un **casillero internacional**: el cliente compra en Shein, AliExpress, Amazon u otra tienda y la compra llega a la oficina de Cúcuta (Av. 3 #8-03, piso 2, local 02, Barrio Latino). Allí se escanea, se guarda en la bodega con su dueño, se agrupa con otros paquetes del mismo cliente (consolidar), se pesa, se cobra en dólares (el cliente puede pagar en Bs a la tasa BCV) y se entrega a una transportista venezolana (MRW o Zoom) que lo lleva hasta el cliente.

Todo lo hace una persona a mano. No hay bot ni mensajes automáticos: el sistema deja el mensaje de WhatsApp listo y abre el chat; la persona lo envía.

Además hay una página pública con la información de la empresa, las tarifas y un rastreador que lleva al sitio de MRW o de Zoom.

## El recorrido completo

1. El cliente se registra y recibe su **casillero** (`VENV-123456`). En su **perfil** guarda sus datos de entrega para MRW o Zoom.
2. Hace su **prealerta**: número de guía, valor declarado de cada paquete y tienda de origen.
3. Llega el paquete a la oficina. El operador lo **escanea**; el sistema dice de quién es y lo deja «En oficina», ya con su cliente.
4. El cliente ve en su cuenta qué paquetes llegaron, elige varios, escoge MRW o Zoom y la modalidad. Sus datos de entrega salen de su perfil, sin volver a escribirlos. Eso es la **solicitud de consolidación**.
5. El operador ve la solicitud, **pesa**, revisa los valores declarados y el seguro (puede corregirlos) y le manda la **cotización** por WhatsApp con el enlace de la página para pagar.
6. El cliente **paga** (pago móvil o Binance) y sube su comprobante. El envío queda «Pago en revisión».
7. El operador verifica en su banco y **aprueba**. El envío queda «Enviando a Venezuela».
8. Llegan las etiquetas. El operador registra la **guía de MRW o Zoom con su foto** y el envío queda «En ruta».
9. El cliente confirma «Ya lo recibí» y el envío queda «Entregado».

En todo el recorrido, el cliente ve el **seguimiento de cada paquete** con sus pasos y fechas.

## Quién lo usa

- **Visitante**: cualquier persona que entra a la página pública. No tiene cuenta.
- **Cliente**: puede haber miles. Tiene cuenta propia y solo ve lo suyo.
- **Operador**: personal de la oficina. Usa el teléfono para escanear y tomar fotos, y la PC para cotizar, cobrar y enviar mensajes por WhatsApp Web.
- **Administrador**: hace todo lo del operador y además corrige errores después del pago, cambia tarifas y datos de pago, y gestiona al personal. No se fija cuántos operadores ni administradores habrá.

## Requisitos

### Página pública

- **RF-1** EL SISTEMA mostrará una página pública, sin detalles de cómo trabaja la oficina por dentro (no se explica el escaneo ni los medios de pago concretos; se dice solo «realiza tu pago en bolívares»), con: quiénes son, la tabla de tarifas vigente, la nota «Pagos en Bs a tasa BCV», la dirección de la oficina, el WhatsApp de atención y las redes sociales.
- **RF-2** EL SISTEMA mostrará un rastreador donde el visitante elige una transportista de una lista. No pedirá número de guía.
- **RF-3** CUANDO el visitante pulse «Rastrear», EL SISTEMA abrirá en otra pestaña la página oficial de rastreo de esa transportista. El visitante escribe su número de guía allí.
- **RF-4** EL SISTEMA no consultará a las transportistas por su cuenta: solo redirige.
- **RF-5** CUANDO el visitante pulse el botón de WhatsApp, EL SISTEMA abrirá un chat con el número de atención y un mensaje inicial ya escrito.
- **RF-6** EL SISTEMA mostrará en la página pública una calculadora donde el visitante escribe los kilos y el valor declarado, y ve el precio estimado en $ y en Bs.

### Cuentas y acceso

- **RF-7** EL SISTEMA pedirá correo o número de casillero y contraseña para entrar. El personal entra al panel y el cliente a su cuenta.
- **RF-8** SI alguien falla la contraseña 5 veces seguidas, ENTONCES EL SISTEMA bloqueará ese intento por 10 minutos. Los intentos se recuerdan en la base de datos, para que el bloqueo valga aunque el servidor tenga varias copias.
- **RF-9** EL SISTEMA tendrá tres tipos de usuario: cliente, operador y administrador. Cada uno ve y hace solo lo suyo. Cualquier cantidad de cada tipo.
- **RF-10** EL SISTEMA permitirá al cliente registrarse solo desde la página con: nombre y apellido, número de cédula (solo el número, sin foto), correo, teléfono de WhatsApp (selector de país con Venezuela por defecto y el número de ejemplo `4241234567` como guía) y contraseña repetida dos veces. No necesita que un operador lo cree.
- **RF-11** EL SISTEMA exigirá contraseñas de al menos 8 caracteres, con una mayúscula y un carácter especial, mostrará en vivo cuáles requisitos se cumplen y permitirá ver y ocultar la contraseña. No dejará registrar si las dos contraseñas no coinciden.
- **RF-12** EL SISTEMA dará a cada cliente al registrarse un número de casillero único con la forma `VENV-123456` (seis dígitos al azar). SI el número ya existe, ENTONCES EL SISTEMA generará otro hasta encontrar uno libre.
- **RF-13** SI la cédula, el correo o el teléfono ya están registrados, ENTONCES EL SISTEMA no creará una segunda cuenta y le indicará cómo recuperar la suya.
- **RF-14** EL SISTEMA guardará la cédula cifrada (se puede recuperar con una llave del servidor) y la mostrará completa solo al administrador y al operador cuando prepare un despacho; en listas y registros internos aparece parcial (por ejemplo `V-***678`).
- **RF-15** SI un cliente olvida su contraseña, ENTONCES EL SISTEMA permitirá que un operador o administrador le asigne una temporal (sin correo ni SMS automático, para no pagar mensajería). SI un operador intenta poner una clave temporal a una cuenta del personal, ENTONCES EL SISTEMA lo impedirá: solo el administrador puede hacerlo.
- **RF-16** CUANDO alguien cambia su contraseña, recibe una clave temporal o se desactiva su cuenta, EL SISTEMA cerrará sus sesiones abiertas en otros equipos.
- **RF-17** EL SISTEMA permitirá al administrador crear, desactivar y cambiar la contraseña de los usuarios del personal.
- **RF-18** EL SISTEMA creará, al sembrar la base, una cuenta de administrador y una de operador de prueba tomadas de las variables de entorno. Sus claves nunca van en el código ni en el repositorio.

### Cuenta del cliente

- **RF-19** EL SISTEMA mostrará al cliente un menú con: Inicio, Mis envíos, Rastrear, Consolidar y Finanzas, y un acceso a su Perfil. En la PC el menú se abre con un botón y aparece encima del contenido, sin moverlo; se cierra al elegir una opción o al tocar fuera. En el teléfono se mantiene la barra inferior.
- **RF-20** EN Inicio, EL SISTEMA mostrará su número de casillero, la dirección de envío de su casillero, cómo enviar sus compras a esa dirección y contadores de sus paquetes.
- **RF-21** EN Mis envíos, la pestaña «Pre-alertas» reemplaza a la antigua sección Alertas: lista cada tracking del cliente que aún no está consolidado, con estado «Prealertado» mientras no llega y «En oficina» cuando ya llegó, con el botón «Crear alerta» y la opción de eliminar una alerta que aún no llega.
- **RF-22** EN Mis envíos, EL SISTEMA mostrará tres pestañas: «Pre-alertas» (RF-21), «Activos» (consolidaciones que aún no se entregan) y «Entregados». Cada fila muestra solo: guía (el tracking en Pre-alertas o «Consolidación» con su número en las otras), estado, fecha, valor declarado y total en dólares (sin bolívares). La guía es un enlace que abre Rastrear con ese envío, igual que el botón «Rastrear». No se muestran tipo, destinatario, contenido ni peso. En el teléfono las filas se ven como tarjetas.
- **RF-23** EN Finanzas, EL SISTEMA listará los envíos por pagar, para pagarlos y subir el comprobante, y el historial de pagos.
- **RF-24** EL SISTEMA mostrará en el panel del cliente un botón flotante de WhatsApp hacia la atención. No mostrará rastreador dentro de la cuenta.
- **RF-25** UN cliente solo verá sus propios envíos, paquetes, fotos y comprobantes.

### Prealertas

- **RF-26** EL SISTEMA permitirá registrar una prealerta con: uno o varios números de tracking (el que trae el paquete, el mismo del código de barras), **el valor declarado en dólares de cada paquete** y la tienda de origen. El cliente la registra desde su cuenta; el operador puede registrarla en nombre de un cliente.
- **RF-27** SI el número de tracking de una prealerta ya existe, ENTONCES EL SISTEMA avisará y mostrará la prealerta existente en vez de duplicarla.
- **RF-28** CUANDO el operador escriba un nombre, un teléfono o un casillero ya registrado, EL SISTEMA sugerirá el cliente existente para no volver a escribir sus datos.
- **RF-29** EL SISTEMA permitirá al cliente eliminar la alerta de un paquete que aún no llegó. Las alertas pendientes no vencen.
- **RF-30** CUANDO un cliente registre una alerta con un tracking igual al de un paquete sin dueño, EL SISTEMA lo unirá a su alerta como ya recibido y lo dejará en el historial.

### Recepción con el teléfono

- **RF-31** EL SISTEMA permitirá escanear con la cámara del teléfono cualquier código de barras o QR de la etiqueta del paquete (todos los formatos que la cámara pueda leer). SI la etiqueta trae un QR y un código de barras con el mismo número, ENTONCES EL SISTEMA aceptará cualquiera de los dos sin pedir elegir.
- **RF-32** CUANDO un código aparezca en la cámara, EL SISTEMA lo leerá, mostrará el resultado y apagará la cámara sola, para no repetir la misma lectura. El operador vuelve a encenderla con «Escanear siguiente paquete». La guía en pantalla servirá tanto para QR (cuadrado) como para códigos de barras.
- **RF-33** CUANDO se lea un código, EL SISTEMA mostrará el resultado en la parte de arriba de la pantalla del teléfono, sin obligar al operador a bajar para verlo.
- **RF-34** EL SISTEMA permitirá tomar o subir una foto de la etiqueta y leerá el código que haya en la imagen. SI la foto no tiene un código legible, ENTONCES EL SISTEMA lo dirá y dejará escribir el número a mano.
- **RF-35** EL SISTEMA permitirá escribir el tracking a mano cuando el código no se pueda leer.
- **RF-36** SI el teléfono no permite usar la cámara, ENTONCES EL SISTEMA dejará la búsqueda manual disponible y explicará por qué no abrió la cámara.
- **RF-37** EL SISTEMA guardará el texto exacto que leyó el escáner y, para buscar, comparará ignorando espacios, ceros a la izquierda y prefijos comunes.
- **RF-38** CUANDO el código leído trae más dígitos que el número de una prealerta (caso Coordinadora: el cliente escribió el impreso `01234567890.1` y el código dice `701234567890001`), EL SISTEMA reconocerá el paquete si el código contiene ese número, siempre que el número de la prealerta tenga al menos 8 caracteres. Para números con forma `base.pieza`, la pieza se completa a 3 dígitos (`.1` equivale a `001`). SI el código coincide con más de un paquete esperado, ENTONCES EL SISTEMA no marcará ninguno y pedirá escribir el número completo.
- **RF-39** CUANDO se lea un tracking con prealerta, EL SISTEMA marcará el paquete como «En oficina» automáticamente, lo guardará con su cliente y mostrará el nombre del cliente y cuántos paquetes de su alerta faltan.
- **RF-40** SI se escanea un paquete que ya fue recibido, ENTONCES EL SISTEMA avisará que ya está registrado y no lo duplicará.
- **RF-41** EL SISTEMA no pedirá el peso de cada paquete: el peso se registra una sola vez, el del consolidado completo (RF-53), en kilos con dos decimales exactos. No se usa peso volumétrico.
- **RF-42** EL SISTEMA permitirá tomar una foto del paquete en la misma pantalla del escaneo, justo después de recibirlo. La foto es opcional y se ve después en la lista de paquetes del envío; no se toma desde la pantalla de consolidar.
- **RF-43** EL SISTEMA permitirá avisar al cliente por WhatsApp de cada paquete que llega. El mensaje dice que llegó, cuántos paquetes de su alerta ya llegaron y cuántos faltan, y que entre a su cuenta para consolidar. No incluye el total a pagar.
- **RF-44** EL SISTEMA abrirá WhatsApp Web en la PC y la aplicación de WhatsApp en el teléfono con el mensaje ya escrito. Guardará que el aviso se abrió, con fecha y usuario. No puede saber si el mensaje se envió de verdad, así que el operador lo confirma con un botón.

### Bodega

- **RF-45** EL SISTEMA guardará cada paquete escaneado en la bodega, con su dueño o como «sin dueño», y mostrará al personal todo lo que está físicamente en la oficina (en oficina y aún no despachado), con su antigüedad. Se podrá filtrar «sin dueño» y buscar por tracking, cliente o número de casillero.
- **RF-46** CUANDO un paquete llegue sin prealerta, EL SISTEMA permitirá al operador asignarlo en el momento con el número de casillero `VENV-` o buscando al cliente por nombre, correo o cédula, o dejarlo sin dueño.
- **RF-47** EL SISTEMA no sugerirá dueños por parecido de tracking. Si no hay coincidencia exacta, el paquete queda sin dueño hasta que alguien lo reclame. No se publica una lista de paquetes sin dueño a los clientes.
- **RF-48** EL SISTEMA permitirá al operador o al administrador cambiar el dueño de un paquete en bodega (o devolverlo a sin dueño), con un motivo opcional que queda en el historial.
- **RF-49** EL SISTEMA permitirá al operador o al administrador descartar un paquete o un envío con un motivo obligatorio. Los casos especiales (paquete dañado, equivocado, devoluciones, pagos de más) se acuerdan con el cliente por WhatsApp y el sistema solo registra la decisión.

### Consolidación y cotización

- **RF-50** EL SISTEMA permitirá al cliente elegir, entre sus paquetes en bodega, cuáles se envían juntos (consolidar), con la transportista (MRW o Zoom) y la modalidad; los datos de entrega salen de su perfil (RF-51). El valor declarado del envío es la **suma de los valores declarados de los paquetes elegidos** y el cliente lo ve antes de enviar la solicitud. El envío queda «Por consolidar».
- **RF-51** CUANDO el cliente solicite una consolidación, EL SISTEMA copiará al envío los datos de entrega de su perfil para la transportista elegida (quién recibe, agencia, ciudad y estado). SI esos datos están incompletos, ENTONCES EL SISTEMA no enviará la solicitud y llevará al cliente a completar su perfil. Lo copiado queda fijo en el envío: cambiar el perfil después no cambia envíos ya solicitados. El operador puede corregirlo mientras el envío no haya salido.
- **RF-52** EL SISTEMA permitirá al operador ver las solicitudes de consolidación, consolidar en nombre del cliente cuando lo acuerdan por WhatsApp (si el perfil del cliente no tiene los datos de entrega, pueden quedar para después), y agregar o quitar paquetes de un consolidado antes del pago.
- **RF-53** CUANDO el operador elija la modalidad de cobro y registre el peso total del consolidado, EL SISTEMA calculará el seguro de carga automáticamente y el total en dólares y en Bs a la tasa del día, y el envío pasará a «Por pagar».
- **RF-54** SI cambian los paquetes de un consolidado ya pesado, ENTONCES EL SISTEMA borrará el total y lo devolverá a «Por consolidar» hasta pesarlo de nuevo.
- **RF-55** EL SISTEMA permitirá al cliente o al personal deshacer un consolidado que aún no tiene pagos; sus paquetes vuelven a la bodega del cliente.
- **RF-56** ANTES de que el envío tenga un pago registrado, EL SISTEMA permitirá al operador editar el valor declarado de cada paquete y el monto del seguro (que viene calculado por defecto), con un motivo obligatorio. Se guarda el valor anterior, quién lo cambió y cuándo (RF-81). CUANDO se edite, EL SISTEMA recalculará el total. El operador podrá volver el seguro a automático.
- **RF-57** EL SISTEMA permitirá solo al administrador corregir a mano el precio, el peso o el valor declarado de un envío que ya tiene un pago registrado, con un motivo obligatorio. Se guarda el valor anterior y quién lo cambió (RF-81). Esa corrección aparece solo para el administrador, solo con pago registrado y al final de la pantalla del envío; el operador no la ve.
- **RF-58** CUANDO el operador pulse «Enviar cotización», EL SISTEMA abrirá el chat del cliente con el mensaje ya escrito: el peso, el valor declarado, el seguro, el total en $ y en Bs, y el enlace de la página para registrar su pago.

### Pago

- **RF-59** EL SISTEMA mostrará al cliente, en su cuenta, el total a pagar en dólares (y en Bs al cambio del día) y los datos para pagar por Binance o por pago móvil.
- **RF-60** AL pagar, EL SISTEMA ligará método y moneda: Binance solo en dólares; pago móvil y transferencia solo en bolívares. El cambio de un campo ajustará el otro, y el servidor rechazará combinaciones inválidas.
- **RF-61** EL SISTEMA pedirá al cliente que suba la captura de su comprobante y: en pago móvil y transferencia, el monto en Bs y los últimos 6 a 12 dígitos de la referencia (solo números); en Binance, el monto en dólares y el **ID de la transacción** (letras y números permitidos, mínimo un carácter y sin límite de largo).
- **RF-62** EL SISTEMA solo aceptará del cliente un comprobante por el monto exacto pendiente: en dólares para Binance, y en bolívares a la tasa BCV del día para pago móvil y transferencia. El monto viene escrito y no se edita. SI el cliente pagó otro monto, ENTONCES EL SISTEMA le indicará escribir a administración por WhatsApp.
- **RF-63** CUANDO el cliente suba un comprobante, EL SISTEMA dejará el envío como «Pago en revisión» y lo mostrará al personal. SI ya hay un comprobante en revisión, ENTONCES EL SISTEMA no dejará subir otro.
- **RF-64** EL SISTEMA permitirá al personal confirmar o rechazar el pago con un motivo. SI se rechaza, ENTONCES EL SISTEMA permitirá al operador abrir un chat de WhatsApp con el motivo escrito, para que el cliente suba otro.
- **RF-65** EL SISTEMA permitirá al personal registrar un pago a mano (monto, método, referencia) para cuando el cliente pague sin usar el enlace.
- **RF-66** Los datos para pagar (pago móvil, cuenta bancaria y Binance) los carga y edita el administrador desde el panel. No van escritos en el código ni en estos documentos. El mensaje de pago incluye: banco, cédula del titular, teléfono, cuenta, nombre del titular, monto y la nota de enviar la captura.
- **RF-67** EL SISTEMA no valida el pago contra Binance ni contra el banco: lo verifica una persona mirando el comprobante. No marca referencias repetidas.

### Envío a Venezuela y entrega

- **RF-68** CUANDO el personal confirme el pago, EL SISTEMA dejará el envío «Enviando a Venezuela» y listo un mensaje de WhatsApp «Tu pago fue verificado» que avisa que el envío sale hacia Venezuela.
- **RF-69** SI el envío no tiene un pago confirmado, ENTONCES EL SISTEMA no dejará despacharlo. SI faltan datos de entrega, ENTONCES EL SISTEMA no dejará despacharlo y mostrará qué falta.
- **RF-70** EL SISTEMA permitirá registrar la transportista venezolana (MRW o Zoom) y la guía de esa transportista, con el número escrito, con una foto de la guía tomada o subida desde el mismo sistema, o con ambos. Basta con uno de los dos: no se exige escribir el número si hay foto. SI no hay ni número ni foto, ENTONCES EL SISTEMA no registrará la guía y lo dirá. CUANDO se registre, el envío pasará a «En ruta».
- **RF-71** CUANDO el operador pulse «Enviar guía por WhatsApp», EL SISTEMA abrirá el chat del cliente con el texto ya escrito (transportista y cómo rastrearla; el número de guía solo si se escribió) y dejará la foto lista para mandarla en ese mismo chat (ver nota técnica 1). El botón aparece apenas se registra la guía, con número, con foto o con ambos.
- **RF-72** CUANDO el cliente pulse «Ya lo recibí» en un envío «En ruta», EL SISTEMA lo marcará «Entregado» y guardará la fecha.
- **RF-73** EL SISTEMA permitirá al operador marcar «Entregado» un envío «En ruta» en cualquier momento, sin esperar días, pero le pedirá confirmar en pantalla antes de hacerlo. Queda en el historial quién lo hizo.
- **RF-74** EN la modalidad de cobro a destino, EL SISTEMA aclarará al cliente que el tramo dentro de Venezuela lo paga directamente a la transportista que eligió, a su llegada, y que ese monto no pasa por el sistema.

### Estados y seguimiento

- **RF-75** EL SISTEMA usará estos nombres cortos para el estado de un envío consolidado: «Por consolidar», «Por pagar», «Pago en revisión», «Enviando a Venezuela», «En ruta» y «Entregado». No habrá un paso extra entre «Enviando a Venezuela» y «En ruta».
- **RF-76** EL SISTEMA usará para las alertas: «Prealertado», «Recibido parcial» y «En bodega», además de «Archivado» y «Descartado» cuando corresponda.
- **RF-77** EL SISTEMA mostrará al personal una lista de envíos que se puede filtrar por estado y buscar por nombre del cliente, teléfono, número de prealerta o guía venezolana, mostrada de 10 en 10 (RF-111). El buscador busca en todos los envíos, no solo en los que se ven.
- **RF-78** EL SISTEMA mostrará al cliente, por cada paquete, un seguimiento corto con sus pasos y la fecha de cada uno: «Prealertado», «En oficina», «Consolidando», «Por pagar», «Pago en revisión», «Enviando a Venezuela», «En ruta» (con la guía de la transportista) y «Entregado». El personal ve el mismo seguimiento. El seguimiento de cada paquete sigue a su envío aunque el paquete cambie de consolidado.
- **RF-79** SI un paquete sale de un consolidado y vuelve a la bodega, ENTONCES EL SISTEMA mostrará su seguimiento otra vez desde «En oficina».
- **RF-80** EL SISTEMA mostrará al personal, al entrar, un resumen de los pendientes de hoy: por recibir, por cotizar, por cobrar, por revisar pagos y por despachar.
- **RF-81** EL SISTEMA guardará el historial de cada envío: qué pasó, cuándo y qué usuario lo hizo.

### Administración y configuración

- **RF-82** EL SISTEMA permitirá al administrador cambiar, sin tocar código, los tramos por kilo de la modalidad 1, el precio por kilo de la modalidad 2 y el porcentaje de seguro de cada una.
- **RF-83** EL SISTEMA consultará la tasa BCV del día en `https://ve.dolarapi.com/v1/dolares/oficial` (campo «promedio», bolívares por dólar), la guardará con su fecha y la usará en todo el sistema. La consulta la hace el servidor, no el navegador del usuario, como máximo una vez cada pocos minutos.
- **RF-84** SI la consulta de la tasa falla o no hay tasa de hoy, ENTONCES EL SISTEMA usará la última guardada, mostrará un aviso con su fecha y permitirá al administrador cargarla a mano.
- **RF-85** EL SISTEMA permitirá al administrador editar las plantillas de los mensajes de WhatsApp.
- **RF-86** EL SISTEMA permitirá al administrador editar el nombre y el enlace de rastreo de MRW y Zoom. Enlaces iniciales: MRW `https://mrwve.com` y Zoom `https://zoom.red/tracking-de-envios-personas/`. No se verificó si aceptan el número en el enlace; si no, el sistema copia el número para pegarlo (RF-3).
- **RF-87** EL SISTEMA permitirá al administrador editar los datos de contacto público: WhatsApp de atención, redes sociales y dirección.

### Teléfono y PC

- **RF-88** EL SISTEMA funcionará completo en teléfono y en PC. El diseño se adapta a cada pantalla: en el teléfono prioriza escanear, tomar fotos y recibir; en la PC prioriza listas, cotizaciones, cobros y envío de mensajes.
- **RF-89** EL SISTEMA se podrá instalar en la pantalla de inicio del teléfono como si fuera una aplicación, sin pasar por la tienda de aplicaciones.

### Privacidad y seguridad

- **RF-90** EL SISTEMA guardará las contraseñas con hash (una huella que no se puede revertir).
- **RF-91** EL SISTEMA no mostrará datos de clientes (nombres, teléfonos, fotos) en la página pública.
- **RF-92** Las fotos y comprobantes no tendrán dirección pública: solo se servirán a quien tenga permiso.
- **RF-93** Los registros internos de errores (logs) no guardarán cédulas, teléfonos ni nombres completos.
- **RF-94** EL SISTEMA guardará cifrados la cédula, el nombre y el teléfono de quien recibe el envío, y la cédula del cliente. La huella para detectar cédulas repetidas usará HMAC con la llave del servidor.
- **RF-95** EL SISTEMA bloqueará la lectura directa de las tablas desde internet (protección por filas de Supabase); solo el servidor de Venvios las lee.
- **RF-96** SI en producción falta la configuración del almacén de fotos, la base de datos o las llaves, ENTONCES EL SISTEMA no arrancará, en vez de guardar datos donde se pierden.

### Solidez con muchos datos y varios usuarios a la vez

- **RF-97** EL SISTEMA encontrará cualquier paquete, foto o envío aunque haya miles de envíos guardados; la bodega y el resumen no dependen de una lista recortada.
- **RF-98** CUANDO una acción cambia varias cosas a la vez (consolidar, cambiar dueño, confirmar un pago), EL SISTEMA guardará todo junto o nada; SI algo falla a la mitad, ENTONCES no quedan datos a medias.
- **RF-99** SI dos personas cambian el mismo envío, paquete o pago al mismo tiempo, ENTONCES EL SISTEMA aplicará solo el primer cambio y le pedirá al segundo que recargue la página.

### Pantalla del envío para el personal

- **RF-100** EN la pantalla de un envío, EL SISTEMA mostrará al personal solo el trabajo de la etapa en que está el envío: si se está consolidando, solo lo de consolidar; si se está revisando el pago, solo los pagos; si se está enviando, solo el despacho. Lo de las otras etapas no aparece hasta que el envío llegue a ellas.
- **RF-101** EN un envío «Por consolidar» o «Por pagar», EL SISTEMA mostrará al operador tres pasos numerados, en este orden: 1) los paquetes del envío, con «Quitar paquete» (pide confirmar) y «Agregar de la bodega del cliente» en la misma sección; 2) el peso total, la modalidad de cobro, el valor declarado y la transportista; 3) el total y la cotización. La última acción de la pantalla es «Calcular total» y, ya calculado, «Enviar cotización por WhatsApp». El resumen de precio del cliente no aparece mientras no haya total.

### Perfil del cliente

- **RF-102** EL SISTEMA mostrará al cliente una sección «Perfil» con dos partes: «Mis datos» y «Mis datos de entrega».
- **RF-103** EN «Mis datos», EL SISTEMA permitirá al cliente corregir su nombre y apellido, su correo y su teléfono de WhatsApp (con selector de país), con las mismas reglas del registro (RF-10). Mostrará, sin poder cambiarlos, su número de casillero y su cédula parcial (`V-***678`).
- **RF-104** AL cambiar su correo, su teléfono o su contraseña, EL SISTEMA pedirá la contraseña actual. La contraseña nueva cumple RF-11 y cierra las sesiones de otros equipos (RF-16). SI el correo o el teléfono ya pertenecen a otra cuenta, ENTONCES EL SISTEMA no hará el cambio y lo explicará (RF-13).
- **RF-105** EL SISTEMA no permitirá al cliente cambiar su cédula, porque identifica su cuenta. SI el cliente necesita corregirla, ENTONCES EL SISTEMA le indicará escribir a administración por WhatsApp. Solo el administrador puede corregirla (RF-110).
- **RF-106** EN «Mis datos de entrega», EL SISTEMA guardará: quién recibe (nombre y apellido, número de cédula y teléfono; por defecto son los del cliente y los puede cambiar si recibe otra persona) y, para MRW y para Zoom por separado, la agencia por donde retira, la ciudad y el estado. El cliente puede llenar solo la transportista que usa.
- **RF-107** EL SISTEMA guardará cifrados el nombre, la cédula y el teléfono de quien recibe (RF-94) y registrará cuándo se cambió el perfil, sin escribir esos datos en los registros internos (RF-93).
- **RF-108** EN la pantalla de Consolidar, EL SISTEMA mostrará al cliente un resumen de los datos de entrega de la transportista elegida, con un enlace «Cambiar en mi perfil». No habrá formulario de dirección en esa pantalla.
- **RF-109** EN un envío que aún no salió, EL SISTEMA permitirá al cliente pulsar «Actualizar con mi perfil» para copiar de nuevo sus datos de entrega actuales. Para cualquier otro cambio, el cliente escribe al operador por WhatsApp y el operador corrige (RF-51). El cliente ya no edita la dirección dentro del envío.
- **RF-110** EL SISTEMA permitirá al administrador corregir la cédula de un cliente, buscándolo por nombre, correo, casillero o cédula, con un motivo obligatorio. El operador no puede. SI la cédula nueva ya pertenece a otra cuenta, ENTONCES EL SISTEMA no hará el cambio y lo explicará (RF-13). Queda en el historial de la cuenta quién la cambió, cuándo y por qué, sin guardar la cédula anterior completa (RF-93, RF-94).

### Listas largas

- **RF-111** CUANDO una lista tenga más de 10 elementos (bodega, envíos, paquetes de un consolidado, paquetes para agregar o consolidar, pedidos, alertas e historial), EL SISTEMA mostrará solo los 10 primeros, el total («Mostrando 10 de 240») y un botón «Ver 10 más» que agrega los siguientes sin perder lo que ya se ve ni mover la pantalla. SI la lista tiene 10 elementos o menos, ENTONCES EL SISTEMA no muestra el contador ni el botón.
- **RF-112** EN las listas donde se eligen paquetes (agregar de la bodega del cliente y Consolidar del cliente), EL SISTEMA tendrá un buscador por número de tracking que filtra entre todos los paquetes, no solo entre los que se ven.
- **RF-113** EN esas mismas listas, EL SISTEMA ofrecerá «Elegir todos», que marca todos los paquetes que coinciden con el buscador (no solo los 10 visibles) y muestra cuántos quedan elegidos antes de enviar la solicitud o agregarlos.

### Nombres en pantalla

- **RF-114** EN Mis envíos, Finanzas, Rastrear y el detalle del envío, EL SISTEMA llamará a cada envío consolidado «Consolidación» seguida de un número único de 6 cifras, solo números (por ejemplo «Consolidación 000123»), y no por la tienda de sus paquetes. El mismo número se ve en el cliente y en el panel, y el personal puede buscar el envío escribiéndolo.
- **RF-115** EN el menú del operador y en el botón del inicio, EL SISTEMA llamará «Registrar» a lo que hoy se llama «Escanear», porque lo que hace el operador es registrar lo que va llegando. La cámara conserva su botón «Escanear siguiente paquete».
- **RF-116** CUANDO se carguen los datos de prueba, EL SISTEMA dejará a cada cliente de prueba con sus datos de entrega ya llenos en su perfil (RF-106), para probar el flujo sin escribirlos.
- **RF-117** EL SISTEMA no le pedirá al cliente subir ninguna foto suya ni de sus documentos: ni al registrarse ni en su perfil. La única imagen que sube el cliente es la captura de su comprobante de pago.

### Rastrear, menú y entradas separadas

- **RF-118** EL SISTEMA tendrá para el cliente una sección «Rastrear» con un buscador por tracking o por número de consolidación, que solo busca entre los envíos del propio cliente. SI no encuentra nada, ENTONCES EL SISTEMA dirá que no hay información de ese tracking.
- **RF-119** CUANDO el cliente rastree un envío, EL SISTEMA mostrará arriba la línea de pasos del envío; a un lado «Detalles» (estado, llegada a la oficina, peso cobrado si ya se pesó, transportista y guía venezolana con el enlace para rastrearla en MRW o Zoom) y al otro «Historial», con cada paso, su fecha y una frase corta que lo explica.
- **RF-120** EL SISTEMA tendrá dos entradas: la de clientes (`/ingresar`) y la del personal (`/admin`), con aspecto distinto. SI un cliente usa la entrada del personal, o el personal usa la de clientes, ENTONCES EL SISTEMA no abrirá la sesión y le indicará cuál es su entrada. El cliente nunca ve enlaces al panel del personal.
- **RF-121** Cuando exista dominio propio, la entrada del personal podrá vivir en un subdominio (por ejemplo `panel.dominio`) apuntando al mismo sitio; hasta entonces se usa `/admin`.
- **RF-122** EN el panel del personal, EL SISTEMA usará el mismo menú desplegable de RF-19 en la PC.

## Tarifa

Los precios están en dólares a tasa BCV del día; el pago puede hacerse en Bs.

**Modalidad 1 (todo incluido):**

- Cobro = (peso total del envío en kg × precio por kg según el tramo) + 5 % del valor declarado como seguro de carga.
- Precio por kg según el peso total del envío: 1 a 9,99 kg = 9,5 $; 10 a 19,99 kg = 8,5 $; 20 a 49,99 kg = 7,5 $; 50 kg en adelante = 6,5 $. El precio del tramo se aplica a todos los kilos, no solo a los que pasan el límite.
- Estos tramos y el 5 % los edita el administrador (RF-82).
- El peso total es el del consolidado completo (ejemplo: 3 paquetes de Shein se pesan y se cobran juntos).
- Peso mínimo cobrable: 2 kg (un envío que pese 1 kg paga como 2 kg). Peso exacto con 2 decimales, sin redondear hacia arriba. Sin peso volumétrico.
- Ejemplo: 3 paquetes que pesan 2,40 + 1,15 + 0,80 = 4,35 kg con valor declarado de 60 $ → 4,35 × 9,5 = 41,33 $ (41,325 redondeado al centavo) + 3,00 $ de seguro = **44,33 $**.

**Modalidad 2 (cobro a destino):**

- El cliente puede elegirla para cualquier peso.
- Peso mínimo cobrable en esta modalidad: 1 kg.
- Si el envío pesa menos de 2 kg, el sistema propone la modalidad 2 por defecto. El cliente puede cambiarla a la modalidad 1; en ese caso paga como mínimo 2 kg y el seguro de la modalidad 1 (5 %).
- El cliente elige la modalidad al consolidar. El operador la confirma o la cambia cuando pesa el envío completo.
- Cobro de Venvios = (peso total × 6 $) + 3 % del valor declarado como seguro de carga.
- Venvios no financia el tramo en Venezuela: el cliente paga a MRW o Zoom, a su llegada, lo que esa transportista le cobre (cobro a destino). Ese monto no pasa por el sistema.
- El pago a Venvios (6 $/kg + 3 %) sí debe estar confirmado antes de despachar (RF-69).
- La transportista del cobro a destino es siempre la misma que eligió el cliente (MRW o Zoom).

Nota: con estos tramos, 9,9 kg cuestan 94,05 $ y 10 kg cuestan 85 $. Es lo que dice el flyer y el cliente confirmó que aplica; el sistema lo calcula así.

## Notas técnicas que afectan lo que se le promete al cliente

1. **WhatsApp y la foto.** El enlace que abre un chat de WhatsApp con un mensaje escrito solo acepta texto; no puede adjuntar una foto. En la PC el sistema copia la foto y abre el chat con el texto: el operador pulsa Ctrl+V y Enter. En el teléfono se abre el menú de compartir con la foto y el texto, y el operador elige el chat del cliente.
2. **Cámara.** El navegador solo deja usar la cámara si la página está publicada con candado (https). En producción eso viene incluido; en las pruebas locales hay que tenerlo en cuenta.
3. **Códigos que se pueden escanear.** Las etiquetas de las transportistas colombianas usan código de barras (Code 128 y similares) o QR, y los dos se pueden leer. Cada transportista formatea su número distinto (ceros a la izquierda, prefijos, dígitos de pieza), así que el sistema compara ignorando esos detalles (RF-37, RF-38).
4. **Netlify.** Netlify aloja páginas estáticas y funciones pequeñas, pero no guarda archivos ni base de datos. Fotos, comprobantes y datos van en servicios externos con plan gratis o barato.
5. **Miles de cuentas.** Que el cliente tenga cuenta aumenta el trabajo de seguridad (contraseñas, que nadie vea datos de otro) y de almacenamiento (fotos y comprobantes de miles de envíos). El plan dimensiona el costo mensual antes de prometer los 100 $ al mes.

## Cómo sé que está listo

- Como cliente me registro, veo mi casillero y hago una prealerta de 3 guías con un valor para cada una.
- Como operador escaneo cada paquete (con cámara y con foto) y sale el cliente correcto, ya «En oficina». Un paquete prealertado sigue como «Prealertado» hasta que se escanea.
- Como cliente guardo mis datos de entrega en mi perfil; después elijo esos 3 paquetes, escojo MRW y veo el valor declarado como la suma de los tres, sin volver a escribir la dirección.
- Como operador veo la solicitud, pongo 4,35 kg con 60 $ declarados y el sistema muestra 44,33 $ y su equivalente en Bs. Corrijo un valor o el seguro y el total se recalcula. Mando la cotización por WhatsApp con el enlace.
- Pago por pago móvil con 6 a 12 dígitos y por Binance con ID de transacción; los dos se registran sin error y el envío queda «Pago en revisión».
- Apruebo el pago y el envío dice «Enviando a Venezuela». Registro la guía de MRW con foto, pulso «Enviar guía» y el envío dice «En ruta».
- El cliente pulsa «Ya lo recibí» y el envío queda «Entregado». También puedo cerrarlo yo confirmando en pantalla.
- En su cuenta, el cliente ve cada paquete con sus pasos y fechas.
- Con 240 paquetes en la bodega de un cliente veo 10, el contador «Mostrando 10 de 240» y «Ver 10 más»; busco una guía sin bajar y elijo todos los que coinciden con un solo toque.
- Todo funciona igual en un teléfono Android y en una PC con Chrome.
- Las pruebas automáticas del cálculo de precios, los cambios de estado, el escaneo y las validaciones pasan.

## Fuera de alcance

- Bot de WhatsApp o mensajes automáticos (API de WhatsApp Business, Twilio o similares).
- Conexión automática con las transportistas para consultar el estado de una guía.
- Recuperación de contraseña por correo o SMS automático.
- Verificación automática de pagos contra Binance o el banco.
- Aplicación nativa en Play Store o App Store.
- Facturación electrónica.
- Cierre automático de envíos por paso de días.
- Libreta con varias direcciones guardadas por transportista (por ahora una para MRW y una para Zoom).
