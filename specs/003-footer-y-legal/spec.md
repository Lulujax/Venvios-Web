# 003 · Pie de página y páginas legales

Estado: BORRADOR para aprobar. Depende de la spec 002 (página pública y contacto editable).

## Qué es y por qué

La página pública de Venvios Express termina hoy en dos líneas: el copyright y un enlace «Acceso del personal» que lleva a la entrada de clientes (`/ingresar`). Eso no sirve para dos cosas que el negocio necesita:

1. **Confianza y contacto.** Quien llega de una publicación de Instagram o de un enlace de WhatsApp quiere ver rápido qué hace la empresa, cómo escribirle, dónde está y qué puede hacer ahora. Hoy esa información está repartida y parte escrita a mano en el código.
2. **Respaldo legal.** Un servicio que recibe paquetes, cobra dinero y guarda cédulas, teléfonos y comprobantes necesita Términos y condiciones y Política de privacidad publicados, con los datos reales que la empresa tiene. Sin eso, el cliente no tiene a qué atenerse y la empresa queda sin respaldo escrito.

El pie también es el lugar donde se cumple el crédito de autoría («Desarrollado por Lulujax») y donde el cliente encuentra de nuevo el botón para calcular su envío o registrarse.

### Estado actual (revisado antes de escribir esta spec)

- El pie vive dentro `frontend/src/pages/Landing.tsx` y solo muestra `© {año} Venvios Express · Tu mejor opción` y el enlace «Acceso del personal» a `/ingresar`.
- El año ya se calcula solo; se conserva esa idea.
- Los datos de contacto (WhatsApp, dirección, Instagram, Facebook, TikTok) ya se editan desde el panel del administrador y llegan a la página pública (spec 002, RF-87). El pie debe usar esa misma fuente.
- La sección de contacto de la portada muestra `@venviosexpress` escrito a mano; es un dato duplicado que se corrige al pasar el pie a la configuración.
- No hay páginas legales publicadas.
- Ya existe una página propia de «no encontramos» (404) y un favicon; se revisan en otra spec de la lista de SEO.

### Datos que se usan

- **Nombre comercial:** Venvios Express.
- **Dirección:** la de la oficina que ya está cargada en la configuración.
- **Correo:** uno genérico (`contacto@venviosexpress.com`) editable desde el panel; hay que crearlo antes de publicar.
- **WhatsApp:** el que ya está configurado y se cambia desde el panel.
- **Redes:** Instagram, Facebook y TikTok de la configuración.

## Requisitos

### Pie de página

- **RF-1** EL SISTEMA mostrará al final de las páginas públicas un pie con esta estructura, de arriba abajo: la marca con una descripción corta y sus redes sociales; cuatro columnas («Marca», «Servicios», «Ayuda», «Legal y pagos»); una línea divisoria; y una franja inferior con los datos disponibles, el crédito de autoría y el copyright.
- **RF-2** EL SISTEMA mostrará en el pie solo enlaces a páginas o secciones que existan. SI una opción todavía no tiene página, ENTONCES EL SISTEMA no la mostrará como enlace.
- **RF-3** EL SISTEMA tomará del panel del administrador el WhatsApp de atención, la dirección, el correo y las redes sociales que muestra el pie. No los escribirá fijos en el código.
- **RF-4** CUANDO la persona pulse el botón de WhatsApp del pie, EL SISTEMA abrirá en una pestaña nueva un chat con el número de atención configurado y un mensaje inicial ya escrito.
- **RF-5** EL SISTEMA mostrará en el pie un botón principal con un verbo al inicio («Calcula tu envío» o «Regístrate») que lleve a la calculadora de la portada o al registro.
- **RF-6** EL SISTEMA calculará el año del copyright al mostrar la página, sin escribirlo a mano.
- **RF-7** EL SISTEMA mostrará en la franja inferior el crédito «Desarrollado por Lulujax», como enlace a `https://lulujax.netlify.app/` que abre en pestaña nueva y sin que esa página pueda leer ni controlar la de Venvios.
- **RF-8** EL SISTEMA mostrará el pie apilado en una columna en el teléfono y en cuatro columnas en pantalla grande, sin desbordes ni texto cortado, de 375 px a 1280 px de ancho.
- **RF-9** EL SISTEMA mostrará en la franja inferior el nombre comercial y la dirección de la oficina, junto con el aviso de que los precios se cobran en dólares y se pueden pagar en bolívares a la tasa BCV del día.
- **RF-10** EL SISTEMA no mostrará en el pie ningún enlace al panel del personal. Se retira el enlace «Acceso del personal» que hoy lleva a `/ingresar`.
- **RF-11** EL SISTEMA abrirá en pestaña nueva todo enlace externo del pie, sin que la página de destino pueda leer ni controlar la de Venvios.
- **RF-12** EL SISTEMA mostrará el mismo pie en la portada, en las páginas legales y en la página de «no encontramos», sin duplicar su contenido en cada pantalla.

### Páginas legales

