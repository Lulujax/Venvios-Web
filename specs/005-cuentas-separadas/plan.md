# Plan 005: Cuentas separadas

## Decisión
Una sola tabla `Usuario` con un campo `ambito` (CLIENTE o PERSONAL), datos únicos por ámbito, dos logins, dos cookies y dos llaves de firma de sesión.

Cambio frente al plan inicial (dos tablas físicas): se mantiene una tabla porque los envíos, pagos y eventos ya apuntan a `Usuario` y separar tablas obligaba a reescribir casi todo el servicio de envíos y a migrar relaciones. La separación que protege (login, llave, cookie, rutas) es igual de fuerte. Una restricción en la base de datos impide que el ámbito no coincida con el rol.

## Pasos
1. **Base de datos:** columna `ambito` en `Usuario`; únicos `(ambito, correo)`, `(ambito, cédula)` y `(ambito, teléfono)` en lugar de únicos globales. El código de casillero sigue siendo único global.
2. **Migración:** `20261123000000_cuentas_separadas`: crea el campo, marca como PERSONAL a OPERADOR y ADMIN, cambia los índices y agrega la restricción ámbito/rol. No mueve filas ni toca ids ni claves.
3. **Repositorios y servicios:** las búsquedas por correo, cédula, teléfono y código reciben el ámbito. El ámbito sale del rol al crear.
4. **Sesiones:** llave `JWT_SECRET` para clientes y `JWT_SECRET_PERSONAL` para el personal (si falta, se deriva de la primera). El carnet lleva `amb`. Clientes: 5 intentos, bloqueo de 10 minutos, 7 días. Personal: 5 intentos, bloqueo de 3 minutos, 8 horas.
5. **Rutas y cookies:** `/api/auth/*` es para clientes y `/api/equipo/auth/*` para el personal. Cookies `venvios_sesion` y `venvios_equipo`. `/api/staff/*` y `/api/admin/*` solo aceptan la cookie del personal; `/api/perfil*` solo la de clientes. Las rutas compartidas (envíos, archivos) eligen la cookie con la cabecera `X-Ambito` que manda la web según la pantalla.
6. **Web:** `/ingresar` (clientes) y `/equipo` (personal; `/admin` redirige ahí). El panel y `/equipo/*` usan el ámbito equipo; el resto, cliente.
7. **Pruebas:** misma persona en ambos mundos, carnet cruzado o falsificado rechazado, bloqueo por intentos, sesiones simultáneas, rutas del frontend.

## Opciones descartadas
- **Una tabla con par único (correo, rol):** mezcla los mundos; un filtro mal puesto expone el panel.
- **Solo ocultar la dirección del personal:** no protege, la protección es la validación del servidor.
- **Misma llave para ambos carnets:** un carnet manipulado podría colarse.

## Riesgos
- La migración en Supabase cambia índices: respaldo antes y aplicarla una sola vez con `npm run db:deploy -w backend`.
- Hay que definir `JWT_SECRET_PERSONAL` en Netlify/Vercel (si falta, se deriva de `JWT_SECRET` y se avisa en el log).
