# Venvios Express — Plataforma Courier Colombia → Venezuela

Aplicación web completa para **Venvios Express**, empresa de courier puerta a puerta con sede en
el Barrio Latino, centro de Cúcuta (Colombia), con ruta a Venezuela.

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Librerías clave:** `@zxing/library` (escáner de códigos), `browser-image-compression`
  (compresión de evidencias), `argon2` (hash de contraseñas), `twilio` (avisos por WhatsApp)

El proyecto sigue un enfoque **Backend-First**: la interfaz es "tonta". Los precios, el peso
cobrable, las transiciones de estado y toda validación crítica viven **solo en el servidor**.
El operador nunca ve el teléfono del cliente.

---

## Requisitos

- Node.js ≥ 20 (probado con 22)
- Docker (para PostgreSQL) o un PostgreSQL propio
- npm ≥ 10

## Instalación

```bash
# 1. Clonar e instalar dependencias del monorepo (backend + frontend)
npm install

# 2. Levantar la base de datos PostgreSQL
docker compose up -d

#    (Alternativa sin Docker) con un PostgreSQL local puedes crear el rol y la
#    base de datos a mano, con credenciales que coincidan con backend/.env:
#      CREATE ROLE venvios LOGIN PASSWORD 'venvios' CREATEDB;
#      CREATE DATABASE venvios OWNER venvios;

# 3. Configurar variables de entorno del backend
copy backend\.env.example backend\.env      # Windows
cp backend/.env.example backend/.env         # Linux / macOS

# 4. Crear las tablas y cargar datos iniciales (tarifas + usuarios demo)
npm run db:migrate
npm run db:seed

# 5. Arrancar API + Web en modo desarrollo
npm run dev
```

- **Web:** http://localhost:5173
- **API:** http://localhost:4000/api/health

> Sin Twilio configurado (`TWILIO_SID`/`TWILIO_TOKEN` vacíos) los avisos de WhatsApp se ejecutan
> en **modo simulación local**: se registran como ENVIADAS y el destino queda enmascarado.

### Credenciales por defecto (solo demo, `NODE_ENV !== production`)

| Rol          | Email                       | Contraseña        |
| ------------ | --------------------------- | ----------------- |
| Admin        | `admin@venviosexpress.com`  | `VenviosAdmin2026!` |
| Cliente demo | `cliente@venviosexpress.com` | `Cliente2026!`     |

Los datos demo incluyen el casillero `VEX-CUC-4827` y los paquetes `VEX-2026-04217`,
`VEX-2026-04108` y `VEX-2026-04302` (puedes rastrearlos en `/rastreo`).

### Otros comandos

```bash
npm run typecheck   # TypeScript en backend y frontend
npm run build       # Compilar ambos para producción
npm run db:studio   # Prisma Studio (inspección de datos)
npm start           # Solo la API compilada
```

---

## Estructura del monorepo

```
Venvios-Web/
├── RULES.md                  # Reglas de negocio, diseño y seguridad (fuente de verdad)
├── docker-compose.yml        # PostgreSQL local (venvios/venvios/venvios)
├── package.json              # Workspaces npm + scripts raíz
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # User, Casillero, Prealerta, Paquete, EventoPaquete, Notificacion, Tarifa
│   │   └── seed.ts            # Tarifas + admin + cliente demo con paquetes
│   ├── src/
│   │   ├── config/            # env.ts, session.ts
│   │   ├── controllers/       # AuthController, PackageController, PublicController, BaseController
│   │   ├── domain/            # estados.ts (máquina de estados de paquetes)
│   │   ├── entities/          # DTOs tipados
│   │   ├── lib/               # prisma.ts
│   │   ├── middleware/        # AuthGuard, errorHandler, rateLimiters, upload (multer)
│   │   ├── repositories/      # Acceso a datos con Prisma (POO)
│   │   ├── routes/            # ApiRouter
│   │   ├── services/          # AuthService, QuoteService, WhatsAppService, PackageService
│   │   ├── utils/             # errors, mask, logger, sanitize, format, codes
│   │   ├── app.ts             # Aplicación Express (helmet, CORS, cookies)
│   │   └── index.ts           # ServerBootstrap con apagado seguro
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── index.html             # Fuentes Cabinet Grotesk / Satoshi / JetBrains Mono
    ├── public/favicon.svg
    ├── src/
    │   ├── components/
    │   │   ├── Admin/         # Scanner (ZXing + compresión), ReceptionModal, PackageDrawer
    │   │   ├── Client/        # CasilleroCard, PackageList, PrealertaForm
    │   │   ├── Landing/       # Navbar, Hero, HowItWorks, RatesTable, CasilleroInfo, Footer
    │   │   ├── ui/            # Icon, BrandMark, StatusBadge
    │   │   ├── Reveal.tsx     # Animaciones al hacer scroll
    │   │   └── RequireAuth.tsx
    │   ├── config/brand.ts    # Único lugar con el WhatsApp público de la marca
    │   ├── lib/               # api (cliente fetch), auth (contexto), estados, format, cn
    │   ├── pages/             # LandingPage, LoginPage, TrackPage, ClientDashboard, AdminDashboard
    │   ├── App.tsx            # Router (/ /login /rastreo /app /admin 404)
    │   ├── main.tsx
    │   └── types.ts           # DTOs compartidos
    ├── tailwind.config.js
    ├── vite.config.ts         # Proxy /api y /uploads → localhost:4000
    └── package.json
```

