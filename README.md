# Venvios Express

Casillero internacional Colombia a Venezuela. Las compras de Shein, AliExpress y Amazon llegan a la oficina de Cúcuta, se escanean con el teléfono, se pesan, se cobran en dólares (pago en Bs a tasa BCV) y se despachan por MRW o Zoom. No hay bot de WhatsApp: el sistema deja el mensaje listo y una persona lo envía.

Specs en `specs/001-recepcion-y-despacho/` (spec, plan y tareas).

## Probar en tu computadora

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/salud
- Sin `DATABASE_URL` la API usa datos en memoria (se pierden al reiniciar). Es lo ideal para probar.
- Administrador de desarrollo: teléfono `573000000001`, contraseña `AdminDev2026!`. Solo existe cuando no hay `ADMIN_PASSWORD`.
- Cada día el servidor consulta la tasa BCV a `ve.dolarapi.com`. Sin internet, el administrador la carga a mano en Admin → Tasa BCV.
- La cámara solo funciona con candado (https) o en `localhost`. Para probar con el teléfono real hay que desplegar (ver abajo).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm test` | Pruebas del backend (62) y del frontend (22) |
| `npm run e2e` | Flujo completo en Chrome real (registro, prealerta, escaneo, pago, entrega, despacho) |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run build` | Compila para producción |
| `npm run db:migrate` / `npm run db:seed` | Crea las tablas y la configuración inicial en Postgres |

## Desplegar (Netlify + Supabase)

1. En Supabase crea un proyecto. Copia la cadena de conexión con pooler (`DATABASE_URL`) y la directa (`DIRECT_URL`). En Storage crea un bucket **privado** llamado `venvios-privado` y copia la clave de servicio.
2. Genera dos secretos: `JWT_SECRET` (cadena larga aleatoria) y `CEDULA_KEY` (64 caracteres hexadecimales, por ejemplo `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. Crea `backend/.env` con las variables de `.env.example` y corre `npm run db:migrate` y `npm run db:seed` una vez. Define `ADMIN_PASSWORD` antes de sembrar.
4. En Netlify conecta el repositorio y carga las mismas variables (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CEDULA_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`). El build ya está definido en `netlify.toml`.
5. Entra como administrador → Admin → Datos de pago, carga los datos reales (Binance y pago móvil) y desmarca «datos de prueba».

Las claves nunca van en el código ni en Git.

## Pruebas manuales sugeridas (en este orden)

1. Abre la página en el teléfono y en la PC: sin barras horizontales, menú usable.
2. Crea una cuenta de cliente. Registra una prealerta con 2 trackings, valor 60 $, modalidad «todo incluido».
3. Entra como operador en otro navegador. En Escanear apunta la cámara a una etiqueta real de Shein/X-Cargo (o escribe el tracking). Verifica que reconoce al cliente.
4. Pesa 2,40 y 1,95 kg. El total debe ser 44,33 $.
5. Pulsa «Avisar por WhatsApp»: en el teléfono abre la app, en la PC abre WhatsApp Web con el mensaje.
6. Como cliente, sube un comprobante. Como operador, confírmalo en Pagos.
7. Como cliente, llena los datos de entrega. Como operador, despacha con una guía y una foto. Prueba «Enviar guía por WhatsApp».
8. Instala la página en el teléfono («Agregar a pantalla de inicio»).
