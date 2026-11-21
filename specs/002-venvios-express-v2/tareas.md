# Tareas 002 · Venvios Express, del casillero a la entrega

Una tarea a la vez. Cada una incluye sus pruebas unitarias. La casilla se marca solo cuando Luis confirma que la prueba manual pasó.

## Estado (21-11-2026)

Programado y con pruebas automáticas que pasan (backend 181, frontend 136), a la espera de tu prueba manual: V-1 a V-9 y las tareas T-1, T-1b, T-1d, T-2, T-3, T-4a, T-4b, T-4c, T-4d, T-5, T-6, T-7 y T-8. Ninguna casilla está marcada porque faltan tus pruebas.

Programado solo en parte:
- **T-1c**: las pantallas ya muestran de 10 en 10 con «Ver 10 más», buscador por tracking y «Elegir todos» (Consolidar, agregar de bodega, bodega, envíos, pedidos y alertas). Falta que el servidor entregue las listas por tandas con el total exacto (hoy descarga todo y la pantalla recorta) y aplicarlo al historial.
- **T-9**: el operador ya recorre el flujo (cotizar, pagos por revisar, enviar, en ruta), pero falta ordenarlo por módulos; depende de la Parte 3.

Sin hacer: **T-10** (producción: se hace al final, para no quitar los datos de prueba mientras pruebas). No se ha podido probar sin cuentas reales: la migración contra Supabase (hay que aplicar el esquema nuevo y `backend/prisma/migrar-valores-por-guia.sql`), el almacenamiento real de imágenes, el despliegue en Netlify, `npm run e2e` ni las cámaras reales de Android y iPhone.

## Parte 1 · Lo ya construido: falta tu prueba manual

No es trabajo de programación: es comprobar a mano, en el orden que conviene, lo que ya existe. Las partes que cambian en la parte 2 se vuelven a probar al terminar su tarea.

- **V-1** Cuentas y acceso: registro, casillero, entrada con correo o casillero, bloqueo por intentos, clave temporal, personal. Cubre: RF-7 a RF-18. Hecho cuando: cada flujo se recorre sin errores en teléfono y PC. `[ ] Hecha y probada`
- **V-2** Cuenta del cliente y prealertas: Inicio, Alertas, crear y eliminar una alerta, tracking repetido. Cubre: RF-19 a RF-30. Hecho cuando: las cinco secciones cargan y una alerta pasa de «Pendiente» a «Atendida» al escanearla. `[ ] Hecha y probada`
- **V-3** Escaneo con el teléfono: cámara, foto, entrada manual, resultado arriba, cámara que se apaga sola, código de Coordinadora. Cubre: RF-31 a RF-44. Hecho cuando: con HTTPS en un Android y en un iPhone se leen QR y códigos de barras reales. `[ ] Hecha y probada`
- **V-4** Bodega y casos especiales: paquete sin prealerta, sin dueño, cambio de dueño, descarte con motivo, unión con una alerta nueva. Cubre: RF-45 a RF-49. Hecho cuando: el recorrido del README (puntos 2 y 3) funciona. `[ ] Hecha y probada`
- **V-5** Consolidar, cotizar y pagar tal como está hoy: elegir paquetes, pesar, ver el total, pagar con comprobante, confirmar o rechazar. Cubre: RF-50 a RF-67. Hecho cuando: 4,35 kg con 60 $ declarados dan 44,33 $ y el pago llega a «Pagado». Se repite al terminar T-3, T-4 y T-5. `[ ] Hecha y probada`
- **V-6** Despacho y entrega tal como está hoy: datos de entrega, guía con foto, aviso por WhatsApp, entregado. Cubre: RF-68 a RF-74. Hecho cuando: no deja despachar sin pago ni sin datos, y el cliente ve la guía y la foto. Se repite al terminar T-1 y T-8. `[ ] Hecha y probada`
- **V-7** Lista de envíos, filtros, búsqueda, historial y resumen del personal. Cubre: RF-77, RF-80, RF-81. Hecho cuando: el buscador encuentra por nombre, teléfono, tracking y guía. `[ ] Hecha y probada`
- **V-8** Página pública y administración: tarifas, calculadora, rastreador, tasa BCV, datos de pago, plantillas, transportistas, contacto. Cubre: RF-1 a RF-6, RF-82 a RF-87. Hecho cuando: lo que cambia el administrador se ve en la página y en los mensajes. `[ ] Hecha y probada`
- **V-9** Seguridad y solidez con servicios reales: migración, protección por filas, fotos privadas, arranque sin configuración, despliegue. Cubre: RF-90 a RF-99. Hecho cuando: Supabase y Netlify están configurados y el recorrido completo funciona en producción de prueba. `[ ] Hecha y probada`

