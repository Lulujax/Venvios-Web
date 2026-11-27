# Tareas 002 · Venvios Express, del casillero a la entrega

Una tarea a la vez. Cada una incluye sus pruebas unitarias. La casilla se marca solo cuando Luis confirma que la prueba manual pasó.

## Estado (21-11-2026)

Programado y con pruebas automáticas que pasan (backend 216, frontend 187; esos totales incluyen también la spec 003, que es otro trabajo), a la espera de tu prueba manual: V-1 a V-9 y las tareas T-1, T-1b, T-1d, T-2, T-3, T-4a, T-4b, T-4c, T-4d, T-5, T-6, T-7, T-8, T-11 a T-15, T-16 a T-18 (olvidé mi contraseña con código por correo y cuentas que piden cambiar la clave) y T-19 y T-20 (fotos: ver ampliadas y descargar). Ninguna casilla está marcada porque faltan tus pruebas.

Programado solo en parte:
- **T-1c**: las pantallas ya muestran de 10 en 10 con «Ver 10 más», buscador por tracking y «Elegir todos» (Consolidar, agregar de bodega, bodega, envíos, pedidos y alertas). Falta que el servidor entregue las listas por tandas con el total exacto (hoy descarga todo y la pantalla recorta) y aplicarlo al historial.
- **T-9**: el operador ya recorre el flujo (cotizar, pagos por revisar, enviar, en ruta), pero falta ordenarlo por módulos; depende de la Parte 3.

Sin hacer: **T-10** (producción: se hace al final, para no quitar los datos de prueba mientras pruebas). No se ha podido probar sin cuentas reales: la migración contra Supabase (hay que aplicar el esquema nuevo y `backend/prisma/migrar-valores-por-guia.sql`), el almacenamiento real de imágenes, el despliegue en Netlify, `npm run e2e` ni las cámaras reales de Android y iPhone.

## Parte 1 · Lo ya construido: falta tu prueba manual

No es trabajo de programación: es comprobar a mano, en el orden que conviene, lo que ya existe. Las partes que cambian en la parte 2 se vuelven a probar al terminar su tarea.

- **V-1** Cuentas y acceso: registro, casillero, entrada con correo o casillero, bloqueo por intentos, clave temporal, personal. Cubre: RF-7 a RF-18. Hecho cuando: cada flujo se recorre sin errores en teléfono y PC. `[x] Hecha y probada`
- **V-2** Cuenta del cliente y prealertas: Inicio, Alertas, crear y eliminar una alerta, tracking repetido. Cubre: RF-19 a RF-30. Hecho cuando: las cinco secciones cargan y una alerta pasa de «Pendiente» a «Atendida» al escanearla. `[x] Hecha y probada`
- **V-3** Escaneo con el teléfono: cámara, foto, entrada manual, resultado arriba, cámara que se apaga sola, código de Coordinadora. Cubre: RF-31 a RF-44. Hecho cuando: con HTTPS en un Android y en un iPhone se leen QR y códigos de barras reales. `[x] Hecha y probada`
- **V-4** Bodega y casos especiales: paquete sin prealerta, sin dueño, cambio de dueño, descarte con motivo, unión con una alerta nueva. Cubre: RF-45 a RF-49. Hecho cuando: el recorrido del README (puntos 2 y 3) funciona. `[x] Hecha y probada`
- **V-5** Consolidar, cotizar y pagar tal como está hoy: elegir paquetes, pesar, ver el total, pagar con comprobante, confirmar o rechazar. Cubre: RF-50 a RF-67. Hecho cuando: 4,35 kg con 60 $ declarados dan 44,33 $ y el pago llega a «Pagado». Se repite al terminar T-3, T-4 y T-5. `[x] Hecha y probada`
- **V-6** Despacho y entrega tal como está hoy: datos de entrega, guía con foto, aviso por WhatsApp, entregado. Cubre: RF-68 a RF-74. Hecho cuando: no deja despachar sin pago ni sin datos, y el cliente ve la guía y la foto. Se repite al terminar T-1 y T-8. `[x] Hecha y probada`
- **V-7** Lista de envíos, filtros, búsqueda, historial y resumen del personal. Cubre: RF-77, RF-80, RF-81. Hecho cuando: el buscador encuentra por nombre, teléfono, tracking y guía. `[x] Hecha y probada`
- **V-8** Página pública y administración: tarifas, calculadora, rastreador, tasa BCV, datos de pago, plantillas, transportistas, contacto. Cubre: RF-1 a RF-6, RF-82 a RF-87. Hecho cuando: lo que cambia el administrador se ve en la página y en los mensajes. `[x] Hecha y probada`
- **V-9** Seguridad y solidez con servicios reales: migración, protección por filas, fotos privadas, arranque sin configuración, despliegue. Cubre: RF-90 a RF-99. Hecho cuando: Supabase y Netlify están configurados y el recorrido completo funciona en producción de prueba. `[ ] Hecha y probada`