- **RF-13** EL SISTEMA tendrá una página propia para los Términos y condiciones y otra para la Política de privacidad, cada una con su dirección, su título, la fecha de última actualización y un enlace para volver al inicio.
- **RF-14** EL SISTEMA redactará ambas páginas con los datos que la empresa tiene (nombre comercial, dirección de la oficina, correo y WhatsApp) y con lo que el servicio realmente hace: casillero, recepción en Cúcuta, peso, tarifas, seguro de carga, formas de pago, despacho y entrega.
- **RF-15** EL SISTEMA mostrará al inicio de ambas páginas, visible y sin letra pequeña, el aviso de que el texto es un borrador pendiente de revisión por un abogado en Venezuela.
- **RF-16** La Política de privacidad dirá qué datos se guardan (nombre, cédula, correo, teléfono, datos de entrega y comprobantes de pago), para qué se usan, quién los ve, cuánto tiempo se conservan y cómo la persona puede pedir su corrección o eliminación.
- **RF-17** EL SISTEMA no publicará ninguna otra página legal distinta de Términos y condiciones y Política de privacidad. SI en el futuro se agrega una, ENTONCES se escribirá su contenido primero y solo después aparecerá el enlace.
- **RF-18** EL SISTEMA mostrará los enlaces a las páginas legales en el pie de todas las páginas públicas de contenido.
- **RF-19** SI alguien escribe la dirección de una página legal que todavía no existe, ENTONCES EL SISTEMA mostrará la página de «no encontramos», nunca una pantalla en blanco ni un enlace vacío.
- **RF-20** EL SISTEMA permitirá leer las páginas legales en el teléfono sin desplazamiento horizontal y con texto de tamaño legible.

### Datos de la empresa en un solo lugar

- **RF-21** EL SISTEMA tomará el nombre comercial, el correo, el WhatsApp, la dirección y las redes de un solo lugar editable por el administrador, para que el pie y las páginas legales no se contradigan.

### Horario y lema

- **RF-22** EL SISTEMA guardará el horario de atención junto a los demás datos de contacto, editable por el administrador. El valor inicial será «Lunes a sábado, 8:00 am a 5:00 pm (hora Colombia), horario continuo. Domingos y feriados no laboramos.», tomado de la publicación oficial de Venvios Express.
- **RF-23** EL SISTEMA mostrará el horario de atención en la sección «Contacto» de la portada y en la franja inferior del pie, tomándolo de la configuración.
- **RF-24** SI el administrador deja el horario vacío, ENTONCES EL SISTEMA no mostrará la línea del horario en la portada ni en el pie. SI escribe más de 200 caracteres, ENTONCES EL SISTEMA rechazará el cambio con un mensaje claro.
- **RF-25** SI la configuración de contacto guardada antes de este cambio no tiene horario, ENTONCES EL SISTEMA usará el horario inicial, tanto en la página pública como en el formulario del administrador.
- **RF-26** EL SISTEMA mostrará el lema de la marca, «Tu mejor opción», en la parte principal de la portada, encima del título.

## Datos pendientes

Nada pendiente. Confirmado por Luis:

- El correo `contacto@venviosexpress.com` se usa por ahora y hay que crearlo antes de publicar.
- El WhatsApp 573237968740 es el número inicial oficial y se cambia desde el panel cuando haga falta.

## Cómo sé que está listo

- Abro la portada en el teléfono (375 px) y en la PC (1280 px): veo la marca con su descripción y redes, las cuatro columnas, la línea divisoria y la franja inferior. En el teléfono las columnas se apilan y nada se sale de la pantalla.
- El año del copyright es el año actual, sin haberlo escrito en el código.
- El crédito «Desarrollado por Lulujax» abre `https://lulujax.netlify.app/` en una pestaña nueva.
- Cambio el WhatsApp en el panel del administrador y el botón del pie abre el chat con el número nuevo, con mensaje ya escrito.
- No encuentro en el pie ningún enlace al panel del personal.
- Cada enlace del pie abre una página o sección que existe; ninguno da «no encontramos».
- Leo Términos y condiciones y Política de privacidad completos en el teléfono, con los datos disponibles y el aviso de borrador pendiente de revisión por un abogado.
- Veo «Tu mejor opción» encima del título de la portada, y el horario en «Contacto» y en el pie. Lo cambio en Admin → Transporte → Contacto público y la portada muestra el nuevo; si lo dejo vacío, desaparece.
- Las pruebas automáticas del pie, del año, del crédito, de los enlaces y de las páginas legales pasan.

## Fuera de alcance

- **Revisión legal real.** El texto se entrega como borrador; la revisión por un abogado en Venezuela la hace una persona, no el sistema.
- **Aviso de cookies y Google Analytics 4.** Luis decidió dejarlo para cuando exista la cuenta de Google Analytics. No se instala medición ni se muestra aviso en esta spec.
- **Razón social, RIF y domicilio fiscal.** Luis decidió no publicarlos.
- **La lista de seguridad y SEO**, que va en specs separadas y no se mezcla con esta:
  - 004: claves y secretos fuera de Git (incluye decidir si se reescribe el historial, que es destructivo y necesita autorización).
  - 005: seguridad de Supabase (protección por filas, clave pública, accesos).
  - 006: cifrado de datos recuperables y hash de contraseñas (la spec 002 ya define el comportamiento; falta verificarlo con servicios reales).
  - 007: fuerza de autenticación y límite de intentos.
  - 008: cookies de sesión protegidas y validación de todo en el servidor.
  - 009: protección contra bots y límite de llamadas a la API.
  - 010: consultas parametrizadas, validación y escape de contenido del usuario.
  - 011: cabeceras de seguridad y HTTPS obligatorio.
  - 012: metadescripciones, Open Graph, favicon y página 404 (revisión de lo que ya existe).
  - 013: enlaces rotos en todo el sitio (esta spec solo cubre los del pie).
  - 014: validación de formularios en frontend y backend con mensajes claros.
  - 015: anti-spam en formularios y enlaces externos seguros en todo el sitio.
  - 016: aviso de cookies y Google Analytics 4, cuando exista la cuenta.
- **Rediseño de la portada** más allá del pie y de quitar el `@venviosexpress` escrito a mano.
- **Facturación, aviso legal de comercio electrónico completo o registro de marca.**
