# Tareas 001 · Recepción, cobro y despacho

Una tarea a la vez. Cada una incluye sus pruebas unitarias. La casilla se marca solo cuando Luis confirma que la prueba manual pasó.

## Estado (19-11-2026)

Todas las tareas están programadas y con pruebas automáticas que pasan (62 de backend, 22 de frontend y 3 de punta a punta en Chrome). Las casillas siguen sin marcar porque faltan las pruebas manuales de Luis (lista en el README). Lo que NO se pudo probar sin cuentas reales: la migración contra Supabase (T-11, T-12), el almacenamiento real de imágenes y el despliegue en Netlify (T-53); y sin etiquetas reales: el escáner con códigos de Shein (T-23).

Desvíos respecto al plan: la tabla AjusteManual se resolvió con el historial de eventos (guarda valor anterior, motivo y usuario); al cerrar la recepción, los paquetes que faltan pasan a un envío nuevo.

## Bloque A · Limpieza y esqueleto

### T-01 Limpiar lo descartado
Cubre: base de todo
Hacer: borrar Twilio, `WhatsAppService`, `QuoteService`, tarifas en COP, rastreo propio, `RULES.md`, `README.md` y `DATOS-DE-PRUEBA.txt` viejos, carpetas `dist/`, la foto suelta de WhatsApp y los componentes de Landing viejos. Dejar lo rescatable.
Hecho cuando: el proyecto no menciona Twilio, COP ni guías `VEX-`; `git status` muestra solo borrados.
[ ] Hecha y probada

### T-02 Estructura, Vitest y CLAUDE.md del proyecto
Cubre: base de todo
Hacer: carpetas `netlify/functions`, `src` del backend y frontend, Vitest instalado, `npm test` funcionando con una prueba de humo, `.env.example`, `CLAUDE.md` del proyecto (qué es, cómo se compila, cómo se prueba, rama `rediseno-v2`).
Hecho cuando: `npm test` pasa y `npm run build` compila.
[ ] Hecha y probada

## Bloque B · Reglas de negocio (código puro con pruebas)

### T-03 Precio modalidad 1
Cubre: RF-20, RF-42
Hecho cuando: pruebas para tramos 9,5/8,5/7,5/6,5 $, mínimo de 2 kg, 5 % de seguro, redondeo al centavo, pesos 9,99 y 10, peso cero y negativo (error). El ejemplo de 4,35 kg con 60 $ da 44,33 $.
[ ] Hecha y probada

### T-04 Precio modalidad 2
Cubre: RF-20, RF-42
Hecho cuando: pruebas para 6 $/kg, mínimo de 1 kg, 3 % de seguro; 4,35 kg con 60 $ da 27,90 $.
[ ] Hecha y probada

### T-05 Elección de modalidad
Cubre: RF-20
Hecho cuando: menos de 2 kg propone M2; el cliente puede pasar a M1 y paga como 2 kg con seguro del 5 %; con 2 kg o más rige lo elegido; pruebas de cada caso.
[ ] Hecha y probada

### T-06 Conversión a bolívares
Cubre: RF-20, RF-44
Hecho cuando: dólares × tasa con dos decimales; error si la tasa es cero o negativa.
[ ] Hecha y probada

### T-07 Normalización de tracking
Cubre: RF-15b, RF-17
Hecho cuando: ignora mayúsculas, espacios, ceros a la izquierda y prefijos comunes; ejemplo con códigos de X-Cargo de prueba; texto vacío da error.
[ ] Hecha y probada

### T-08 Máquina de estados del envío
Cubre: RF-37, RF-33f, RF-38
Hecho cuando: solo transiciones permitidas; no pasa a despachado sin pago confirmado ni sin datos de entrega completos.
[ ] Hecha y probada

### T-09 Validaciones de cédula, teléfono y valores
Cubre: RF-9b, RF-10
Hecho cuando: cédula venezolana (solo número), teléfono con código de país, valor declarado no negativo; casos válidos, límite e inválidos.
[ ] Hecha y probada

### T-10 Cifrado de cédula y máscara
Cubre: RF-9e, RF-53
Hecho cuando: AES-256-GCM con llave de entorno cifra y descifra; la máscara `V-***678` no revela el número; error si falta la llave.
[ ] Hecha y probada

