# 005 Cuentas separadas: clientes y personal

## El qué y el porqué
Hoy clientes, operadores y administradores viven en la misma lista de usuarios y entran por el mismo login. Eso permite que un atacante que consiga manipular su sesión intente llegar al panel del personal, y obliga a que una persona sea solo una cosa: si ya existe como cliente, no se le puede crear como operador.

Se separan en dos mundos: **cuentas de cliente** y **cuentas de personal** (operadores y administradores). Cada mundo tiene su propio login, su propia dirección y sus propias reglas. Una misma persona puede tener una cuenta en cada mundo y el sistema las trata como dos personas distintas.

## Requisitos

- RF-1: EL SISTEMA tratará las cuentas de clientes y las del personal como dos mundos separados: los datos únicos (correo, cédula, teléfono) se comparan solo dentro de cada mundo.
- RF-2: EL SISTEMA ofrecerá un login para clientes y otro login para el personal, cada uno en su propia dirección web.
- RF-3: CUANDO alguien inicia sesión en el login de clientes, EL SISTEMA buscará solo entre cuentas de clientes. CUANDO inicia sesión en el login del personal, buscará solo entre cuentas de personal.
- RF-4: EL SISTEMA firmará las sesiones de clientes y las del personal con llaves distintas, de modo que una sesión de cliente nunca sea aceptada en las rutas del personal, ni al revés.
- RF-5: CUANDO un administrador cree una cuenta de personal con un correo, cédula o teléfono que ya existen como cliente, EL SISTEMA la creará sin problema. Esos datos solo se comparan contra otras cuentas de personal.
- RF-6: CUANDO un cliente se registre con datos que ya existen como personal, EL SISTEMA lo registrará sin problema. Esos datos solo se comparan contra otras cuentas de clientes.
- RF-7: SI los datos ya existen en el mismo mundo, ENTONCES EL SISTEMA rechazará la creación con un mensaje claro.
- RF-8: EL SISTEMA aplicará al login del personal un límite de intentos fallidos más estricto y una duración de sesión más corta que al de clientes. Valores definidos por el dueño: 5 intentos y bloqueo de 3 minutos; la sesión dura 8 horas (clientes: 5 intentos, bloqueo de 10 minutos y sesión de 7 días).
- RF-9: SI se intenta usar una sesión de un mundo en las rutas del otro, ENTONCES EL SISTEMA responderá "no autorizado" y dejará un registro en consola sin datos sensibles.
- RF-10: EL SISTEMA no tendrá cambio de rol entre panel y vista de cliente (ya estaba deshecho antes de esta spec). El personal que quiera ver la vista de cliente usará su cuenta de cliente aparte.
- RF-11: CUANDO se aplique el cambio, EL SISTEMA pasará los operadores y administradores actuales a la lista del personal sin perder su acceso. No se les crea cuenta de cliente automática; solo a quien la pida. [Asumido, el dueño puede cambiarlo]
- RF-12: EL SISTEMA seguirá exigiendo que cada acción del panel valide en el servidor que la sesión pertenece al personal y tiene el rol adecuado, sin confiar en lo que muestre la pantalla.

## Cómo sé que está listo
- Creo un cliente y le creo después una cuenta de operador con los mismos datos: ambas existen y puedo entrar a cada una por su login.
- Con la sesión de cliente, las rutas del personal responden "no autorizado".
- Con la sesión de personal, las rutas de clientes responden "no autorizado".
- Si pongo un correo de personal en el login de clientes, no entra (y al revés).
- Tras 5 fallos seguidos (o el límite que se defina) el login del personal se bloquea.
- Los operadores y administradores que ya existían siguen entrando por el login del personal.
- Con las dos cuentas abiertas en el mismo navegador, cada una funciona según el acceso (panel o cuenta) y cerrar una no cierra la otra.
- Las pruebas automáticas del proyecto pasan.

## Fuera de alcance
- Verificación en dos pasos (código en el teléfono): spec futura.
- Cambiar los permisos de cada rol dentro del panel.
- Recuperación de contraseña por correo.
- Ocultar la dirección del login del personal como medio de seguridad (la seguridad la da la validación del servidor).
