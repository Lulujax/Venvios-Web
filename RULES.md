# RULES.md — Venvios Express

Reglas obligatorias de diseño, arquitectura, seguridad e identidad para la plataforma web de Venvios Express. Cualquier cambio en el código debe cumplir este documento.

---

## 1. Identidad de marca

| Campo | Valor |
| --- | --- |
| Nombre | Venvios Express |
| Eslogan | Tu mejor opción |
| Sede | Barrio Latino, Centro de Cúcuta, Colombia |
| WhatsApp de atención | +57 323 796 8740 |
| Redes sociales | @venviosexpress (Instagram, Facebook, TikTok) |
| Ruta | Colombia → Venezuela |
| Modalidad | Envío puerta a puerta, sin subdivisiones aéreo/marítimo |

### Tono de voz
- Directo, operativo y humano. Habla como un jefe de bodega que conoce cada paquete.
- Español neutro colombiano. Sin superlativos vacíos.
- Los números siempre en `JetBrains Mono` y con separador de miles colombiano.
- Prohibido el copy genérico: "soluciones integrales", "experiencias", "revoluciona", "potencia", "sinergia".

---

## 2. Modelo de negocio

1. El cliente se registra y obtiene un **código de casillero único**.
2. Compra en tiendas colombianas o despacha su paquete a la sede de Cúcuta (Barrio Latino, Centro).
3. Registra una **prealerta** en la plataforma (aviso de paquete en camino).
4. Venvios Express recibe, pesa, fotografía y notifica por WhatsApp.
5. El cliente paga el envío y Venvios despacha a Venezuela, puerta a puerta.

### Regla de tarifas
- Existe **una sola tabla**: "Costo de envío por paquete".
- **No** existen tarifas por libra aérea, pie cúbico marítimo ni divisiones de servicio.
- El precio se calcula en el backend a partir del **peso cobrable** (mayor entre peso real y peso volumétrico `L × W × H / 5000`).
- El frontend nunca calcula ni almacena precios. Solo renderiza lo que entrega la API.

---

## 3. Diseño UI/UX — estilo "Waybill / Manifiesto de carga"

### Paleta (única)
| Token | Hex | Uso |
| --- | --- | --- |
| `paper` | `#F8F9FA` | Fondo principal |
| `ink` | `#111318` | Texto primario |
| `navy` | `#0B1C3C` | Acento estructural, botones, footer |
| `gold` | `#EAB308` | Sello, numeración, detalles |
| `red` | `#D32F2F` | Alertas, acentos puntuales |
| `line` | `#D8DCE1` | Líneas de 1px |

### Tipografía
- Títulos: **Cabinet Grotesk** (700/800), tracking negativo `-0.03em`.
- Cuerpo: **Satoshi** (400/500/700).
- Datos, códigos, precios, numeración: **JetBrains Mono** (400/500/700).
- Prohibido Inter, Poppins, Roboto, Arial o cualquier fuente de sistema como identidad.

### Prohibiciones visuales
- Gradientes morados/azules, glassmorphism, neones, sombras difusas.
- Tarjetas con `rounded-2xl` o radios mayores a **4px**.
- Interfaces simétricas de tres tarjetas iguales.
- Imágenes de stock genéricas o avatares de relleno.
- Emojis en código, copy o interfaz.

### Reglas de composición
- Layout asimétrico sobre grilla de 12 columnas; columnas vacías son intencionales.
- **Líneas de 1px** para separar; la elevación se logra con bloques tonales, no con sombras.
- Bordes rectos: radio máximo `4px`.
- Numeración documental (`§01`, `§02`) y datos en mono.
- El admin debe verse como una herramienta densa (estilo Linear/Retool), no como un sitio de marketing.
- Todo botón tiene estado `:active` con `scale(0.98)`; hover solo con puntero fino.
- Respetar `prefers-reduced-motion`.
- Estados obligatorios: carga (líneas skeleton), vacío (frase informativa), error (inline junto a la fuente).

---

## 4. Arquitectura

- **Monorepo**: `/frontend` (React + Vite + TS) y `/backend` (Node + Express + TS + Prisma).
- **Backend-first**: la UI es tonta. No contiene reglas de negocio, validaciones críticas, cálculos de precios ni teléfonos.
- **POO obligatoria** en el backend:
  - `entities/` — contratos e interfaces.
  - `repositories/` — única capa que habla con Prisma.
  - `services/` — reglas de negocio.
  - `controllers/` — adaptación HTTP.
  - Nada de funciones sueltas de negocio.
- DTOs validados con Zod en el borde HTTP.
- La base de datos se accede exclusivamente vía Prisma.

---

## 5. Seguridad

- Contraseñas hasheadas con **argon2id**. Nunca se registran ni se devuelven.
- Sesión con **JWT firmado** entregado en cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción. El cliente no guarda tokens.
- Helmet, CORS por allowlist, rate limiting en login y endpoints públicos.
- Validación y saneamiento de todas las entradas con Zod; se eliminan caracteres de control.
- Consultas parametrizadas por Prisma: prohibido SQL concatenado.
- **PII enmascarada en logs**: teléfonos y correos se registran como `+57******8740`, `a***@dominio.com`.
- **El operador nunca ve el teléfono del cliente.** Las respuestas administrativas excluyen `telefono`, `email` y `passwordHash`.
- WhatsApp se envía **solo desde el backend** con Twilio. El frontend no conoce credenciales ni destinos.
- Subida de archivos: solo imágenes, máximo 6 MB, nombre aleatorio, servidas desde `/uploads`.
- Roles validados en middleware: `CLIENTE` y `ADMIN`.
- Errores al cliente sin stack traces ni detalles de base de datos.

---

## 6. Convenciones de código

- TypeScript estricto (`strict: true`), sin `any` implícito.
- Nombres de dominio en español (`Paquete`, `Casillero`, `Prealerta`); código de infraestructura en inglés.
- Fechas ISO 8601. Zona operativa `America/Bogota`.
- Guía de paquete: `VEX-{AÑO}-{5 dígitos}`. Casillero: `VEX-CUC-{4 caracteres}`.
- Commits en español, imperativo: `agrega escáner de guías`.