## Parte 2 · Lote: flujo completo de consolidación a entrega

Se hace en este orden. Detalle del cómo en `plan.md`.

- **T-1** Nombres cortos de estado («Por pagar», «Pago en revisión», «Enviando a Venezuela», «En ruta», «Entregado») y mensaje de pago verificado que ya no pide datos. Cubre: RF-68, RF-75, RF-76. Hecho cuando: cliente y personal ven los nombres nuevos en listas, detalle y mensajes. `[x] Hecha y probada`
- **T-1b** Pantalla del envío por consolidar en pasos y por etapa (operador): paquetes con quitar y agregar en la misma sección, peso y cobro, y «Calcular total» al final; sin peso por paquete; foto del paquete en el escaneo; corrección del administrador solo con pago. Cubre: RF-41, RF-42, RF-57, RF-100, RF-101. Hecho cuando: el operador consolida un envío siguiendo los pasos de arriba abajo sin ver bloques de otras etapas. `[x] Hecha y probada`
- **T-1c** Listas largas de 10 en 10: el servidor entrega por tandas con el total, un componente de lista con contador y «Ver 10 más», buscador por tracking y «Elegir todos» donde se eligen paquetes; se aplica a bodega, envíos, paquetes del consolidado, agregar de bodega, Consolidar, Pedidos, Alertas e historial. Cubre: RF-77, RF-111, RF-112, RF-113. Hecho cuando: con 240 paquetes en la bodega de un cliente se ven 10, se busca una guía sin bajar y «Elegir todos» marca los que coinciden. `[ ] Hecha y probada`
- **T-1d** Ajustes de operación: guía por foto o por número (RF-70, RF-71), nombre «Consolidación» con código corto (RF-114) y «Registrar» en el menú (RF-115). Hecho cuando: se despacha solo con foto y aparece «Enviar guía por WhatsApp», Finanzas muestra «Consolidación XXXXXX» y el menú dice «Registrar». `[x] Hecha y probada`
- **T-2** Pago con Binance: monto en dólares, captura e ID de la transacción sin máximo; pago móvil y transferencia con 6 a 12 dígitos. Cubre: RF-61. Hecho cuando: un ID largo de Binance se acepta y uno con guiones se rechaza. `[x] Hecha y probada`
- **T-3** Valor declarado por guía en la prealerta (formulario y datos guardados), suma automática al consolidar y migración de los envíos existentes. Cubre: RF-26, RF-50. Hecho cuando: consolido 2 de 3 paquetes de una alerta y el valor del envío es la suma de esos 2. `[x] Hecha y probada`
- **T-4a** Perfil del cliente, parte «Mis datos»: corregir nombre, correo, teléfono y contraseña pidiendo la contraseña actual; casillero y cédula solo de lectura. Cubre: RF-102, RF-103, RF-104. Hecho cuando: un cambio de correo o teléfono repetido se rechaza y la contraseña nueva cierra las demás sesiones. `[x] Hecha y probada`
- **T-4b** Perfil del cliente, parte «Mis datos de entrega»: quién recibe y agencia, ciudad y estado para MRW y para Zoom, cifrados, con migración desde el último envío de cada cliente. Cubre: RF-106, RF-107. Cubre también: RF-116. Hecho cuando: el cliente guarda sus datos de MRW sin llenar los de Zoom, sus datos quedan cifrados y los clientes de prueba cargan con sus datos de entrega ya llenos. `[x] Hecha y probada`
- **T-4c** Consolidar y el envío usan el perfil: resumen con «Cambiar en mi perfil», copia fija al solicitar, «Actualizar con mi perfil», el operador corrige, y se quita el formulario de dirección del cliente. Cubre: RF-50, RF-51, RF-52, RF-108, RF-109. Hecho cuando: con el perfil incompleto no se envía la solicitud, y cambiar el perfil después no cambia un envío ya solicitado. `[x] Hecha y probada`
- **T-4d** Corrección de cédula por el administrador: buscar al cliente, cambiar la cédula con motivo, volver a cifrar y recalcular la huella, y dejar el historial de la cuenta. Cubre: RF-105, RF-110. Hecho cuando: el administrador corrige una cédula, una repetida se rechaza, el operador y el cliente no pueden y el historial guarda quién, cuándo y por qué sin la cédula anterior completa. `[x] Hecha y probada`
- **T-5** Cotización editable: valor por paquete y seguro con motivo e historial (operador antes del pago, administrador después), «volver a automático» y «Enviar cotización». Cubre: RF-53, RF-56, RF-57, RF-58. Hecho cuando: el total se recalcula, el historial guarda el valor anterior y el operador recibe «prohibido» tras el pago. `[x] Hecha y probada`
- **T-6** Tabla de pasos por paquete y su registro en cada transición (prealerta, escaneo, consolidar, cotizar, pago, despacho, entrega, devolución a bodega). Cubre: RF-78, RF-79. Hecho cuando: cada transición agrega un paso por cada paquete afectado y la devolución a bodega reinicia desde «En oficina». `[x] Hecha y probada`
- **T-7** Seguimiento por paquete visible en la cuenta del cliente y del personal, con pasos cortos y fechas. Cubre: RF-22, RF-78. Hecho cuando: un paquete consolidado muestra su recorrido completo aunque haya cambiado de envío. `[x] Hecha y probada`
- **T-8** Cierre: el cliente pulsa «Ya lo recibí» y el operador puede marcar «Entregado» con confirmación en pantalla. Cubre: RF-72, RF-73. Hecho cuando: las dos vías cierran el envío, quedan en el historial y un cliente no puede cerrar un envío ajeno ni uno que no está «En ruta». `[x] Hecha y probada`
- **T-9** Pantallas del operador para el flujo: solicitudes de consolidación, cotizar, pagos por revisar, enviando y en ruta, y resumen con los nuevos pendientes. Cubre: RF-52, RF-80. Hecho cuando: el operador recorre el flujo completo sin salir del panel. `[ ] Hecha y probada`
- **T-10** Preparar producción: quitar el archivo de datos de prueba y la variable que lo activa, dejar el HTTPS de desarrollo solo en desarrollo y reemplazar las plantillas de mensajes guardadas que sigan iguales a las de fábrica. Cubre: RF-96. Hecho cuando: el despliegue arranca sin datos de prueba y los mensajes usan los textos nuevos. `[ ] Hecha y probada`

