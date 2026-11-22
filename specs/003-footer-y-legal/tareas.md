# Tareas 003 · Pie de página y páginas legales

Una tarea a la vez, con sus pruebas unitarias. La casilla se marca solo cuando Luis confirma que la prueba manual pasó. Rama: `testing`. Todo se prueba con `npm run dev`, en el teléfono y en la laptop; no se despliega a Netlify para probar.

## Estado (21-11-2026)

Programado con pruebas automáticas que pasan (backend 216, frontend 175), a la espera de tu prueba manual: **T-1 a T-16**. Ninguna casilla está marcada porque falta tu prueba.

## Parte 1 · Pie de página

- **T-1** Agregar el correo de contacto a la configuración pública, con validación en el servidor solo cuando tenga contenido y campo en el panel del administrador. Cubre: RF-21. Hecho cuando: el administrador guarda el correo, uno mal formado se rechaza con mensaje claro y la información pública lo entrega. `[ ] Hecha y probada`
- **T-2** Crear el componente de pie con la marca, una descripción corta y los iconos de redes sociales tomados de la configuración. Cubre: RF-1, RF-3. Hecho cuando: al cambiar las redes en el panel, el pie muestra las nuevas sin tocar código. `[ ] Hecha y probada`
- **T-3** Agregar las columnas «Servicios», «Ayuda» y «Legal y pagos», mostrando como enlace solo lo que ya tiene página o sección y el resto como texto sin enlace. Cubre: RF-1, RF-2. Hecho cuando: ninguna opción sin destino aparece como enlace y las que existen abren su pantalla o su sección. `[ ] Hecha y probada`
- **T-4** Construir la franja inferior: nombre comercial, dirección de la oficina, aviso de cobro en dólares con pago en Bs a tasa BCV, año calculado automáticamente y crédito «Desarrollado por Lulujax» con enlace a `https://lulujax.netlify.app/`. Cubre: RF-6, RF-7, RF-9. Hecho cuando: el año mostrado es el actual y el crédito abre el sitio en una pestaña nueva. `[ ] Hecha y probada`
- **T-5** Agregar el botón principal del pie con verbo al inicio («Calcula tu envío») y su destino. Cubre: RF-5. Hecho cuando: el botón lleva a la calculadora y se lee con verbo primero. `[ ] Hecha y probada`
- **T-6** Poner en el pie el botón de WhatsApp con el número de atención de la configuración y un mensaje inicial ya escrito. Cubre: RF-3, RF-4. Hecho cuando: cambio el número en el panel y el botón abre el chat con el número nuevo. `[ ] Hecha y probada`
- **T-7** Reemplazar el pie viejo de la portada por el componente nuevo, quitar el enlace «Acceso del personal» y quitar el `@venviosexpress` escrito a mano de la sección de contacto. Cubre: RF-10, RF-12. Hecho cuando: no queda ningún enlace al panel del personal ni texto de red social fijo en el código, y el contacto sigue mostrándose desde la configuración. `[ ] Hecha y probada`
- **T-8** Ajustar el pie para el teléfono y la pantalla grande, con las columnas apiladas y sin desbordes. Cubre: RF-8. Hecho cuando: a 375 px, 768 px y 1280 px no hay desplazamiento horizontal ni texto cortado, y las columnas se apilan en el teléfono. `[ ] Hecha y probada`
- **T-9** Asegurar que todo enlace externo del pie abra en pestaña nueva y sin que la página de destino pueda leer ni controlar la de Venvios. Cubre: RF-11. Hecho cuando: una prueba revisa los enlaces externos del pie y todos cumplen. `[ ] Hecha y probada`

## Parte 2 · Páginas legales

- **T-10** Crear la pantalla común de páginas legales: título, fecha de última actualización, texto por secciones, enlace para volver al inicio y aviso visible de borrador pendiente de revisión por un abogado. Cubre: RF-13, RF-15, RF-20. Hecho cuando: una página de prueba se lee completa en el teléfono sin desplazamiento horizontal y el aviso se ve antes del texto. `[ ] Hecha y probada`
- **T-11** Agregar las rutas `/terminos` y `/privacidad` y confirmar que una dirección que no existe cae en la página de «no encontramos». Cubre: RF-13, RF-19. Hecho cuando: las dos rutas abren su pantalla y una dirección inventada muestra la 404 propia. `[ ] Hecha y probada`
- **T-12** Redactar los Términos y condiciones con los datos disponibles (nombre comercial, dirección, correo, WhatsApp) y lo que hace el servicio: casillero, peso, tarifas, seguro, pagos, despacho y entrega. Cubre: RF-14, RF-15. Hecho cuando: el texto no tiene datos de ejemplo, tiene el aviso de borrador y su fecha de actualización. `[ ] Hecha y probada`
- **T-13** Redactar la Política de privacidad con los datos que se guardan, para qué, quién los ve, cuánto tiempo y cómo pedir corrección o eliminación. Cubre: RF-14, RF-15, RF-16. Hecho cuando: el texto cubre los datos de la spec 002 (cédula, nombre, teléfono, datos de entrega y comprobantes) sin inventar plazos ni terceros. `[ ] Hecha y probada`
- **T-14** Enlazar Términos y Privacidad desde el pie. Cubre: RF-18. Hecho cuando: los enlaces aparecen en el pie de la portada y de las páginas legales, y cada uno abre su página. `[ ] Hecha y probada`
- **T-15** Mostrar el mismo pie en la portada, en las páginas legales y en la 404. Cubre: RF-12. Hecho cuando: las tres pantallas muestran el pie idéntico y ninguna lo tiene escrito aparte. `[ ] Hecha y probada`

## Parte 2b · Horario y lema

- **T-18** Agregar el horario a la configuración de contacto: valor inicial de la publicación oficial, máximo 200 caracteres, vacío permitido, completado cuando la configuración guardada es vieja (también en el formulario del administrador) y campo en Admin → Transporte → Contacto público. Cubre: RF-22, RF-24, RF-25. Hecho cuando: el administrador guarda un horario nuevo y la información pública lo entrega; uno de más de 200 caracteres se rechaza con mensaje claro. `[ ] Hecha y probada`
- **T-19** Mostrar el horario en la sección «Contacto» de la portada y en la franja inferior del pie, sin línea cuando está vacío. Cubre: RF-23, RF-24. Hecho cuando: el horario se ve en ambos lugares y desaparece al dejarlo vacío. `[ ] Hecha y probada`
- **T-20** Mostrar el lema «Tu mejor opción» encima del título de la portada. Cubre: RF-26. Hecho cuando: el lema se lee en el teléfono y en la PC sin empujar ni cortar el título. `[ ] Hecha y probada`

## Parte 3 · Cierre

- **T-16** Revisar todos los enlaces del pie y de las páginas legales, y dejar una prueba que falle si un enlace apunta a una ruta o sección que no existe. Cubre: RF-2, RF-18. Hecho cuando: la prueba recorre los enlaces, todos tienen destino y no queda ningún enlace al panel del personal. `[ ] Hecha y probada`
- **T-17** Prueba manual final en teléfono y laptop con `npm run dev`: pie a 375 px y 1280 px, año, crédito, WhatsApp cambiado desde el panel, lectura de las dos páginas legales y revisión de que no aparece ningún enlace al panel. Cubre: RF-1 a RF-26. Hecho cuando: los puntos de «Cómo sé que está listo» de `spec.md` se cumplen en el teléfono y en la laptop. `[ ] Hecha y probada`