## Parte 2 · Lote: flujo completo de consolidación a entrega

Se hace en este orden. Detalle del cómo en `plan.md`.

- **T-1** Nombres cortos de estado («Por pagar», «Pago en revisión», «Enviando a Venezuela», «En ruta», «Entregado») y mensaje de pago verificado que ya no pide datos. Cubre: RF-68, RF-75, RF-76. Hecho cuando: cliente y personal ven los nombres nuevos en listas, detalle y mensajes. `[ ] Hecha y probada`
- **T-1b** Pantalla del envío por consolidar en pasos y por etapa (operador): paquetes con quitar y agregar en la misma sección, peso y cobro, y «Calcular total» al final; sin peso por paquete; foto del paquete en el escaneo; corrección del administrador solo con pago. Cubre: RF-41, RF-42, RF-57, RF-100, RF-101. Hecho cuando: el operador consolida un envío siguiendo los pasos de arriba abajo sin ver bloques de otras etapas. `[ ] Hecha y probada`
- **T-1c** Listas largas de 10 en 10: el servidor entrega por tandas con el total, un componente de lista con contador y «Ver 10 más», buscador por tracking y «Elegir todos» donde se eligen paquetes; se aplica a bodega, envíos, paquetes del consolidado, agregar de bodega, Consolidar, Pedidos, Alertas e historial. Cubre: RF-77, RF-111, RF-112, RF-113. Hecho cuando: con 240 paquetes en la bodega de un cliente se ven 10, se busca una guía sin bajar y «Elegir todos» marca los que coinciden. `[ ] Hecha y probada`
- **T-1d** Ajustes de operación: guía por foto o por número (RF-70, RF-71), nombre «Consolidación» con código corto (RF-114) y «Registrar» en el menú (RF-115). Hecho cuando: se despacha solo con foto y aparece «Enviar guía por WhatsApp», Finanzas muestra «Consolidación XXXXXX» y el menú dice «Registrar». `[ ] Hecha y probada`
- **T-2** Pago con Binance: monto en dólares, captura e ID de la transacción sin máximo; pago móvil y transferencia con 6 a 12 dígitos. Cubre: RF-61. Hecho cuando: un ID largo de Binance se acepta y uno con guiones se rechaza. `[ ] Hecha y probada`
- **T-3** Valor declarado por guía en la prealerta (formulario y datos guardados), suma automática al consolidar y migración de los envíos existentes. Cubre: RF-26, RF-50. Hecho cuando: consolido 2 de 3 paquetes de una alerta y el valor del envío es la suma de esos 2. `[ ] Hecha y probada`
- **T-4a** Perfil del cliente, parte «Mis datos»: corregir nombre, correo, teléfono y contraseña pidiendo la contraseña actual; casillero y cédula solo de lectura. Cubre: RF-102, RF-103, RF-104. Hecho cuando: un cambio de correo o teléfono repetido se rechaza y la contraseña nueva cierra las demás sesiones. `[ ] Hecha y probada`
- **T-4b** Perfil del cliente, parte «Mis datos de entrega»: quién recibe y agencia, ciudad y estado para MRW y para Zoom, cifrados, con migración desde el último envío de cada cliente. Cubre: RF-106, RF-107. Cubre también: RF-116. Hecho cuando: el cliente guarda sus datos de MRW sin llenar los de Zoom, sus datos quedan cifrados y los clientes de prueba cargan con sus datos de entrega ya llenos. `[ ] Hecha y probada`
- **T-4c** Consolidar y el envío usan el perfil: resumen con «Cambiar en mi perfil», copia fija al solicitar, «Actualizar con mi perfil», el operador corrige, y se quita el formulario de dirección del cliente. Cubre: RF-50, RF-51, RF-52, RF-108, RF-109. Hecho cuando: con el perfil incompleto no se envía la solicitud, y cambiar el perfil después no cambia un envío ya solicitado. `[ ] Hecha y probada`
- **T-4d** Corrección de cédula por el administrador: buscar al cliente, cambiar la cédula con motivo, volver a cifrar y recalcular la huella, y dejar el historial de la cuenta. Cubre: RF-105, RF-110. Hecho cuando: el administrador corrige una cédula, una repetida se rechaza, el operador y el cliente no pueden y el historial guarda quién, cuándo y por qué sin la cédula anterior completa. `[ ] Hecha y probada`
- **T-5** Cotización editable: valor por paquete y seguro con motivo e historial (operador antes del pago, administrador después), «volver a automático» y «Enviar cotización». Cubre: RF-53, RF-56, RF-57, RF-58. Hecho cuando: el total se recalcula, el historial guarda el valor anterior y el operador recibe «prohibido» tras el pago. `[ ] Hecha y probada`
- **T-6** Tabla de pasos por paquete y su registro en cada transición (prealerta, escaneo, consolidar, cotizar, pago, despacho, entrega, devolución a bodega). Cubre: RF-78, RF-79. Hecho cuando: cada transición agrega un paso por cada paquete afectado y la devolución a bodega reinicia desde «En oficina». `[ ] Hecha y probada`
- **T-7** Seguimiento por paquete visible en la cuenta del cliente y del personal, con pasos cortos y fechas. Cubre: RF-22, RF-78. Hecho cuando: un paquete consolidado muestra su recorrido completo aunque haya cambiado de envío. `[ ] Hecha y probada`
- **T-8** Cierre: el cliente pulsa «Ya lo recibí» y el operador puede marcar «Entregado» con confirmación en pantalla. Cubre: RF-72, RF-73. Hecho cuando: las dos vías cierran el envío, quedan en el historial y un cliente no puede cerrar un envío ajeno ni uno que no está «En ruta». `[ ] Hecha y probada`
- **T-9** Pantallas del operador para el flujo: solicitudes de consolidación, cotizar, pagos por revisar, enviando y en ruta, y resumen con los nuevos pendientes. Cubre: RF-52, RF-80. Hecho cuando: el operador recorre el flujo completo sin salir del panel. `[ ] Hecha y probada`
- **T-10** Preparar producción: quitar el archivo de datos de prueba y la variable que lo activa, dejar el HTTPS de desarrollo solo en desarrollo y reemplazar las plantillas de mensajes guardadas que sigan iguales a las de fábrica. Cubre: RF-96. Hecho cuando: el despliegue arranca sin datos de prueba y los mensajes usan los textos nuevos. `[ ] Hecha y probada`