## Parte 2b · Mis envíos, Rastrear y menú (aprobado 21-11-2026)

Programadas T-11 a T-15 con pruebas que pasan (backend 187, frontend 152); faltan tus pruebas manuales.

- **T-11** Número de consolidación solo con cifras, único y buscable. Cubre: RF-114. Hecho cuando: un consolidado nuevo se llama «Consolidación 000001» y el operador lo encuentra escribiendo el número. `[x] Hecha y probada`
- **T-12** Mis envíos con pestañas Pre-alertas, Activos y Entregados; Alertas fusionada en Pre-alertas. Cubre: RF-21, RF-22. Hecho cuando: cada pestaña muestra solo guía, estado, fecha, valor declarado, total en $ y Rastrear, y la guía abre Rastrear. `[x] Hecha y probada`
- **T-13** Sección Rastrear para el cliente. Cubre: RF-118, RF-119. Hecho cuando: el cliente busca un tracking o un número de consolidación suyo y ve pasos, detalles e historial; uno ajeno no aparece. `[x] Hecha y probada`
- **T-14** Menú desplegable encima del contenido en la PC, en la cuenta del cliente y en el panel. Cubre: RF-19, RF-122. Hecho cuando: el menú se abre con un botón, no mueve el contenido y se cierra al elegir una opción o tocar fuera. `[x] Hecha y probada`
- **T-15** Entrada única: `/ingresar` para clientes, operadores y administradores, que lleva a cada uno a su inicio; `/admin` abre la misma pantalla. Cubre: RF-120. Hecho cuando: el cliente entra y ve su cuenta, el operador y el administrador entran por el mismo formulario y ven el panel, y una contraseña mala da el mismo mensaje para todos. `[x] Hecha y probada`

