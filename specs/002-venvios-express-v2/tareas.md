# Tareas 002 · Venvios Express, del casillero a la entrega

Una tarea a la vez. Cada una incluye sus pruebas unitarias. La casilla se marca solo cuando Luis confirma que la prueba manual pasó.

## Estado (20-11-2026)

Todo lo de la parte 1 ya está programado y con pruebas automáticas que pasan (backend 128, frontend 76). Ninguna casilla está marcada porque faltan las pruebas manuales de Luis. No se ha podido probar sin cuentas reales: la migración contra Supabase, el almacenamiento real de imágenes y el despliegue en Netlify; ni el escáner con cámaras reales de Android y iPhone.

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
- **T-2** Pago con Binance: monto en dólares, captura e ID de la transacción; pago móvil y transferencia siguen con 6 dígitos. Cubre: RF-61. Hecho cuando: un ID largo de Binance se acepta y uno demasiado corto se rechaza. `[ ] Hecha y probada`
- **T-3** Valor declarado por guía en la prealerta (formulario y datos guardados), suma automática al consolidar y migración de los envíos existentes. Cubre: RF-26, RF-50. Hecho cuando: consolido 2 de 3 paquetes de una alerta y el valor del envío es la suma de esos 2. `[ ] Hecha y probada`
- **T-4** Datos de entrega al solicitar la consolidación, corregibles por el operador. Cubre: RF-50, RF-51, RF-52. Hecho cuando: el cliente no puede enviar la solicitud sin los datos y el operador los corrige. `[ ] Hecha y probada`
- **T-5** Cotización editable: valor por paquete y seguro con motivo e historial (operador antes del pago, administrador después), «volver a automático» y «Enviar cotización». Cubre: RF-53, RF-56, RF-57, RF-58. Hecho cuando: el total se recalcula, el historial guarda el valor anterior y el operador recibe «prohibido» tras el pago. `[ ] Hecha y probada`
- **T-6** Tabla de pasos por paquete y su registro en cada transición (prealerta, escaneo, consolidar, cotizar, pago, despacho, entrega, devolución a bodega). Cubre: RF-78, RF-79. Hecho cuando: cada transición agrega un paso por cada paquete afectado y la devolución a bodega reinicia desde «En oficina». `[ ] Hecha y probada`
- **T-7** Seguimiento por paquete visible en la cuenta del cliente y del personal, con pasos cortos y fechas. Cubre: RF-22, RF-78. Hecho cuando: un paquete consolidado muestra su recorrido completo aunque haya cambiado de envío. `[ ] Hecha y probada`
- **T-8** Cierre: el cliente pulsa «Ya lo recibí» y el operador puede marcar «Entregado» con confirmación en pantalla. Cubre: RF-72, RF-73. Hecho cuando: las dos vías cierran el envío, quedan en el historial y un cliente no puede cerrar un envío ajeno ni uno que no está «En ruta». `[ ] Hecha y probada`
- **T-9** Pantallas del operador para el flujo: solicitudes de consolidación, cotizar, pagos por revisar, enviando y en ruta, y resumen con los nuevos pendientes. Cubre: RF-52, RF-80. Hecho cuando: el operador recorre el flujo completo sin salir del panel. `[ ] Hecha y probada`
- **T-10** Preparar producción: quitar el archivo de datos de prueba y la variable que lo activa, dejar el HTTPS de desarrollo solo en desarrollo y reemplazar las plantillas de mensajes guardadas que sigan iguales a las de fábrica. Cubre: RF-96. Hecho cuando: el despliegue arranca sin datos de prueba y los mensajes usan los textos nuevos. `[ ] Hecha y probada`