## Bloque C · Base de datos

### T-11 Esquema Prisma y migración
Cubre: RF-40 y modelo de datos del plan
Hecho cuando: tablas Usuario, Envio, Paquete, Pago, AjusteManual, Evento, Configuracion y TasaBcv migradas en Supabase de prueba.
[ ] Hecha y probada

### T-12 Semilla de configuración
Cubre: RF-33b, RF-42, RF-47
Hecho cuando: tarifas, porcentajes, MRW y Zoom con sus enlaces y plantillas de mensaje cargados; datos de pago como «DATOS DE PRUEBA»; ningún dato bancario real en Git.
[ ] Hecha y probada

## Bloque D · Cuentas y seguridad

### T-13 Registro de cliente
Cubre: RF-9b, RF-9d, RF-9e, RF-50
Hecho cuando: crea cuenta con contraseña con hash argon2id y cédula cifrada; rechaza cédula o teléfono repetidos sin revelar de quién.
[ ] Hecha y probada

### T-14 Inicio de sesión y cierre
Cubre: RF-7, RF-8
Hecho cuando: sesión en cookie httpOnly; tras varios intentos fallidos se bloquea unos minutos; los logs no muestran cédula ni teléfono.
[ ] Hecha y probada

### T-15 Roles y permisos
Cubre: RF-9, RF-51
Hecho cuando: cliente solo ve lo suyo; operador y admin acceden al panel; pruebas de acceso prohibido.
[ ] Hecha y probada

### T-16 Contraseña temporal
Cubre: RF-9c
Hecho cuando: operador o admin asigna una temporal y el cliente debe cambiarla al entrar.
[ ] Hecha y probada

## Bloque E · Tasa BCV

### T-17 Consulta y guardado de la tasa
Cubre: RF-43, RF-44
Hecho cuando: el servidor consulta `ve.dolarapi.com/v1/dolares/oficial`, guarda el campo `promedio` con fecha una vez al día; si falla usa la última y avisa; prueba con respuesta simulada.
[ ] Hecha y probada

### T-18 Carga manual de la tasa
Cubre: RF-44
Hecho cuando: el admin carga la tasa a mano y queda marcada como manual.
[ ] Hecha y probada

## Bloque F · Prealertas y envíos

### T-19 Crear prealerta (cliente)
Cubre: RF-10, RF-11, RF-12
Hecho cuando: cliente registra tracking, tienda, valor declarado, cantidad de paquetes, transportista y modalidad; tracking repetido avisa y muestra la existente.
[ ] Hecha y probada

### T-20 Lista de mis envíos (cliente)
Cubre: RF-51
Hecho cuando: el cliente ve solo sus envíos con estado y precio en $ y Bs.
[ ] Hecha y probada

### T-21 Prealerta por el operador
Cubre: RF-14
Hecho cuando: el operador busca al cliente por teléfono o cédula y le crea la prealerta.
[ ] Hecha y probada

### T-22 Lista y búsqueda del personal
Cubre: RF-38, RF-39
Hecho cuando: filtro por estado y búsqueda por nombre, teléfono, tracking o guía venezolana.
[ ] Hecha y probada

## Bloque G · Recepción con el teléfono

### T-23 Lector de cámara
Cubre: RF-15, RF-24
Hecho cuando: en un teléfono con HTTPS lee barras y QR; si no hay cámara o permiso, explica por qué y deja el modo manual.
[ ] Hecha y probada

### T-24 Búsqueda manual y resultado del escaneo
Cubre: RF-16, RF-17, RF-18
Hecho cuando: un tracking con prealerta muestra al cliente y cuántos paquetes faltan; sin prealerta ofrece registrar «sin prealerta».
[ ] Hecha y probada

### T-25 Recepción automática y duplicados
Cubre: RF-17, RF-23
Hecho cuando: escanear marca el paquete como recibido; volver a escanearlo avisa que ya está registrado; pruebas.
[ ] Hecha y probada

### T-26 Peso y precio del envío
Cubre: RF-19, RF-20
Hecho cuando: el operador carga el peso con 2 decimales y el sistema suma los paquetes, aplica modalidad y muestra el total en $ y Bs.
[ ] Hecha y probada

