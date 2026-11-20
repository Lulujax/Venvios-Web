# Plan 002: Venvios Express, del casillero a la entrega

Documento vivo: describe cómo está construido hoy y cómo se construye lo que falta. La spec es `spec.md` (el qué); este archivo es el cómo. Rama de trabajo: `rediseno-v2` (las pruebas de datos viven en `testing`).

## Contexto

Casillero internacional Cúcuta → Venezuela. El sistema ya está programado de punta a punta con pruebas automáticas (backend y frontend). Falta: (1) que Luis haga las pruebas manuales de lo ya construido, (2) el lote del flujo completo de consolidación a entrega, y (3) probar con Supabase y Netlify reales.

## Decisiones estables (y por qué)

| Tema | Decisión | Opciones descartadas |
| --- | --- | --- |
| Hosting | Netlify para web y backend (función de Netlify); Supabase para Postgres y fotos | Render/Railway (servidor se duerme, tercer servicio); todo en Supabase sin backend (rompe «lo delicado vive en el backend») |
| Frontend | React + Vite + TypeScript + Tailwind, PWA instalable | Next.js (más pesado para funciones de Netlify) |
| Backend | TypeScript, Express envuelto en una función de Netlify; capas `http` / `services` / `repositories` / `domain` | Funciones sueltas por ruta (duplican middleware) |
| Datos | Prisma + Postgres con pooler; repositorio en memoria igual de completo para desarrollo y pruebas | SQL a mano |
| Contraseñas | argon2id con `@node-rs/argon2` | `argon2` nativo (falla al compilar en Lambda), bcryptjs |
| Sesión | JWT en cookie httpOnly, con versión de sesión para cerrarla desde el servidor | localStorage |
| Cédula y datos de entrega | AES-256-GCM con llave en variable de entorno; huella HMAC para detectar repetidas | Texto plano |
| Fotos y comprobantes | Bucket privado de Supabase Storage, comprimidas en el navegador, enlace firmado de corta duración | Disco local, URLs públicas |
| Lector de códigos | Lector nativo del navegador (`BarcodeDetector`) cuando existe; `zxing-wasm` de respaldo y para fotos. La cámara se muestra primero y el lector carga después | `@zxing/library` (más lento y flojo con QR chicos; se quitó); solo QR |
| Escaneo continuo | Una lectura por paquete: la cámara se apaga sola y se vuelve a encender con «Escanear siguiente paquete» | Cámara siempre encendida (repetía lecturas y movía la pantalla) |
| Pruebas | Vitest (unitarias y de flujo) + Playwright (flujo completo en Chrome) | Jest |
| Tasa BCV | El servidor consulta `ve.dolarapi.com/v1/dolares/oficial` (campo `promedio`), guarda con fecha, fallback a la última y carga manual del admin | Consultar desde el navegador |
| WhatsApp | Enlaces `wa.me` / `web.whatsapp.com/send` con texto prellenado; sin API ni bot | Twilio |
| HTTPS en desarrollo | `@vitejs/plugin-basic-ssl` en `npm run dev`, para que la cámara funcione en el teléfono | Túneles públicos (exponen la app); banderas del navegador (no sirven en iPhone) |
| Datos de prueba | Archivo JSON temporal (`backend/datos-prueba/paquetes-prueba.json`) que se carga en memoria con `CARGAR_DATOS_PRUEBA=true`; se niega si hay base de datos o producción | Sembrar en la base real (riesgo de mezclar datos) |

## Diseño que ya tenemos

Se conserva y se reutiliza; las pantallas nuevas no inventan colores ni componentes.

**Marca.** Azul marino, amarillo y rojo del flyer, formas redondeadas, tipografía con carácter, fondo cálido.

| Elemento | Valor |
| --- | --- |
| Fondo `papel` / texto `tinta` / secundario `suave` / línea `linea` | `#FAF8F3` / `#141A33` / `#5B6178` / `#E6E0D2` |
| `marino` (principal) | `#14286B`; variantes 900 `#0C1A4A`, 700 `#1B3590`, 100 `#E3E8F7`, 50 `#F0F3FB` |
| `oro` (acento y paso actual) | `#F2B01E`; variantes 600 `#D99A0B`, 100 `#FDF0CC`, 50 `#FEF8E7` |
| `rojo` (error, peligro) | `#D4262C`; variantes 700 `#B01C21`, 100 `#FBE4E4` |
| `verde` (hecho, recibido) | `#1E8A5A`; variante 100 `#DDF3E8` |
| Tipografías | Fraunces (títulos), Figtree (texto), JetBrains Mono (códigos y guías) |
| Radios y sombras | tarjeta 20 px, botón 14 px; sombras `tarjeta` y `elevada` |

