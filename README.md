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
- Cuentas de prueba: se crean desde `backend/.env` (`ADMIN_PASSWORD` para el administrador y `OPERADOR_PASSWORD` para un operador). Sin esas variables no existen. Ninguna clave va en el repositorio.
- Cada cliente recibe un número de casillero `VENV-123456` y entra con su correo o con ese número.
- Cada día el servidor consulta la tasa BCV a `ve.dolarapi.com`. Sin internet, el administrador la carga a mano en Admin → Tasa BCV.
- La cámara solo funciona con candado (https) o en `localhost`. Para probar con el teléfono real hay que desplegar (ver abajo).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm test` | Pruebas del backend (109) y del frontend |
| `npm run e2e` | Flujo completo en Chrome real (registro, prealerta, escaneo, pago, entrega, despacho) |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run build` | Compila para producción |
| `npm run db:migrate` / `npm run db:seed` | Crea las tablas y la configuración inicial en Postgres |
| `npm run db:proteger` | Activa la protección por filas de Supabase en todas las tablas (correr después de cada migración) |

## Desplegar (Netlify + Supabase)

1. En Supabase crea un proyecto. Copia la cadena de conexión con pooler (`DATABASE_URL`) y la directa (`DIRECT_URL`). En Storage crea un bucket **privado** llamado `venvios-privado` y copia la clave de servicio.
2. Genera dos secretos: `JWT_SECRET` (cadena larga aleatoria) y `CEDULA_KEY` (64 caracteres hexadecimales, por ejemplo `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. Crea `backend/.env` con las variables de `.env.example` y corre `npm run db:migrate`, `npm run db:proteger` y `npm run db:seed` una vez. Si ya habías migrado antes, vuelve a correr `db:migrate` (cambió el esquema: nombre y teléfono de entrega cifrados, sesiones y intentos de ingreso) y luego `db:proteger`. Define `ADMIN_PASSWORD` y `OPERADOR_PASSWORD` en `backend/.env` antes de sembrar.
4. En Netlify conecta el repositorio y carga las mismas variables (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CEDULA_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`). El build ya está definido en `netlify.toml`.
5. Entra como administrador → Admin → Datos de pago, carga los datos reales (Binance y pago móvil) y desmarca «datos de prueba».

Las claves nunca van en el código ni en Git.

## Pruebas manuales sugeridas (en este orden)

1. Crea una cuenta de cliente y anota su casillero `VENV-…`. En Alertas crea una alerta con 2 trackings y valor 60 $.
2. Como operador, en Escanear recibe los 2 trackings (el peso es opcional). Escanea un tercero que nadie alertó: búscalo por el casillero y guárdalo para ese cliente. Escanea un cuarto y déjalo sin dueño.
3. En Bodega verifica los 4 paquetes, el filtro «Sin dueño» y la antigüedad. Asigna el sin dueño a otro cliente y luego cámbialo de dueño con un motivo.
4. Como cliente, en Consolidar elige los 3 paquetes, modalidad y transportista. Debe quedar «Por consolidar».
5. Como operador, abre el envío, escribe el peso total 4,35 y pulsa Calcular total: con 60 $ declarados da 44,33 $. Pulsa «Enviar total por WhatsApp».
6. Como cliente, en Finanzas paga: el monto viene fijo; la referencia pide 6 dígitos. Intenta un segundo comprobante: debe decir que hay uno en revisión.
7. Confirma el pago, llena los datos de entrega, despacha con guía y foto, y marca «Entregado».
8. Extras: el cliente elimina una alerta pendiente; el operador descarta un paquete con motivo; el cliente deshace un consolidado sin pagos y sus paquetes vuelven a bodega; registra una alerta con el tracking exacto de un paquete sin dueño y verifica que se une solo.