### T-27 Foto opcional del paquete
Cubre: RF-22, RF-52
Hecho cuando: foto comprimida en el teléfono, guardada en almacenamiento privado, visible solo al personal y al dueño.
[ ] Hecha y probada

### T-28 Asignar paquete sin prealerta
Cubre: RF-18
Hecho cuando: el operador asigna un paquete sin prealerta a un cliente después.
[ ] Hecha y probada

## Bloque H · Avisos por WhatsApp

### T-29 Generador de mensajes y enlaces
Cubre: RF-25, RF-26
Hecho cuando: arma el texto con peso, precio en $ y Bs y paquetes que faltan; abre WhatsApp Web en PC y la aplicación en teléfono; pruebas con teléfonos mal escritos.
[ ] Hecha y probada

### T-30 Aviso por paquete y confirmación
Cubre: RF-27, RF-28
Hecho cuando: cada paquete se puede avisar; queda registrado quién y cuándo abrió el aviso; el operador confirma con un botón que lo envió.
[ ] Hecha y probada

### T-31 Plantillas editables
Cubre: RF-45
Hecho cuando: el admin edita los textos y ve una vista previa con datos de ejemplo.
[ ] Hecha y probada

## Bloque I · Pagos

### T-32 Datos de pago para el cliente
Cubre: RF-29, RF-33b
Hecho cuando: el cliente ve el monto y los datos de pago móvil, cuenta bancaria y Binance que cargó el admin.
[ ] Hecha y probada

### T-33 Subir comprobante
Cubre: RF-30, RF-31
Hecho cuando: el cliente sube captura y referencia y el envío pasa a «pago por confirmar».
[ ] Hecha y probada

### T-34 Confirmar o rechazar pago
Cubre: RF-31, RF-32, RF-33c
Hecho cuando: el personal ve el comprobante, confirma o rechaza con motivo; rechazo abre WhatsApp con el motivo; se guarda la tasa usada.
[ ] Hecha y probada

### T-35 Pago manual
Cubre: RF-33
Hecho cuando: el personal registra un pago con monto, método y referencia.
[ ] Hecha y probada

## Bloque J · Datos de entrega y despacho

### T-36 Mensaje «pago verificado»
Cubre: RF-33d
Hecho cuando: al confirmar el pago queda listo el mensaje pidiendo los datos de entrega.
[ ] Hecha y probada

### T-37 Formulario de datos de entrega
Cubre: RF-33e, RF-33f
Hecho cuando: el cliente llena quién recibe, cédula, teléfono, agencia, ciudad y estado con sus datos por defecto; el operador puede completarlos.
[ ] Hecha y probada

### T-38 Despachar con guía y foto
Cubre: RF-34, RF-35, RF-37
Hecho cuando: elige MRW o Zoom, anota la guía, toma foto; no deja despachar sin pago confirmado ni sin datos de entrega.
[ ] Hecha y probada

### T-39 Aviso de despacho por WhatsApp
Cubre: RF-36
Hecho cuando: PC copia la foto y abre el chat con el texto; teléfono abre el menú de compartir; el texto indica la modalidad y, en modalidad 2, el cobro a destino.
[ ] Hecha y probada

## Bloque K · Panel de administración

### T-40 Resumen del día
Cubre: RF-41
Hecho cuando: muestra por recibir, por avisar, por cobrar y por despachar.
[ ] Hecha y probada

### T-41 Historial por envío
Cubre: RF-40
Hecho cuando: cada cambio queda con quién, qué y cuándo.
[ ] Hecha y probada

### T-42 Gestión de usuarios
Cubre: RF-46
Hecho cuando: el admin crea y desactiva operadores y admins y cambia contraseñas.
[ ] Hecha y probada

### T-43 Tarifas y datos de pago editables
Cubre: RF-42, RF-33b
Hecho cuando: el admin cambia tramos, porcentajes y datos de pago sin tocar código, con validaciones.
[ ] Hecha y probada

### T-44 Corrección de precios con motivo
Cubre: RF-21, RF-40
Hecho cuando: solo el admin corrige precio, peso o valor declarado; motivo obligatorio; se guarda el valor anterior; el operador recibe error.
[ ] Hecha y probada

### T-45 Transportistas editables
Cubre: RF-47
Hecho cuando: el admin edita nombre y enlace de MRW y Zoom.
[ ] Hecha y probada