---

## Flujo de negocio

1. El cliente **se registra** y recibe un código de **casillero único** (`VEX-CUC-XXXX`).
2. Compra en Colombia y envía una **prealerta** desde su panel.
3. El paquete llega a la sede de Cúcuta: el operador lo **recibe** (peso, dimensiones, foto),
   se genera la guía `VEX-AAAA-NNNNN` y se calcula el costo en el servidor.
4. El cliente recibe el **aviso por WhatsApp** con guía y valor a pagar.
5. El cliente paga; el operador avanza el estado (bodega → tránsito → aduana → entregado)
   y el cliente recibe avisos automáticos en cada paso.

### Tarifa única (Costo de envío por paquete)

Calculada **solo en el servidor**: peso cobrable = máx(peso real, peso volumétrico L×A×H÷5000),
aplicando la tabla única vigente (hasta 2/5/10/20/30 kg + excedente por kg). La interfaz
nunca replica precios; consume `GET /api/tarifas`.

---

## API (resumen)

| Método | Ruta                          | Acceso           |
| ------ | ----------------------------- | ---------------- |
| GET    | `/api/health`                 | Público          |
| GET    | `/api/tarifas`                | Público          |
| GET    | `/api/rastreo/:guia`          | Público          |
| POST   | `/api/auth/registro`          | Público          |
| POST   | `/api/auth/login`             | Público          |
| GET    | `/api/auth/me`                | Sesión           |
| POST   | `/api/auth/logout`            | Sesión           |
| GET    | `/api/paquetes`               | Cliente           |
| GET/POST | `/api/prealertas`           | Cliente           |
| GET    | `/api/notificaciones`        | Cliente           |
| GET    | `/api/admin/resumen`          | Admin             |
| GET    | `/api/admin/paquetes`         | Admin (paginado)  |
| GET    | `/api/admin/paquetes/buscar`  | Admin             |
| POST   | `/api/admin/paquetes`         | Admin (recepción) |
| PATCH  | `/api/admin/paquetes/:id/estado` | Admin          |
| POST   | `/api/admin/paquetes/:id/foto` | Admin (imagen)   |
| GET    | `/api/admin/prealertas`       | Admin             |
| GET    | `/api/admin/clientes/buscar`  | Admin (por casillero, sin PII) |

Sesión con JWT en cookie `httpOnly` (`venvios_session`). Contraseñas con **argon2id**.
Entradas validadas con Zod y sanitizadas. PII enmascarada en logs y respuestas.

---

## Seguridad y privacidad

- El teléfono del cliente **nunca** llega al frontend ni aparece en la consola de administración.
- Los costos y transiciones de estado se calculan y validan en el backend.
- Fotos de evidencia con nombre aleatorio, límite de tamaño y validación de tipo.
- Rate limiting en endpoints públicos y sensibles; CORS con allowlist; helmet activo.
- El único número visible es el WhatsApp público de la marca (`src/config/brand.ts`).

> **Nota de auditoría de dependencias:** `npm audit` reporta un aviso alto **transitivo**
> (`deepmerge-ts` → `@prisma/config`) que afecta únicamente al **CLI de Prisma** (herramienta
> de desarrollo para migraciones), no al servidor en tiempo de ejecución. Se resuelve al
> migrar a Prisma 7/8. Las dependencias de ejecución (multer, zod, react-router) están
> actualizadas y sin avisos.

Consultá `RULES.md` para el detalle completo de reglas de diseño, marca y negocio.