## Parte 2b · Mis envíos, Rastrear y menú (aprobado 21-11-2026)

- **T-11** Número de consolidación solo con cifras, único y buscable. Cubre: RF-114. Hecho cuando: un consolidado nuevo se llama «Consolidación 000001» y el operador lo encuentra escribiendo el número. `[ ] Hecha y probada`
- **T-12** Mis envíos con pestañas Pre-alertas, Activos y Entregados; Alertas fusionada en Pre-alertas. Cubre: RF-21, RF-22. Hecho cuando: cada pestaña muestra solo guía, estado, fecha, valor declarado, total en $ y Rastrear, y la guía abre Rastrear. `[ ] Hecha y probada`
- **T-13** Sección Rastrear para el cliente. Cubre: RF-118, RF-119. Hecho cuando: el cliente busca un tracking o un número de consolidación suyo y ve pasos, detalles e historial; uno ajeno no aparece. `[ ] Hecha y probada`
- **T-14** Menú desplegable encima del contenido en la PC, en la cuenta del cliente y en el panel. Cubre: RF-19, RF-122. Hecho cuando: el menú se abre con un botón, no mueve el contenido y se cierra al elegir una opción o tocar fuera. `[ ] Hecha y probada`
- **T-15** Entradas separadas: `/ingresar` para clientes y `/admin` para el personal. Cubre: RF-120. Hecho cuando: un cliente no entra por `/admin` ni el personal por `/ingresar`, y cada uno ve a dónde ir. `[ ] Hecha y probada`

## Parte 3 · Por definir: panel del operador por módulos y comodidad del escaneo

Todavía no es spec ni tarea: son los pedidos de Luis (20-11-2026) para hacer después del lote. Antes de programar se escriben en `spec.md`.

- El operador no debe ver todo en una sola sección: el panel se divide por módulo según lo que está haciendo (consolidando, verificando pagos, enviando…), cada uno mostrando solo lo de ese momento.
- El programa debe ser intuitivo para alguien sin experiencia ni agilidad con la computadora: pasos claros, textos cortos, botones grandes y una sola cosa importante por pantalla.
- El módulo de escaneo debe ser cómodo para los trabajadores.
- [NECESITA ACLARACIÓN: ¿qué módulos quiere el operador? Propuesta: Recepción (escanear y bodega), Consolidaciones (solicitudes y cotizar), Pagos (revisar y aprobar), Envíos a Venezuela (guías y fotos) y Entregas.]
- [NECESITA ACLARACIÓN: ¿qué incomoda hoy del escaneo? Por ejemplo: tener que tocar para escanear el siguiente, no oír ni sentir la confirmación, la letra pequeña, tener una sola mano libre o escanear muchos paquetes seguidos.]
- [NECESITA ACLARACIÓN: ¿quiénes usan el panel y con qué aparato? Por ejemplo, un celular por trabajador, una PC compartida, o ambos.]