**Componentes de clase** (en `index.css`): `.btn` con `btn-primario`, `btn-acento`, `btn-suave`, `btn-peligro`, `btn-fantasma`, `btn-chico`; `.campo`, `.etiqueta`, `.ayuda`, `.tarjeta`, `.insignia`, `.codigo`, `.contenedor`, `.cinta-diagonal` (portada), `.zona-segura-abajo` (barra inferior del teléfono).

**Componentes de React** (en `components/ui.tsx` y `components/envio/`): `Marca`, `InsigniaEstado`, `Alerta`, `Cargando`, `Vacio`, `ErrorCarga`, `Campo`, `CampoContrasena`, `CampoTelefono`, `Seleccion`, `Seccion`, `ImagenPrivada`, `useAviso`, `LineaEstado` (progreso del envío), `PaquetesLista`, `Consolidado`, `PagoCliente`, `PagosPersonal`, `EntregaForm`, `DespachoForm`, `Historial`, `AjusteAdmin`, `PrecioCaja`.

**Diseño responsive.** Mobile-first desde 375 px. Botones y campos de al menos 48 px de alto. Cliente: menú lateral en PC y barra inferior en teléfono. Operador: barra lateral de 250 px en PC; en teléfono, cabecera fija y barra inferior. Portada con cinta diagonal sobre azul marino.

**Accesibilidad y movimiento.** Foco visible de 3 px azul, etiquetas en todos los campos, mensajes en vivo (`aria-live`) en resultados, respeto de `prefers-reduced-motion`, animaciones `entrar` y `pulso`.

**Reglas para pantallas nuevas.** Español corto y sin tecnicismos; estados siempre con `InsigniaEstado`; progreso con el estilo de `LineaEstado` (hecho en marino, actual en oro, pendiente en `linea`); fechas en `text-xs text-suave`; sin colores ni radios nuevos; probar a 375 px y en escritorio.

## Lo que ya funciona

- **Pública.** Portada con tarifas, tasa BCV del día, calculadora y rastreador MRW/Zoom; botón de WhatsApp.
- **Acceso.** Registro con casillero `VENV-…`, login con correo o casillero, bloqueo por intentos, cambio de clave, clave temporal.
- **Cliente** (`/cuenta`): Inicio, Pedidos, Alertas, Consolidar, Finanzas, nueva prealerta y detalle de envío con pago y datos de entrega.
- **Operador** (`/panel`): Inicio con resumen, Escanear (cámara con lector nativo o wasm, foto, entrada manual), Bodega, Envíos con filtros, detalle de envío, Pagos por confirmar y Nueva prealerta.
- **Administrador** (`/panel/admin`): personal, tarifas M1 y M2, datos de pago (pago móvil, cuenta, Binance), rastreo de transportistas, contacto público y tasa BCV.
- **Servidor.** Servicios de envíos, pagos, autenticación, mensajes de WhatsApp, tasa y configuración; historial por envío; transacciones por petición y control de cambios simultáneos.
- **Seguridad.** Hash de contraseñas, cifrado de cédula y datos de entrega, protección por filas, logs sin datos personales.

## Modelo de datos

Actual (Prisma): `Usuario`, `Envio` (tipo `ALERTA | CONSOLIDADO`), `Paquete`, `Pago`, `Evento`, `Configuracion`, `TasaBcv`, `IntentoAcceso`.

Cambios del lote:

- `Usuario`: se agregan los datos de entrega del perfil: quién recibe (nombre, cédula y teléfono cifrados) y, para MRW y para Zoom, agencia, ciudad y estado.
- `EventoCuenta`: id, usuarioId, actorId, tipo, detalle, datos (sin datos sensibles) y creadoEn. Guarda los cambios del perfil y las correcciones de cédula del administrador. Entra en `proteger.sql` (RF-95).
- `Paquete`: se agrega `valorDeclaradoCentavos` (por defecto 0) y `creadoEn`.
- `Envio`: se agrega `seguroManualCentavos` (opcional). El valor declarado del envío sigue guardado como suma de sus paquetes.
- `PaqueteHito`: id, paqueteId, paso (`PREALERTADO | EN_OFICINA | CONSOLIDANDO | POR_PAGAR | PAGO_EN_REVISION | ENVIANDO | EN_RUTA | ENTREGADO`), actorId (opcional), creadoEn. Índice por (paqueteId, creadoEn). Solo agrega filas.
- La tabla nueva entra en `proteger.sql` (RF-95).
- Los dos repositorios (memoria y Prisma) implementan lo nuevo.

## Estados

Los valores internos no cambian; solo las etiquetas.