## Bloque L · Página pública

### T-46 Estructura y marca
Cubre: RF-1, RF-5, RF-51
Hecho cuando: inicio con quiénes son, tarifas, nota de pago en Bs a tasa BCV, dirección, WhatsApp y redes, con la marca del flyer; sin datos de clientes.
[ ] Hecha y probada

### T-47 Rastreador MRW y Zoom
Cubre: RF-2, RF-3, RF-4
Hecho cuando: el visitante elige transportista y guía, se abre la página oficial en otra pestaña y, si no acepta el número en el enlace, se copia.
[ ] Hecha y probada

### T-48 Calculadora pública
Cubre: RF-6
Hecho cuando: kilos y valor declarado dan el precio estimado en $ y Bs para ambas modalidades, con las mismas reglas del servidor.
[ ] Hecha y probada

## Bloque M · Cierre

### T-49 PWA instalable
Cubre: RF-49
Hecho cuando: se instala en la pantalla de inicio de un Android con ícono y nombre.
[ ] Hecha y probada

### T-50 Revisión responsive y de diseño
Cubre: RF-48
Hecho cuando: pasa 375 px a 1280 px sin desbordes; se corrigen los hallazgos de las skills de revisión.
[ ] Hecha y probada

### T-51 Accesibilidad
Cubre: RF-48
Hecho cuando: contraste, foco, etiquetas y teclado revisados sin fallos graves.
[ ] Hecha y probada

### T-52 Prueba de punta a punta
Cubre: «Cómo sé que está listo»
Hecho cuando: un recorrido completo (registro, prealerta, escaneo, peso, pago, datos de entrega, despacho) pasa con Playwright.
[ ] Hecha y probada

### T-53 Despliegue a Netlify
Cubre: todo
Hecho cuando: la página abre con candado, la cámara funciona en un teléfono real y las variables secretas están en Netlify, no en el código.
[ ] Hecha y probada

## Cambios posteriores (acceso y cuenta del cliente)

- Registro con correo, teléfono con selector de país (Venezuela por defecto), contraseña repetida con requisitos (RF-9b, RF-9g) y número de casillero VENV-123456 (RF-9h).
- Ingreso con correo o número de casillero; ver y ocultar contraseña (RF-7, RF-9i).
- Panel del cliente con Inicio, Pedidos, Alertas, Finanzas y botón de WhatsApp (RF-9j a RF-9m).
- Método y moneda de pago ligados (RF-9n). Textos públicos sin detalles internos (RF-1).
- Pendiente de tu prueba manual; ninguna casilla marcada.

## Lote: bodega, consolidación y casos especiales

- **T-60** Estados y tipo de envío (alerta o consolidado), con transiciones nuevas. Cubre: RF-60, RF-66. Hecho cuando: las pruebas de estados pasan. `[ ] Hecha y probada`
- **T-61** Sin prealerta: asignar al recibir por casillero o búsqueda, o dejar sin dueño; unir al reclamar con la alerta. Cubre: RF-61, RF-62, RF-63. Hecho cuando: las pruebas de flujo pasan. `[ ] Hecha y probada`
- **T-62** Cambiar dueño y descartar paquetes o envíos. Cubre: RF-64, RF-65. Hecho cuando: queda en el historial y el paquete cambia de cliente. `[ ] Hecha y probada`
- **T-63** Consolidar (cliente y operador), pesar, agregar y quitar paquetes, deshacer. Cubre: RF-66, RF-67, RF-68, RF-69. Hecho cuando: el total sale del peso del consolidado. `[ ] Hecha y probada`
- **T-64** Mensaje de llegada sin total y mensaje de cotización. Cubre: RF-70. Hecho cuando: el operador abre ambos mensajes. `[ ] Hecha y probada`
- **T-65** Pago exacto y referencia de 6 dígitos. Cubre: RF-71, RF-72. Hecho cuando: un monto distinto se rechaza. `[ ] Hecha y probada`
- **T-66** El cliente elimina alertas pendientes; entregado por el operador. Cubre: RF-73, RF-74. `[ ] Hecha y probada`
- **T-67** Pantallas: Bodega (panel), Consolidar (cliente), escaneo con asignación, detalle del envío. Cubre: RF-60 a RF-69. `[ ] Hecha y probada`
