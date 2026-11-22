# Venvios Express

Casillero internacional Colombia a Venezuela. Compras de Shein, AliExpress y Amazon llegan a Cúcuta, se pesan, se cobran en dólares (pago en Bs a tasa BCV) y se despachan por MRW o Zoom. Sin bot de WhatsApp: el sistema deja el mensaje listo y una persona lo envía.

Specs en `specs/002-venvios-express-v2/` (spec, plan, tareas). Antes de programar, leer la spec.

## Estructura
- `backend/`: TypeScript. `src/domain` reglas puras, `src/services` casos de uso, `src/repositories` acceso a datos (Prisma y memoria), `src/http` rutas Express.
- `frontend/`: React + Vite + Tailwind, PWA.
- `backend/netlify/functions/api.ts`: expone el backend como función de Netlify. Vive dentro de `backend/` para que encuentre `@prisma/client` en `backend/node_modules`.

## Comandos
- `npm install`
- `npm run dev` (API en 4000 con repositorios en memoria si falta `DATABASE_URL`, web en 5173)
- `npm test` pruebas del backend y del frontend
- `npm run typecheck`
- `npm run build`
- `npm run db:migrate` y `npm run db:seed` con `DATABASE_URL` de Supabase en `.env`

## Reglas del proyecto
- Rama de trabajo: `rediseno-v2`. Nunca directo en `main`.
- Todo se prueba con `npm run dev` en la terminal, y las pruebas manuales se hacen en el teléfono y en la laptop. No se sube a Netlify para probar: cada despliegue gasta créditos del plan gratis (300 al mes, 15 por despliegue).
- Los commits solo despliegan en Netlify si cambian código (`backend`, `frontend`, `netlify.toml` o dependencias); los cambios solo de specs o documentación no despliegan. Aun así, conviene juntar cambios antes de subir.
- Sin comentarios en el código. Logs sin datos sensibles (sin cédula, teléfono, nombre completo).
- Los datos bancarios reales no van en Git: se cargan desde el panel del administrador.
- Dinero en dólares con centavos; Bs solo para mostrar, con la tasa BCV del día.