| Valor interno | Etiqueta | Aplica a |
| --- | --- | --- |
| `PREALERTADO` | Prealertado | Alerta |
| `RECIBIDO_PARCIAL` | Recibido parcial | Alerta |
| `RECIBIDO_COMPLETO` | En bodega | Alerta |
| `ARCHIVADO` / `CANCELADO` | Archivado / Descartado | Ambos |
| `POR_CONSOLIDAR` | Por consolidar | Consolidado |
| `POR_PAGAR` | Por pagar | Consolidado |
| `POR_CONFIRMAR` | Pago en revisión | Consolidado |
| `PAGADO` | Enviando a Venezuela | Consolidado |
| `DESPACHADO` | En ruta | Consolidado |
| `CERRADO` | Entregado | Consolidado |

## Reglas de negocio centrales (puras, con pruebas)

1. **Precio M1**: peso cobrable = máx(peso total, 2 kg); tarifa por kg según el tramo del peso cobrable (1–9,99 = 9,5; 10–19,99 = 8,5; 20–49,99 = 7,5; 50+ = 6,5), aplicada a todos los kilos; más 5 % del valor declarado. Redondeo al centavo.
2. **Precio M2**: peso cobrable = máx(peso total, 1 kg); × 6 $; más 3 % del valor declarado. El cobro a destino de MRW o Zoom no entra al sistema.
3. Menos de 2 kg: se propone M2; si el cliente pasa a M1 paga mínimo 2 kg con seguro del 5 %.
4. **Valor declarado del envío** = suma de los valores de sus paquetes.
5. **Seguro** = seguro manual si existe; si no, el porcentaje de la modalidad sobre el valor declarado.
6. **Edición antes del pago**: el operador edita valor por paquete y seguro con motivo; el administrador siempre. «Antes del pago» = ningún pago «por confirmar» ni «confirmado».
7. **Referencia de pago** según el método: Binance = ID de 8 a 40 caracteres con letras y números; pago móvil y transferencia = 6 dígitos.
8. **Tracking**: se compara normalizando (mayúsculas, sin símbolos, sin ceros a la izquierda, sin prefijos comunes). Un código leído que contiene el número de la prealerta (mínimo 8 caracteres, con la forma `base.pieza` completada a 3 dígitos) cuenta como coincidencia; si coincide con varios, no se marca ninguno.
9. **Despacho** solo con pago confirmado y datos de entrega completos.
10. **Cierre** «En ruta» → «Entregado» por el dueño del envío o por el personal.
11. **Paso actual de un paquete** a partir de (estado del paquete, tipo y estado de su envío).

## Decisiones del lote (flujo completo)

| Tema | Decisión | Opciones descartadas |
| --- | --- | --- |
| Valor por guía | Cada paquete guarda su valor; el del envío es la suma guardada, recalculada en la misma transacción cuando cambian paquetes o valores | Repartir el valor del envío entre sus paquetes (inexacto al consolidar solo algunos); quitar la columna y sumar al vuelo (obliga a tocar precios y listas) |
| Prealerta en la API | `paquetes: [{ tracking, valorUsd }]` reemplaza a `trackings` más un solo valor | Aceptar los dos formatos |
| Seguro editable | `seguroManualCentavos`; vacío = automático; botón «volver a automático» | Guardar solo el seguro final (se pierde el recálculo al cambiar el peso) |
| Auditoría de ediciones | `Evento` con `datos` (campo, valor anterior, valor nuevo, motivo, quién), como ya hace el ajuste del administrador | Tabla nueva `AjusteManual` |
| Datos de entrega | Viven en el perfil del cliente (quién recibe, más agencia, ciudad y estado para MRW y para Zoom), cifrados y con las validaciones de `guardarEntrega`. Al solicitar la consolidación se copian al envío (copia fija). Si el perfil está incompleto, no se envía la solicitud. El cliente ya no edita la dirección dentro del envío; el operador sí puede corregirla | Pedirlos en cada solicitud (repite formulario y pantalla); pedirlos en la prealerta (aún no se sabe la transportista); libreta con varias direcciones (más diseño; se puede agregar después) |
| Corrección de cédula | Solo el administrador, con motivo. Se vuelve a cifrar la cédula y se recalcula su huella HMAC para seguir detectando repetidas. El historial de la cuenta guarda quién, cuándo, el motivo y la cédula anterior enmascarada (`V-***678`) | Permitirla al cliente (cambia la identidad de la cuenta sin control); permitirla al operador; guardar la cédula anterior completa (dato sensible en el historial) |
| Referencia de pago | Validación según método, sin columna nueva | Columna `idTransaccion` |
| Nombres de estado | Solo etiquetas (backend `ETIQUETAS_ESTADO`, frontend `formato.ts`, plantillas) | Renombrar valores en la base de datos |
| Cierre por el cliente | Ruta `POST /api/envios/:id/recibido`, solo del dueño y solo desde «En ruta»; la ruta del operador se queda y la pantalla pide confirmar | Cierre automático por días; un solo botón para ambos |
| Seguimiento por paquete | Tabla `PaqueteHito` de solo agregar; el paso actual se calcula y las fechas salen de los hitos | Calcular todo del estado actual (sin fechas); `paqueteId` en `Evento` |
| Paquete devuelto a bodega | Se agrega otra vez el hito «En oficina» y los pasos posteriores dejan de mostrarse | Borrar hitos |
| Datos que ya existen | Migración: reparte el valor del envío entre sus paquetes (el resto al primero) y crea los hitos «Prealertado» y «En oficina» con las fechas que ya hay | Valores en cero |