## Parte 2c · Olvidé mi contraseña (aprobado 21-11-2026)

Lote pedido por Luis: se programan seguidas y se prueban juntas al final.

- **T-16** Servidor: pedir el código por correo y restablecer la contraseña con él, con Supabase Auth como canal del correo, bloqueo por intentos e historial de la cuenta; se quita la ruta de clave temporal. Cubre: RF-15, RF-124, RF-126, RF-127, RF-128. Hecho cuando: con un canal de pruebas, un código correcto cambia la clave y cierra las sesiones, uno malo o vencido se rechaza, 5 fallos bloquean y un correo sin cuenta no envía nada. `[x] Hecha y probada`
- **T-17** Pantallas «¿Olvidaste tu contraseña?» (correo, luego código y nueva contraseña) desde la entrada única, para clientes y para el personal. Cubre: RF-123, RF-125. Hecho cuando: desde `/ingresar` se recorre el flujo completo con una cuenta de cliente y con una del personal, y se vuelve a `/ingresar`. `[x] Hecha y probada`
- **T-18** Cuentas sembradas piden cambiar la clave al primer ingreso. Cubre: RF-18. Hecho cuando: el administrador y el operador recién sembrados deben crear una contraseña propia antes de usar el panel. `[x] Hecha y probada`

## Parte 2d · Fotos: ver y descargar (aprobado 21-11-2026)

- **T-19** Foto ampliada dentro de la misma página con X, tecla Esc y toque fuera para cerrar, y miniaturas más pequeñas para el cliente (guía 96 px, paquete 64 px). Cubre: RF-129, RF-132. Hecho cuando: tocar una foto la amplía sin abrir otra pestaña, la X la cierra y la foto de la guía del cliente se ve como miniatura. `[x] Hecha y probada`
- **T-20** Botón «Descargar foto» con nombre claro, en la foto ampliada y junto a las fotos del paquete y de la guía del personal; el menú de compartir del teléfono se conserva. Cubre: RF-130, RF-131. Hecho cuando: en la PC se descarga `paquete-<tracking>.jpg`, `guia-Consolidacion-<número>.jpg` y el comprobante de pago como `comprobante-Consolidacion-<número>-<referencia>.jpg`, y si la descarga falla se ve un mensaje. `[x] Hecha y probada`

## Parte 2e · Avisos de confirmación (aprobado 21-11-2026)

- **T-21** Crear el aviso de confirmación con diseño de la marca (título, pregunta, dos botones con verbo, botón de riesgo en rojo), que se cierra con X, Esc o tocando fuera y devuelve el foco. Cubre: RF-133, RF-134, RF-135. Hecho cuando: el aviso se abre, responde a los tres modos de cierre y la prueba automática lo comprueba. `[ ] Hecha y probada`
- **T-22** Reemplazar los cinco avisos del navegador por el nuevo (quitar paquete, eliminar alerta, confirmar recepción, deshacer envío, confirmar entrega) y mostrar el error en la pantalla si la acción falla. Cubre: RF-136, RF-137. Hecho cuando: cada una de las cinco acciones pide confirmación con el aviso de la marca y no aparece ningún cuadro del navegador. `[ ] Hecha y probada`

## Parte 2f · Pagos por revisar en masa (aprobado 21-11-2026)

