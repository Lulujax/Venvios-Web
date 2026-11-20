# Plan 001: Recepción, cobro y despacho (Venvios Express)

ARCHIVADO: lo reemplaza `specs/002-venvios-express-v2/`. Se conserva solo como historia.

## Contexto

Venvios Express es un casillero internacional Cúcuta → Venezuela. Hoy todo va por WhatsApp. El proyecto actual (hecho con Gemini) tiene la moneda equivocada (COP), un bot de Twilio que el cliente no pagará, un flujo de cliente distinto y cero pruebas. La spec `specs/001-recepcion-y-despacho/spec.md` está completa y sin preguntas abiertas. Se reestructura el proyecto: se borra lo que no sirve, se rescata lo útil y se construye lo nuevo con pruebas.

Este archivo se copia a `specs/001-recepcion-y-despacho/plan.md` al aprobarse; después se escribe `tareas.md`.

## Decisiones (y por qué)

| Tema | Decisión | Opciones descartadas |
| --- | --- | --- |
| Hosting | Netlify para web y backend (Netlify Functions); Supabase para base de datos Postgres y fotos | Render/Railway (servidor se duerme, tercer servicio); todo Supabase sin backend (rompe «lo delicado vive en el backend») |
| Frontend | React + Vite + TypeScript + Tailwind, PWA instalable | Next.js (innecesario, más pesado para Netlify Functions) |
| Backend | TypeScript, Express envuelto en una sola función de Netlify, capas rutas / servicios / repositorios | Funciones sueltas por ruta (duplican middleware) |
| Datos | Prisma + Postgres (Supabase, conexión con pooler) | SQL a mano |
| Contraseñas | argon2id con `@node-rs/argon2` (funciona en funciones Netlify) | `argon2` nativo (falla al compilar en Lambda), bcryptjs (más lento y menos seguro) |
| Sesión | JWT en cookie httpOnly (ya rescatado) | localStorage (legible por JavaScript) |
| Cédula | Cifrada con AES-256-GCM, llave en variable de entorno | Texto plano |
| Fotos y comprobantes | Bucket privado de Supabase Storage, comprimidas en el navegador, servidas con enlace firmado de corta duración | Disco local (Netlify no guarda archivos), URLs públicas |
| Escáner | `@zxing/library` (rescatado), todos los formatos; si el navegador tiene `BarcodeDetector` se usa de apoyo | Solo QR |
| Pruebas | Vitest (unitarias) + Playwright (flujos clave) | Jest |
| Tasa BCV | Servidor consulta `ve.dolarapi.com/v1/dolares/oficial` (campo `promedio`), la guarda con fecha una vez al día; fallback a la última guardada y carga manual del admin | Consultar desde el navegador |
| WhatsApp | Enlaces `wa.me` / `web.whatsapp.com/send` con texto prellenado; sin API ni bot | Twilio (eliminado) |

## Qué se rescata y qué se borra

**Se rescata (adaptado, sin comentarios):**
- `frontend/src/components/Admin/Scanner.tsx`: base del lector de cámara + compresión de fotos (`browser-image-compression`).
- `backend/src/middleware/{errorHandler,rateLimiters,AuthGuard}.ts`, `config/env.ts`, `utils/{errors,logger,mask}.ts`: manejo de errores, límite de intentos, roles, logs sin datos sensibles.
- Estructura de capas del backend y configuración Vite/Tailwind/TS.

**Se borra:** Twilio y `WhatsAppService`; `QuoteService` y tarifas en COP; modelos `Casillero`, `Notificacion`, guías `VEX-AAAA-NNNNN`, rastreo propio; `RULES.md` (diseño «Waybill», radios de 4 px); `DATOS-DE-PRUEBA.txt`; `README.md` viejo; la carpeta `dist/` y la foto suelta de WhatsApp si no se usa; `docker-compose.yml` se reemplaza si se usa Postgres local para pruebas; componentes de Landing se rehacen con la marca real.

## Modelo de datos (resumen)

- `Usuario`: id, nombre, cedulaCifrada, cedulaHash (para detectar duplicados sin descifrar), telefono, passwordHash, rol (`CLIENTE | OPERADOR | ADMIN`), activo.
- `Envio`: cliente, modalidad (`M1 | M2`), transportista (`MRW | ZOOM`), estado, valorDeclaradoUsd, pesoTotalKg, precioUsd, seguroUsd, tasaBcvUsada, datos de entrega (nombre, cédula cifrada, teléfono, agencia, ciudad, estado), guía venezolana + foto.
- `Paquete`: envío, trackingTexto, trackingNormalizado, pesoKg, fotoPath, recibidoPor/en.
- `Pago`: envío, monto, moneda, método (`BINANCE | PAGO_MOVIL | MANUAL`), referencia, comprobantePath, estado (`POR_CONFIRMAR | CONFIRMADO | RECHAZADO`), motivo, tasaBcv.
- `AjusteManual`: envío, campo, valorAnterior, valorNuevo, motivo, adminId.
- `Evento`: historial por envío (quién, qué, cuándo).
- `Configuracion`: tarifas M1 por tramos, M2 por kg, % de seguro de cada modalidad, datos de pago (editables por el admin), plantillas de WhatsApp, transportistas con su enlace.
- `TasaBcv`: fecha, bolívares por dólar, fuente (`API | MANUAL`).

## Reglas de negocio centrales (puras, con pruebas)