## Pantallas del lote

- **Cliente.** Alertas: valor por guía. Perfil (nuevo): «Mis datos» y «Mis datos de entrega». Consolidar: resumen de entrega con «Cambiar en mi perfil» y valor total visible. Pedidos: seguimiento por paquete y botón «Ya lo recibí» en «En ruta». Finanzas: pago con ID de Binance o 6 dígitos según el método.
- **Operador.** Solicitudes de consolidación visibles desde Inicio y Envíos; cotización con valor por paquete y seguro editables, y «Enviar cotización»; Pagos por revisar; despacho con guía y foto; «Entregado» con confirmación en pantalla.

## Orden de trabajo

Una tarea a la vez, cada una con sus pruebas (`tareas.md`):

1. Verificación manual de lo ya construido (V-1 a V-9), en paralelo.
2. T-1 nombres de estado → T-2 pago con Binance → T-3 valor por guía → T-4a perfil (Mis datos) → T-4b datos de entrega en el perfil → T-4c consolidar y envío usan el perfil → T-4d corrección de cédula por el administrador → T-5 cotización editable → T-6 registro de pasos por paquete → T-7 seguimiento visible → T-8 cierre → T-9 pantallas del operador → T-10 preparar producción.

## Verificación

- `npm test` y `npm run typecheck` pasan en backend y frontend, con caso feliz, límite y error en cada regla.
- `npm run e2e` pasa el recorrido completo en Chrome real (se actualiza al terminar el lote).
- Recorrido manual con los datos de prueba: prealertar 3 guías con valores distintos, escanear, consolidar 2, ver la suma, cotizar, editar valor y seguro, pagar con Binance y con pago móvil, aprobar, registrar guía con foto y confirmar «Ya lo recibí».
- Bloqueos: operador editando valor con pago registrado, cliente cerrando un envío ajeno, cliente cerrando fuera de «En ruta», Binance con ID demasiado corto, despacho sin pago o sin datos.
- Ningún log contiene cédula, teléfono ni nombre completo.

## Riesgos abiertos

- La migración contra Supabase, el almacenamiento real de imágenes y el despliegue en Netlify no se han probado con cuentas reales.
- El escáner se probó con imágenes y pruebas automáticas; falta probarlo con cámaras reales de Android y iPhone.
- Las plantillas de mensajes guardadas en la base no se actualizan solas con las nuevas; hay que reemplazar las que sigan iguales a las de fábrica.
- El reparto del valor en envíos viejos puede quedar aproximado hasta que el operador lo corrija.
- Hay dos repositorios que deben quedar iguales; una diferencia entre memoria y Prisma solo se vería en producción.
- Los paquetes que ya estaban más allá de «En oficina» no tendrán fecha en los pasos siguientes.
- Los clientes que ya tienen envíos con datos de entrega: la migración copia los del último envío a su perfil para que no los tengan que escribir otra vez.
- Los enlaces de rastreo de MRW y Zoom no se verificaron para saber si aceptan el número en la URL.
- Los datos reales de Binance y del banco se cargan desde el panel, nunca desde el código.
- El archivo de datos de prueba y el modo HTTPS de desarrollo deben quedar fuera de producción (T-10).

## Costo mensual estimado (verificar precios vigentes antes de ofrecerlo)

- Semana de prueba: 0 $ (Netlify y Supabase gratis; Supabase pausa tras 7 días sin uso y limita a 1 GB de fotos).
- Producción: Supabase Pro ≈ 25 $/mes (8 GB de base de datos, 100 GB de almacenamiento) + Netlify gratis o Pro según tráfico + dominio ≈ 15 $/año. Cabe dentro de los 100 $/mes.
- Las fotos se comprimen a ≈ 200 KB; miles de envíos caben en el plan Pro.
