# Tareas 005: Cuentas separadas

Rama de trabajo: `cambio-de-rol`. Se hicieron todas en lote; las casillas se marcan cuando el dueño confirme la prueba manual.

## T1: Inventario de uso de Usuario y rol
Mapear en el backend y frontend todo lo que usa `Usuario` y `rol`, para saber qué se toca.
Cubre: RF-1, RF-12
Hecho cuando: hay una lista corta de archivos afectados y no se cambió código.
[ ] Hecha y probada

## T2: Modelo de datos con dos tablas
Agregar `Cliente` y `Personal` al esquema de Prisma y los tipos de repositorio, con campos únicos por tabla.
Cubre: RF-1, RF-5, RF-6
Hecho cuando: el esquema valida y las pruebas muestran que el mismo correo, cédula y teléfono caben en ambas tablas pero no se repiten dentro de una.
[ ] Hecha y probada

## T3: Repositorios en memoria y Prisma
`ClienteRepository` y `PersonalRepository` con sus pruebas.
Cubre: RF-1, RF-7
Hecho cuando: las pruebas de crear, buscar y duplicado dentro del mismo mundo pasan.
[ ] Hecha y probada

## T4: Servicio de acceso de clientes
Registro y login de clientes con 5 intentos y sesión de 7 días, firmada con `JWT_SECRET_CLIENTE`.
Cubre: RF-3, RF-4, RF-6, RF-7
Hecho cuando: pruebas de caso feliz, límite de intentos y dato duplicado pasan.
[ ] Hecha y probada

## T5: Servicio de acceso del personal
Creación por administrador y login con 3 intentos y sesión de 8 horas, firmada con `JWT_SECRET_PERSONAL`.
Cubre: RF-3, RF-4, RF-5, RF-8
Hecho cuando: pruebas de caso feliz, bloqueo a los 3 intentos y creación con datos que existen como cliente pasan.
[ ] Hecha y probada

## T6: Rutas separadas y rechazo cruzado
`/api/cliente/*` y `/api/panel/*` con su verificación de carnet y rol; el carnet del otro mundo responde "no autorizado" con log sin datos sensibles.
Cubre: RF-2, RF-9, RF-12
Hecho cuando: pruebas de carnet cruzado en ambas direcciones pasan.
[ ] Hecha y probada

## T7: Migración de datos
Script que copia usuarios a `Cliente` y `Personal` conservando ids y claves. Probar en local y con respaldo antes de Supabase.
Cubre: RF-11
Hecho cuando: en local, los operadores y admins entran por el login del personal y los clientes por el suyo, con sus envíos intactos.
[ ] Hecha y probada

## T8: Pantallas de login separadas
`/ingresar` para clientes y `/equipo` para el personal.
Cubre: RF-2, RF-3
Hecho cuando: pruebo a mano cada login con cuenta del otro mundo y no entra.
[ ] Hecha y probada

## T9: Quitar el cambio de rol
Eliminar el botón y la vista de cliente del personal.
Cubre: RF-10
Hecho cuando: el panel no ofrece cambiar a vista de cliente y las pruebas del frontend pasan.
[ ] Hecha y probada

## T10: Prueba de punta a punta
Crear un cliente y luego una cuenta de personal con los mismos datos; entrar a ambas; probar carnets cruzados.
Cubre: RF-5, RF-6, RF-9
Hecho cuando: se cumple la lista «Cómo sé que está listo» de la spec y `npm test` y `npm run typecheck` pasan.
[ ] Hecha y probada