1. **Precio M1**: peso cobrable = máx(peso total, 2 kg); tarifa por kg según tramo del peso cobrable (1–9,99 = 9,5; 10–19,99 = 8,5; 20–49,99 = 7,5; 50+ = 6,5), aplicada a todos los kilos; + 5 % del valor declarado. Redondeo al centavo.
2. **Precio M2**: peso cobrable = máx(peso total, 1 kg); × 6 $; + 3 % del valor declarado. Cobro a destino de MRW/Zoom no entra al sistema.
3. Menos de 2 kg: se propone M2; el cliente puede pasar a M1 y paga mínimo 2 kg con seguro del 5 %.
4. Máquina de estados: prealertado → recibido parcial → recibido completo → pago por confirmar → pagado → despachado → cerrado. No se despacha sin pago confirmado ni sin datos de entrega completos.
5. Tasa BCV: Bs = USD × tasa; se guarda la tasa usada en cada pago.
6. Tracking: comparar normalizando (mayúsculas, sin espacios, sin ceros a la izquierda, sin prefijos comunes).

## Pantallas

**Teléfono (operador):** escaneo con cámara + entrada manual, ficha del paquete, peso, foto opcional, botón «Avisar por WhatsApp», registro de guía venezolana con foto.
**PC (operador/admin):** lista de envíos con filtros y búsqueda, confirmación de pagos con comprobante al lado, plantillas, botón WhatsApp Web, usuarios y configuración (admin), corrección de precios con motivo (admin).
**Cliente:** registro/login, mis envíos, crear prealerta con modalidad, ver monto en $ y Bs, datos de pago y subir comprobante, formulario de datos de entrega, ver guía y foto.
**Pública:** inicio con tarifas, calculadora, rastreador MRW/Zoom, WhatsApp, redes, dirección.

Diseño: marca real del flyer (azul marino, amarillo, rojo, formas redondeadas, tipografía con carácter), responsive mobile-first, sin aspecto de plantilla. Se usan las skills globales `diseno-frontend-design`, `diseno-no-ui-slop`, `diseno-vectorlab-*`, `diseno-uxkin-*`, revisión con `revision-*` y accesibilidad con `a11y-*`.

## Costo mensual estimado (verificar precios vigentes antes de ofrecerlo)

- Semana de prueba: 0 $ (Netlify gratis + Supabase gratis; el plan gratis de Supabase pausa tras 7 días sin uso y tiene 1 GB de fotos).
- Producción: Supabase Pro ≈ 25 $/mes (8 GB de base de datos, 100 GB de almacenamiento) + Netlify gratis o Pro según tráfico + dominio ≈ 15 $/año. Cabe holgado dentro de los 100 $/mes.
- Control de espacio: las fotos se comprimen a ≈ 200 KB; miles de envíos caben en el plan Pro.

## Orden de trabajo (tareas de menos de 30 min cada una, en `tareas.md`)

1. Limpieza y esqueleto: rama `rediseno-v2`, borrar lo descartado, estructura de carpetas, Vitest, `CLAUDE.md` del proyecto, `.env.example`.
2. Dominio puro con pruebas: precios M1/M2, mínimos, tramos, seguro, Bs, normalización de tracking, máquina de estados.
3. Base de datos y migraciones (Prisma + Supabase), semilla con configuración inicial (sin datos bancarios reales en Git).
4. Autenticación: registro de cliente (cédula cifrada, duplicados), login, roles, límite de intentos, restablecer contraseña temporal.
5. Tasa BCV: consulta, guardado, fallback, carga manual.
6. Prealertas y envíos (cliente y operador).
7. Escaneo y recepción de paquetes (teléfono), foto, avisos por paquete.
8. Pagos: datos de pago editables, subida de comprobante, confirmación/rechazo, pago manual.
9. Datos de entrega y despacho: bloqueos, guía venezolana + foto, mensaje final.
10. Botones de WhatsApp y plantillas editables (incluye copiar foto en PC).
11. Panel admin: usuarios, configuración, corrección de precios con motivo y auditoría.
12. Página pública: tarifas, calculadora, rastreador MRW/Zoom.
13. PWA instalable y ajustes responsive teléfono/PC.
14. Revisión de diseño, accesibilidad, pruebas de flujos en Playwright, despliegue a Netlify.

## Verificación de punta a punta

- `npm test` pasa (cálculos de precio, estados, tracking, validaciones y permisos, con casos feliz, límite y error).
- Recorrido manual del criterio «Cómo sé que está listo» de la spec en un teléfono Android real con HTTPS (necesario para la cámara) y en Chrome de PC.
- Ejemplo de control: 3 paquetes que pesan 2,40 + 1,15 + 0,80 kg con valor declarado de 60 $ en M1 = 44,33 $; el mismo envío en M2 = 4,35 × 6 + 3 % × 60 = 27,90 $.
- Probar bloqueos: despachar sin pago, sin datos de entrega, cliente viendo envíos de otro, operador intentando corregir precios.
- Revisar que ningún log contenga cédula, teléfono ni nombre completo.

## Riesgos abiertos

- Etiquetas reales de Shein/X-Cargo aún por conseguir para probar el escáner.
- Enlaces de rastreo de MRW y Zoom sin verificar si aceptan el número en la URL.
- Datos de Binance pendientes; los datos bancarios reales se cargan por panel, no por código.
- Precios de Supabase y Netlify pueden haber cambiado; confirmarlos antes de cotizar al cliente.