- **T-23** Quitar el tope de 200 de la lista de pagos por revisar: el servidor entrega todos los pagos pendientes en una sola respuesta, con cliente, monto, método, referencia, fecha y si tiene comprobante. Cubre: RF-138, RF-139, RF-140. Hecho cuando: con 250 pagos pendientes la respuesta trae los 250 y el primero es el más antiguo. `[ ] Hecha y probada`
- **T-24** Pantalla de pagos como lista compacta con buscador, filtro por método y orden (más antiguo, más reciente, mayor monto), sin cargar comprobantes. Cubre: RF-139, RF-141. Hecho cuando: buscar por cliente o referencia y filtrar por método actualiza la lista al instante. `[ ] Hecha y probada`
- **T-25** Selección de filas en una sola tabla con encabezado fijo, contador con el total en dólares y «seleccionar todos los visibles». Cubre: RF-142. Hecho cuando: con 300 pagos se ven todos en una tabla, marcar 3 filas muestra «3 seleccionados» con su suma y el botón de lote. `[ ] Hecha y probada`
- **T-26** Confirmación en lote en el servidor, con máximo 100 pagos por lote, confirmación independiente por pago y resumen de aceptados y fallidos. Cubre: RF-143, RF-144, RF-145, RF-146. Hecho cuando: un lote con un pago ya revisado confirma los demás y devuelve el fallido con su motivo; uno de 101 se rechaza. `[ ] Hecha y probada`
- **T-27** Conectar el lote con el aviso de la marca, sin abrir WhatsApp, y con la fila expandible para confirmar o rechazar un solo pago con su comprobante. Cubre: RF-143, RF-145, RF-147. Hecho cuando: confirmar 5 pagos muestra una sola confirmación, no abre ventanas de WhatsApp y las cinco filas desaparecen. `[ ] Hecha y probada`

## Parte 2g · Envíos y Bodega a gran escala (aprobado 21-11-2026)

- **T-28** Lista de envíos paginada en el servidor (50 por página, total, filtro de estado con «Activos» por defecto, búsqueda y orden). Cubre: RF-149, RF-150, RF-151, RF-161. Hecho cuando: con 120 envíos la página 3 trae 20, el total dice 120 y un envío antiguo se alcanza paginando. `[ ] Hecha y probada`
- **T-29** Pantalla de Envíos como tabla con filtros, orden y paginación, y selección de filas. Cubre: RF-148, RF-150. Hecho cuando: se ven las columnas pedidas, el filtro y el orden cambian la lista y la selección se mantiene al cambiar de página. `[ ] Hecha y probada`
- **T-30** Descargar Excel (.xlsx) de envíos y de la Bodega con el filtro actual, formato legible y protección contra fórmulas. Cubre: RF-152, RF-153, RF-159. Hecho cuando: el archivo abre en Excel con tildes correctas, encabezado con color de marca, columnas legibles, trae todas las filas filtradas y una celda «=SUMA(1)» sale como texto. `[ ] Hecha y probada`
- **T-31** Despachar varios envíos pagados con guía por envío en una sola pantalla, con resultado por envío. Cubre: RF-154, RF-160. Hecho cuando: con 3 envíos pagados y uno ya despachado, salen 2 y el otro aparece con su motivo. `[ ] Hecha y probada`
- **T-32** Bodega como tabla con días en bodega, avisado, foto, orden y filtros (sin dueño, sin avisar, 7/15/30 días). Cubre: RF-155, RF-156, RF-161. Hecho cuando: filtrar «15 días o más» muestra solo los paquetes con 15 o más días en bodega. `[ ] Hecha y probada`
- **T-33** Marcar varios paquetes como avisados y asignar varios paquetes sin dueño a un cliente, con máximo 100 y resultado por paquete. Cubre: RF-157, RF-158, RF-160. Hecho cuando: un lote con un paquete ya consolidado asigna los demás e informa ese. `[ ] Hecha y probada`

## Parte 2h · Datos de entrega vistos por el personal (aprobado 21-11-2026)

