# 001 · Recepción, cobro y despacho de paquetes (Venvios Express)

Estado: BORRADOR. Falta que Luis responda las aclaraciones marcadas antes de hacer el plan.

## Qué es y por qué

Venvios Express es un **casillero internacional**: el cliente compra en Shein, AliExpress, Amazon u otra tienda y la compra llega a la oficina de Cúcuta (Av. 3 #8-03, piso 2, local 02, Barrio Latino). Allí se recibe, se pesa, se cruza a Venezuela y se entrega a una transportista venezolana (MRW o Zoom) que lo lleva hasta el cliente.

Hoy todo se lleva por WhatsApp y de memoria. El sistema le da al personal de la oficina un solo lugar donde:

1. Anotar la prealerta que el cliente manda por WhatsApp (su número de tracking de la tienda).
2. Escanear con el teléfono el código de barras de cada paquete que llega. Ese código es el tracking de la transportista que lo trajo, así que el sistema encuentra solo a su dueño y lo marca como recibido.
3. Avisarle al cliente por WhatsApp, con un botón, que llegó, cuánto pesa y cuánto debe pagar.
4. Recibir el comprobante de pago (Binance o pago móvil) que el cliente sube, y confirmarlo.
5. Registrar la guía de MRW o Zoom con una foto, y avisarle al cliente con otro botón.

Todo lo hace una persona a mano. No hay bot ni mensajes automáticos. El sistema solo deja listo el mensaje y abre el chat; la persona lo envía.

Además hay una página pública con la información de la empresa, las tarifas y un rastreador que lleva al sitio de MRW o de Zoom.

## Quién lo usa

- **Operador**: personal de la oficina. Usa el teléfono para escanear y tomar fotos, y la PC para cobrar y enviar mensajes por WhatsApp Web.
- **Administrador**: el responsable de las cuentas. Hace todo lo del operador y además corrige errores, cambia tarifas y datos de pago, y gestiona usuarios y operadores. Aún no se sabe cuántos operadores ni administradores habrá, así que el sistema no fija un número.
- **Visitante**: cualquier persona que entra a la página pública. No tiene cuenta.
- **Usuario común (el cliente)**: puede haber miles. Tiene cuenta propia: entra a ver sus envíos, cuánto debe, los datos de pago y sube su comprobante. Además recibe avisos por WhatsApp. Solo ve lo suyo.

## Requisitos

### Página pública

- **RF-1** EL SISTEMA mostrará una página pública, sin detalles de cómo trabaja la oficina por dentro (no se explica el escaneo ni los medios de pago concretos; se dice solo «realiza tu pago en bolívares»), con: quiénes son, la tabla de tarifas vigente, la nota «Pagos en Bs a tasa BCV», la dirección de la oficina, el WhatsApp de atención y las redes sociales (@venviosexpress en Instagram, Facebook y TikTok).
- **RF-2** EL SISTEMA mostrará un rastreador donde el visitante elige una transportista de una lista. No pedirá número de guía.
- **RF-3** CUANDO el visitante pulse «Rastrear», EL SISTEMA abrirá en otra pestaña la página oficial de rastreo de esa transportista. El visitante escribe su número de guía allí.
- **RF-4** EL SISTEMA no consultará a las transportistas por su cuenta: solo redirige.
- **RF-5** CUANDO el visitante pulse el botón de WhatsApp, EL SISTEMA abrirá un chat con el número de atención y un mensaje inicial ya escrito.
- **RF-6** EL SISTEMA mostrará en la página pública una calculadora donde el visitante escribe los kilos y el valor declarado, y ve el precio estimado en $ y en Bs.

### Acceso del personal

- **RF-7** EL SISTEMA pedirá correo o número de casillero y contraseña para entrar. El personal entra al panel y el cliente a su cuenta.
- **RF-8** SI alguien falla la contraseña varias veces seguidas, ENTONCES EL SISTEMA bloqueará ese intento por unos minutos.
- **RF-9** EL SISTEMA tendrá tres tipos de usuario: usuario común (cliente), operador y administrador. Cada uno ve y hace solo lo suyo. Cualquier cantidad de cada tipo.
- **RF-9b** EL SISTEMA permitirá al cliente registrarse solo desde la página con: nombre y apellido, número de cédula (solo el número, sin foto), correo, teléfono de WhatsApp (selector de país con Venezuela por defecto y el número de ejemplo `4241234567` como guía) y contraseña repetida dos veces. No necesita que un operador lo cree.
- **RF-9g** EL SISTEMA exigirá contraseñas de al menos 8 caracteres, con una mayúscula y un carácter especial, y mostrará en vivo cuáles requisitos se cumplen. No dejará registrar si las dos contraseñas no coinciden.
- **RF-9h** EL SISTEMA dará a cada cliente al registrarse un número de casillero único con la forma `VENV-123456` (seis dígitos al azar). SI el número ya existe, ENTONCES EL SISTEMA generará otro hasta encontrar uno libre.
- **RF-9i** EL SISTEMA permitirá ver y ocultar la contraseña en los campos de contraseña.
- **RF-9d** SI la cédula, el correo o el teléfono ya están registrados, ENTONCES EL SISTEMA no creará una segunda cuenta y le indicará cómo recuperar la suya.
- **RF-9e** EL SISTEMA guardará la cédula cifrada (se puede recuperar con una llave del servidor) y la mostrará completa solo al administrador y al operador cuando prepare un despacho; en listas y registros internos aparece parcial (por ejemplo `V-***678`).
- **RF-9c** SI un cliente olvida su contraseña, ENTONCES EL SISTEMA permitirá que un operador o administrador le asigne una temporal (sin correo ni SMS automático, para no pagar mensajería).

### Cuenta del cliente

- **RF-9j** EL SISTEMA mostrará al cliente un panel con menú lateral en la PC y barra inferior en el teléfono, con: Inicio (vista general con su número de casillero, dirección de envío y contadores), Pedidos (historial de envíos ya pagados y pendientes de pago), Alertas (prealertas) y Finanzas (pagos).
- **RF-9k** EN Alertas, EL SISTEMA listará las prealertas del cliente con estado «Pendiente» mientras el paquete no haya llegado a la oficina y «Atendida» cuando ya llegó, con un botón para crear una nueva alerta.
- **RF-9l** EN Finanzas, EL SISTEMA listará los envíos que ya llegaron y tienen precio calculado, para pagarlos y subir el comprobante.
- **RF-9m** EL SISTEMA mostrará en el panel del cliente un botón flotante de WhatsApp hacia la atención. No mostrará rastreador dentro de la cuenta.
- **RF-9n** AL pagar, EL SISTEMA ligará método y moneda: Binance solo en dólares; pago móvil y transferencia solo en bolívares. El cambio de un campo ajustará el otro, y el servidor rechazará combinaciones inválidas.

### Bodega, consolidación y casos especiales

Estos requisitos reemplazan: el cálculo del precio con la suma de los pesos de una prealerta (RF-20: ahora se cobra el peso del consolidado), el total dentro del aviso de llegada (RF-25), el pago parcial del cliente (RF-31) y «pagar con lo que ya llegó».

- **RF-60** EL SISTEMA guardará cada paquete escaneado en la bodega, con su dueño o como «sin dueño», y mostrará al personal todo lo que está físicamente en la oficina (recibido y aún no despachado), con su antigüedad. Se podrá filtrar «sin dueño» y buscar por tracking, cliente o número de casillero.
- **RF-61** CUANDO un paquete llegue sin prealerta, EL SISTEMA permitirá al operador asignarlo en el momento con el número de casillero `VENV-` o buscando al cliente por nombre, correo o cédula, o dejarlo sin dueño.
- **RF-62** EL SISTEMA no sugerirá dueños por parecido de tracking. Si no hay coincidencia exacta, el paquete queda sin dueño hasta que alguien lo reclame. No se publica una lista de paquetes sin dueño a los clientes.
- **RF-63** CUANDO un cliente registre una alerta con un tracking igual al de un paquete sin dueño, EL SISTEMA lo unirá a su alerta como ya recibido y lo dejará en el historial.
- **RF-64** EL SISTEMA permitirá al operador o al administrador cambiar el dueño de un paquete en bodega (o devolverlo a sin dueño), con un motivo opcional que queda en el historial.
- **RF-65** EL SISTEMA permitirá al operador o al administrador descartar un paquete o un envío con un motivo obligatorio. Los casos especiales (paquete dañado, equivocado, devoluciones, pagos de más) se acuerdan con el cliente por WhatsApp y el sistema solo registra la decisión.
- **RF-66** EL SISTEMA permitirá al cliente elegir, entre sus paquetes en bodega, cuáles se envían juntos (consolidar), con la modalidad, la transportista y el valor declarado. El envío queda «Por consolidar».
- **RF-67** EL SISTEMA permitirá al operador consolidar en nombre del cliente cuando lo acuerdan por WhatsApp, agregar o quitar paquetes de un consolidado antes del pago y registrar el peso total del consolidado. CUANDO registre el peso, EL SISTEMA calculará el total y el envío pasará a «Listo para pagar».
- **RF-68** SI cambian los paquetes de un consolidado ya pesado, ENTONCES EL SISTEMA borrará el total y lo devolverá a «Por consolidar» hasta pesarlo de nuevo.
- **RF-69** EL SISTEMA permitirá al cliente o al personal deshacer un consolidado que aún no tiene pagos; sus paquetes vuelven a la bodega del cliente.
- **RF-70** El aviso de llegada por paquete dice que llegó y que el cliente entre a su cuenta a consolidar. El total se avisa con un mensaje de cotización cuando se pesa el consolidado.
- **RF-71** EL SISTEMA solo aceptará del cliente un comprobante por el monto exacto pendiente: en dólares para Binance, y en bolívares a la tasa BCV del día para pago móvil y transferencia. El monto viene escrito y no se edita. SI el cliente pagó otro monto, ENTONCES EL SISTEMA le indicará escribir a administración por WhatsApp.
- **RF-72** EL SISTEMA pedirá como referencia del pago los últimos 6 dígitos, solo números.
- **RF-73** EL SISTEMA permitirá al cliente eliminar la alerta de un paquete que aún no llegó. Las alertas pendientes no vencen.
- **RF-74** El operador marca como «Entregado» un envío despachado. No hay seguimiento después de eso.

### Prealertas

- **RF-10** EL SISTEMA permitirá registrar una prealerta con: nombre del cliente, teléfono de WhatsApp con código de país, número de tracking (el que trae el paquete de la tienda o de la transportista, el mismo del código de barras), tienda de origen y valor declarado en dólares. El valor declarado lo da el cliente en la prealerta.
- **RF-11** EL SISTEMA permitirá indicar cuántos paquetes espera ese cliente en el mismo envío.
- **RF-12** SI el número de prealerta ya existe, ENTONCES EL SISTEMA avisará y mostrará la prealerta existente en vez de duplicarla.
- **RF-13** SI falta el teléfono, ENTONCES EL SISTEMA guardará la prealerta, pero la marcará como «sin WhatsApp» y no dejará enviar mensajes hasta que se agregue.
- **RF-14** CUANDO el operador escriba un nombre o un teléfono ya registrado, EL SISTEMA sugerirá el cliente existente para no volver a escribir sus datos.

### Recepción con el teléfono

- **RF-15** EL SISTEMA permitirá escanear con la cámara del teléfono cualquier código de barras o QR de la etiqueta del paquete (todos los formatos que la cámara pueda leer). Los paquetes que se esperan vienen de Shein, por ejemplo con etiquetas de X-Cargo.
- **RF-15b** EL SISTEMA guardará el texto exacto que leyó el escáner, y para buscar comparará ignorando espacios, ceros a la izquierda y prefijos comunes. SI una etiqueta trae varios códigos, ENTONCES EL SISTEMA dejará elegir cuál usar.
- **RF-16** EL SISTEMA permitirá escribir el tracking a mano cuando el código no se pueda leer.
- **RF-17** CUANDO se lea un tracking con prealerta, EL SISTEMA marcará el paquete como recibido automáticamente y mostrará el nombre del cliente y cuántos paquetes de su envío faltan.
- **RF-18** SI no existe prealerta con ese tracking, ENTONCES EL SISTEMA lo dirá claramente y ofrecerá registrar el paquete como «sin prealerta» para asignarle el cliente después.
- **RF-19** EL SISTEMA permitirá cargar el peso de cada paquete en kilos, con dos decimales exactos. No se usa peso volumétrico: solo cuenta el peso físico.
- **RF-20** EL SISTEMA calculará el precio del envío sumando el peso de todos sus paquetes, aplicando la tarifa por kilo y agregando el seguro de carga (ver «Tarifa»). Lo mostrará en dólares y en bolívares con la tasa BCV del día.
- **RF-21** EL SISTEMA permitirá solo al administrador corregir a mano el precio, el peso o el valor declarado de un envío, con un motivo obligatorio. Se guarda el valor anterior y quién lo cambió (RF-40). El operador no puede.
- **RF-22** EL SISTEMA permitirá tomar una foto del paquete al recibirlo. La foto es opcional.
- **RF-23** SI se escanea un paquete que ya fue recibido, ENTONCES EL SISTEMA avisará que ya está registrado y no lo duplicará.
- **RF-24** SI el teléfono no permite usar la cámara, ENTONCES EL SISTEMA dejará la búsqueda manual disponible y explicará por qué no abrió la cámara.

### Aviso de llegada por WhatsApp

- **RF-25** CUANDO el operador pulse «Avisar por WhatsApp», EL SISTEMA abrirá el chat del cliente con el mensaje ya escrito: que llegó su paquete, el peso, el precio en $ y en Bs, cuántos paquetes faltan si es un envío de varios, y que entre a su cuenta para ver el detalle y pagar.
- **RF-26** EL SISTEMA abrirá WhatsApp Web en la PC y la aplicación de WhatsApp en el teléfono.
- **RF-27** EL SISTEMA guardará que el aviso se abrió, con la fecha y el usuario que lo hizo. No puede saber si el mensaje se envió de verdad, así que el operador lo confirma con un botón.
- **RF-28** CUANDO llegue cada paquete, EL SISTEMA permitirá avisar al cliente de ese paquete (aviso por paquete), para que el cliente decida si espera los demás o paga ya. El mensaje indica cuántos paquetes del envío ya llegaron y cuántos faltan.

### Pago

- **RF-29** EL SISTEMA mostrará al cliente, en su cuenta, el total a pagar en dólares (y en Bs al cambio del día) y los datos para pagar por Binance o por pago móvil.
- **RF-30** EL SISTEMA permitirá al cliente subir la foto o captura de su comprobante y escribir el número de referencia.
- **RF-31** CUANDO el cliente suba un comprobante, EL SISTEMA dejará el envío como «pago por confirmar» y lo mostrará al personal. El personal lo confirma o lo rechaza con un motivo.
- **RF-32** SI el comprobante se rechaza, ENTONCES EL SISTEMA permitirá al operador abrir un chat de WhatsApp con el motivo escrito, para que el cliente suba otro.
- **RF-33** EL SISTEMA permitirá al personal registrar un pago a mano (monto, método, referencia) para cuando el cliente pague sin usar el enlace.
- **RF-33b** Los datos para pagar (pago móvil y cuenta bancaria, y Binance cuando los den) los carga y edita el administrador desde el panel. No van escritos en el código ni en estos documentos. El mensaje de pago incluye: banco, cédula del titular, teléfono, cuenta, nombre del titular, monto y la nota de enviar la captura.
- **RF-33c** EL SISTEMA no valida el pago contra Binance ni contra el banco: lo verifica una persona mirando el comprobante.

### Despacho y entrega a la transportista venezolana

- **RF-33d** CUANDO el personal confirme el pago, EL SISTEMA dejará listo un mensaje de WhatsApp «Tu pago fue verificado» pidiendo los datos de entrega.
- **RF-33e** EL SISTEMA pedirá al cliente, en su cuenta, los datos de entrega del envío: nombre y apellido de quien recibe, número de cédula, teléfono, agencia por donde retira (MRW o Zoom), ciudad y estado. Por defecto trae los datos del cliente y los puede cambiar si recibe otra persona.
- **RF-33f** SI faltan datos de entrega, ENTONCES EL SISTEMA no dejará despachar el envío y mostrará qué falta. El operador puede completarlos si el cliente se los dicta por WhatsApp.
- **RF-34** EL SISTEMA permitirá marcar un envío como «despachado a Venezuela».
- **RF-35** EL SISTEMA permitirá registrar la transportista venezolana (MRW o Zoom), su número de guía y una foto de esa guía tomada desde el mismo sistema.
- **RF-36** CUANDO el operador pulse «Enviar guía por WhatsApp», EL SISTEMA abrirá el chat del cliente con el texto ya escrito (transportista, número de guía y cómo rastrearla) y dejará la foto lista para mandarla en ese mismo chat (ver nota técnica 1).
- **RF-37** SI el envío no tiene un pago confirmado, ENTONCES EL SISTEMA no dejará despacharlo. Un envío no procede sin pago.

### Seguimiento interno

- **RF-38** EL SISTEMA mostrará una lista de envíos que se puede filtrar por estado: prealertado, recibido parcial, recibido completo, avisado, pago por confirmar, pagado, despachado y cerrado.
- **RF-39** EL SISTEMA permitirá buscar por nombre del cliente, teléfono, número de prealerta o guía venezolana.
- **RF-40** EL SISTEMA guardará el historial de cada envío: qué pasó, cuándo y qué usuario lo hizo.
- **RF-41** EL SISTEMA mostrará al entrar un resumen de los pendientes de hoy: por recibir, por avisar, por cobrar y por despachar.

### Configuración (administrador)

- **RF-42** EL SISTEMA permitirá al administrador cambiar, sin tocar código, los tramos por kilo de la modalidad 1, el precio por kilo de la modalidad 2 y el porcentaje de seguro de cada una.
- **RF-43** EL SISTEMA consultará la tasa BCV del día en `https://ve.dolarapi.com/v1/dolares/oficial` (campo «promedio», bolívares por dólar), la guardará con su fecha y la usará en todo el sistema. La consulta la hace el servidor, no el navegador del usuario.
- **RF-44** SI la consulta falla o no hay tasa de hoy, ENTONCES EL SISTEMA usará la última guardada, mostrará un aviso con su fecha y permitirá al administrador cargarla a mano.
- **RF-45** EL SISTEMA permitirá al administrador editar las plantillas de los mensajes de WhatsApp.
- **RF-46** EL SISTEMA permitirá al administrador crear, desactivar y cambiar la contraseña de los usuarios del personal.
- **RF-47** EL SISTEMA traerá solo MRW y Zoom en el rastreador, y permitirá al administrador editar su nombre y enlace de rastreo. Enlaces iniciales: MRW `https://mrwve.com` y Zoom `https://zoom.red/tracking-de-envios-personas/`. No se verificó si aceptan el número en el enlace; si no, el sistema copia el número para pegarlo (RF-3).

### Teléfono y PC

- **RF-48** EL SISTEMA funcionará completo en teléfono y en PC. El diseño se adapta a cada pantalla: en el teléfono prioriza escanear, tomar fotos y recibir; en la PC prioriza listas, cobros y envío de mensajes.
- **RF-49** EL SISTEMA se podrá instalar en la pantalla de inicio del teléfono como si fuera una aplicación, sin pasar por la tienda de aplicaciones.

### Privacidad y seguridad

- **RF-50** EL SISTEMA guardará las contraseñas con hash (una huella que no se puede revertir).
- **RF-51** EL SISTEMA no mostrará datos de clientes (nombres, teléfonos, fotos) en la página pública.
- **RF-52** Un usuario común solo verá sus propios envíos, fotos y comprobantes. Las fotos y comprobantes no tienen dirección pública: solo se sirven a quien tenga permiso.
- **RF-53** Los registros internos de errores (logs) no guardarán teléfonos ni nombres completos.
- **RF-75** SI un operador intenta poner una clave temporal a una cuenta del personal, ENTONCES EL SISTEMA lo impedirá; solo el administrador puede hacerlo.
- **RF-76** CUANDO alguien cambia su contraseña, recibe una clave temporal o se desactiva su cuenta, EL SISTEMA cerrará sus sesiones abiertas en otros equipos.
- **RF-77** EL SISTEMA recordará los intentos fallidos de ingreso en la base de datos, para que el bloqueo de 10 minutos tras 5 fallos valga aunque el servidor tenga varias copias.
- **RF-78** EL SISTEMA guardará cifrados la cédula, el nombre y el teléfono de quien recibe el envío, y la cédula del cliente. La huella para detectar cédulas repetidas usará HMAC con la llave del servidor.
- **RF-79** EL SISTEMA bloqueará la lectura directa de las tablas desde internet (protección por filas de Supabase); solo el servidor de Venvios las lee.
- **RF-80** SI en producción falta la configuración del almacén de fotos, la base de datos o las llaves, ENTONCES EL SISTEMA no arrancará, en vez de guardar datos donde se pierden.
- **RF-81** Eliminado: EL SISTEMA no marca referencias repetidas. El personal revisa cada comprobante a mano y, si hace falta, escribe al cliente por WhatsApp.
- **RF-87** EL SISTEMA creará, al sembrar la base, una cuenta de administrador y una de operador de prueba tomadas de las variables de entorno. Sus claves nunca van en el código ni en el repositorio.

### Solidez con muchos datos y varios usuarios a la vez

- **RF-82** EL SISTEMA encontrará cualquier paquete, foto o envío aunque haya miles de envíos guardados; la bodega y el resumen no dependen de una lista recortada.
- **RF-83** La lista general de envíos del personal mostrará los 200 más recientes; el buscador buscará en todos.
- **RF-84** CUANDO una acción cambia varias cosas a la vez (consolidar, cambiar dueño, confirmar un pago), EL SISTEMA guardará todo junto o nada; SI algo falla a la mitad, ENTONCES no quedan datos a medias.
- **RF-85** SI dos personas cambian el mismo envío, paquete o pago al mismo tiempo, ENTONCES EL SISTEMA aplicará solo el primer cambio y le pedirá al segundo que recargue la página.
- **RF-86** EL SISTEMA consultará la tasa BCV como máximo una vez cada pocos minutos; SI la fuente no responde, ENTONCES usará la última guardada sin volver a esperarla en cada pantalla.

## Tarifa

Los precios están en dólares a tasa BCV del día; el pago puede hacerse en Bs.

**Modalidad 1 (la que se construye ahora):**

- Cobro = (peso total del envío en kg × precio por kg según el tramo) + 5 % del valor declarado como seguro de carga.
- Precio por kg según el peso total del envío: 1 a 9,99 kg = 9,5 $; 10 a 19,99 kg = 8,5 $; 20 a 49,99 kg = 7,5 $; 50 kg en adelante = 6,5 $. El precio del tramo se aplica a todos los kilos, no solo a los que pasan el límite.
- Estos tramos y el 5 % los edita el administrador (RF-42).
- El peso total es la suma de todos los paquetes del envío (ejemplo: 3 paquetes de Shein se pesan y se cobran juntos).
- Peso mínimo cobrable: 2 kg (un envío que pese 1 kg paga como 2 kg). Peso exacto con 2 decimales, sin redondear hacia arriba. Sin peso volumétrico.
- Ejemplo: 3 paquetes que pesan 2,40 + 1,15 + 0,80 = 4,35 kg con valor declarado de 60 $ → 4,35 × 9,5 = 41,33 $ (41,325 redondeado al centavo) + 3,00 $ de seguro = **44,33 $**.

**Modalidad 2 (cobro a destino):**

- El cliente puede elegirla para cualquier peso.
- Peso mínimo cobrable en esta modalidad: 1 kg.
- Si el envío pesa menos de 2 kg, el sistema propone la modalidad 2 por defecto. El cliente puede cambiarla a la modalidad 1; en ese caso paga como mínimo 2 kg y el seguro de la modalidad 1 (5 %).
- El cliente elige la modalidad al anotar su prealerta. La modalidad final se confirma cuando se pesa el envío completo.
- Cobro de Venvios = (peso total × 6 $) + 3 % del valor declarado como seguro de carga.
- Venvios no financia el tramo en Venezuela: el cliente paga a MRW o Zoom, a su llegada, lo que esa transportista le cobre (cobro a destino). Ese monto no pasa por el sistema.
- El pago a Venvios (6 $/kg + 3 %) sí debe estar confirmado antes de despachar (RF-37).
- El mensaje al cliente aclara que el envío dentro de Venezuela lo paga él directamente a la transportista.
- La transportista del cobro a destino es siempre la misma que eligió el cliente (MRW o Zoom).

Nota: con estos tramos, 9,9 kg cuestan 94,05 $ y 10 kg cuestan 85 $. Es lo que dice el flyer y el cliente confirmó que aplica; el sistema lo calcula así.

## Notas técnicas que afectan lo que se le promete al cliente

1. **WhatsApp y la foto.** El enlace que abre un chat de WhatsApp con un mensaje escrito solo acepta texto; no puede adjuntar una foto. Opciones:
   - En la PC: el sistema copia la foto y abre el chat con el texto. El operador pulsa Ctrl+V y Enter. Son dos teclas más.
   - En el teléfono: se abre el menú de compartir con la foto y el texto, y el operador elige el chat del cliente.
   Decisión: en la PC se copia la foto y se pega con Ctrl+V; el texto además dice que la guía y la foto están en su cuenta.
2. **Cámara.** El navegador solo deja usar la cámara si la página está publicada con candado (https). En producción eso viene incluido; en las pruebas locales hay que tenerlo en cuenta.
3. **Códigos que se pueden escanear.** Las etiquetas de las transportistas colombianas usan código de barras (Code 128 y similares) o QR, y los dos se pueden leer. Cada transportista formatea su número distinto (ceros a la izquierda, prefijos), así que el sistema comparará ignorando esos detalles. Para probar, hay que conseguir fotos de etiquetas reales de Shein (por ejemplo X-Cargo), AliExpress y Amazon.
4. **Netlify.** Netlify aloja páginas estáticas y funciones pequeñas, pero no guarda archivos ni base de datos. Fotos, comprobantes y datos van en servicios externos con plan gratis o barato (base de datos Postgres y almacenamiento de imágenes). La decisión concreta va en el plan.
5. **Miles de cuentas.** Que el cliente tenga cuenta aumenta el trabajo de seguridad (contraseñas, que nadie vea datos de otro) y de almacenamiento (fotos y comprobantes de miles de envíos). El plan debe dimensionar el costo mensual de base de datos y de imágenes antes de prometer los 100 $ al mes.

## Cómo sé que está listo

- Registro una prealerta desde la PC con nombre, teléfono, tracking y valor declarado.
- Con el teléfono escaneo la etiqueta de ese paquete y aparece el cliente correcto, ya marcado como recibido.
- Cargo 4,35 kg con valor declarado de 60 $ y el sistema muestra 44,33 $ y su equivalente en Bs con la tasa del día.
- El cliente entra a su cuenta, ve el monto, sube un comprobante y el envío pasa a «pago por confirmar».
- Pulso «Avisar por WhatsApp» y se abre el chat del cliente con el mensaje listo.
- Registro el pago en Bs con su referencia y el envío pasa a «pagado».
- Registro la guía de MRW, tomo la foto, pulso «Enviar guía» y el cliente recibe texto y foto.
- En la página pública elijo la transportista, escribo la guía y llego a su página de rastreo.
- Todo lo anterior funciona igual en un teléfono Android y en una PC con Chrome.
- Las pruebas automáticas del cálculo de precios, los cambios de estado y las validaciones pasan.

## Fuera de alcance

- Bot de WhatsApp o mensajes automáticos (API de WhatsApp Business, Twilio o similares).
- Conexión automática con las transportistas para consultar el estado de una guía.
- Recuperación de contraseña por correo o SMS automático.
- Verificación automática de pagos contra Binance o el banco.
- Aplicación nativa en Play Store o App Store.
- Facturación electrónica.