- **T-34** Mostrar al personal los datos de entrega completos como resumen de solo lectura con «Corregir datos», el formulario solo si faltan o se pide corregir, y sin botón cuando el envío ya salió. Cubre: RF-162, RF-163, RF-164, RF-165. Hecho cuando: tras confirmar el pago de Rosa, el envío muestra sus datos del perfil sin formulario, y «Corregir datos» abre el formulario con un botón de cancelar. `[ ] Hecha y probada`
- **T-35** Copiar el perfil a la entrega del envío al confirmar el pago que lo cubre (sin sobrescribir lo escrito), cargar los envíos de prueba con los datos del perfil y ofrecer el botón «Usar los datos del perfil de» el cliente. Cubre: RF-166, RF-167, RF-168. Hecho cuando: el envío de prueba de Rosa llega a «Enviando a Venezuela» con su agencia, ciudad y estado ya puestos, sin escribir nada a mano. `[ ] Hecha y probada`
- **T-36** Resumen de Administración con tarjetas que llevan a cada sección y menú agrupado que recuerda la sección abierta. Cubre: RF-169, RF-170. Hecho cuando: al entrar como admin se ve el resumen, al pulsar «Personas sin cambiar clave» se abre Usuarios filtrado, y recargar deja la misma sección. `[ ] Hecha y probada`
- **T-37** Lista de personal con buscador, filtros por rol y estado, contadores, «Nuevo usuario» en cuadro y confirmación al desactivar. Cubre: RF-171, RF-172, RF-173. Hecho cuando: con 10 empleados se encuentra a uno escribiendo su nombre sin bajar, se crea un usuario sin que la lista se mueva y desactivar pregunta antes. `[ ] Hecha y probada`
- **T-38** Mensajes de WhatsApp de uno en uno con selector. Cubre: RF-174. Hecho cuando: se elige «Pago rechazado», se edita y se guarda sin ver los otros cuatro cuadros. `[ ] Hecha y probada`
- **T-39** Vista previa con datos de ejemplo y botón «Enviarme una prueba» en cada mensaje de WhatsApp. Cubre: RF-175, RF-176. Hecho cuando: al editar «Pago rechazado» se ve el texto sin llaves, y el botón abre WhatsApp al número de la empresa con ese texto. `[ ] Hecha y probada`
- **T-40** Mostrar u ocultar cada método de pago desde Administración y ocultar sus datos al cliente, con el tipo de cuenta corriente o ahorro. Cubre: RF-177, RF-178, RF-180. Hecho cuando: al ocultar Binance no aparece en el selector ni en la pantalla de pago del cliente, y al mostrar la transferencia aparece «Cuenta corriente» junto al número. `[ ] Hecha y probada`
- **T-41** Rechazar comprobantes con un método oculto y avisar al cliente cuando no hay ninguno visible. Cubre: RF-179, RF-181. Hecho cuando: con los tres ocultos la pantalla de pago dice que no hay métodos disponibles, y un envío directo a la API con Binance oculto responde con error. `[ ] Hecha y probada`
- **T-42** Quitar la casilla de datos de prueba del panel y cargar los datos de pago reales (pago móvil y transferencia visibles, Binance oculto). Cubre: RF-182. Hecho cuando: en Datos de pago no aparece la casilla y el cliente ve pago móvil y transferencia con los datos del negocio y sin aviso de prueba. `[ ] Hecha y probada`

## Parte 3 · Por definir: panel del operador por módulos y comodidad del escaneo

Todavía no es spec ni tarea: son los pedidos de Luis (20-11-2026) para hacer después del lote. Antes de programar se escriben en `spec.md`.

- El operador no debe ver todo en una sola sección: el panel se divide por módulo según lo que está haciendo (consolidando, verificando pagos, enviando…), cada uno mostrando solo lo de ese momento.
- El programa debe ser intuitivo para alguien sin experiencia ni agilidad con la computadora: pasos claros, textos cortos, botones grandes y una sola cosa importante por pantalla.
- El módulo de escaneo debe ser cómodo para los trabajadores.
- [NECESITA ACLARACIÓN: ¿qué módulos quiere el operador? Propuesta: Recepción (escanear y bodega), Consolidaciones (solicitudes y cotizar), Pagos (revisar y aprobar), Envíos a Venezuela (guías y fotos) y Entregas.]
- [NECESITA ACLARACIÓN: ¿qué incomoda hoy del escaneo? Por ejemplo: tener que tocar para escanear el siguiente, no oír ni sentir la confirmación, la letra pequeña, tener una sola mano libre o escanear muchos paquetes seguidos.]
- [NECESITA ACLARACIÓN: ¿quiénes usan el panel y con qué aparato? Por ejemplo, un celular por trabajador, una PC compartida, o ambos.]
