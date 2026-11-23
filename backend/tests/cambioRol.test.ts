import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

describe('cambio de rol (solo administrador)', () => {
  it('caso feliz: el administrador convierte un cliente en operador y el operador ya entra al panel', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const cliente = await registrarCliente(entorno, {}, { conPerfil: false });
    expect((await cliente.agente.get('/api/staff/resumen')).status).toBe(403);

    const cambio = await admin.agente.put(`/api/admin/usuarios/${cliente.usuario.id}/rol`).send({ rol: 'OPERADOR' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.usuario.rol).toBe('OPERADOR');

    const nuevaSesion = entorno.agente();
    await nuevaSesion.post('/api/auth/login').send({ identificador: cliente.datos.email, contrasena: cliente.datos.contrasena });
    expect((await nuevaSesion.get('/api/staff/resumen')).status).toBe(200);
  });

  it('caso feliz: el operador vuelve a ser cliente, pierde el panel y su sesión anterior se cierra', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const lista = await admin.agente.get('/api/admin/usuarios');
    const idOperador = (lista.body.usuarios as Array<{ id: string; email: string }>).find((u) => u.email === operador.datos.email)!.id;

    const cambio = await admin.agente.put(`/api/admin/usuarios/${idOperador}/rol`).send({ rol: 'CLIENTE' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.usuario.rol).toBe('CLIENTE');
    expect((await operador.agente.get('/api/auth/yo')).status).toBe(401);

    const nuevaSesion = entorno.agente();
    await nuevaSesion.post('/api/auth/login').send({ identificador: operador.datos.email, contrasena: operador.datos.contrasena });
    expect((await nuevaSesion.get('/api/staff/resumen')).status).toBe(403);
  });

  it('límite: poner el mismo rol que ya tiene no falla ni cambia nada', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const cliente = await registrarCliente(entorno, {}, { conPerfil: false });
    const r = await admin.agente.put(`/api/admin/usuarios/${cliente.usuario.id}/rol`).send({ rol: 'CLIENTE' });
    expect(r.status).toBe(200);
    expect((await cliente.agente.get('/api/auth/yo')).status).toBe(200);
  });

  it('error: un operador o un cliente no pueden cambiar roles', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno, {}, { conPerfil: false });
    expect((await operador.agente.put(`/api/admin/usuarios/${cliente.usuario.id}/rol`).send({ rol: 'OPERADOR' })).status).toBe(403);
    expect((await cliente.agente.put(`/api/admin/usuarios/${cliente.usuario.id}/rol`).send({ rol: 'OPERADOR' })).status).toBe(403);
  });

  it('error: no se puede volver administrador, ni cambiar a un administrador, ni el rol propio', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const cliente = await registrarCliente(entorno, {}, { conPerfil: false });
    expect((await admin.agente.put(`/api/admin/usuarios/${cliente.usuario.id}/rol`).send({ rol: 'ADMIN' })).status).toBe(400);

    const yo = (await admin.agente.get('/api/auth/yo')).body.usuario.id as string;
    expect((await admin.agente.put(`/api/admin/usuarios/${yo}/rol`).send({ rol: 'CLIENTE' })).status).toBe(400);

    const otroAdmin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const idOtro = (await otroAdmin.agente.get('/api/auth/yo')).body.usuario.id as string;
    expect((await admin.agente.put(`/api/admin/usuarios/${idOtro}/rol`).send({ rol: 'CLIENTE' })).status).toBe(400);
  });

  it('error: un usuario que no existe responde 404', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    expect((await admin.agente.put('/api/admin/usuarios/no-existe/rol').send({ rol: 'OPERADOR' })).status).toBe(404);
  });
});

describe('personal nuevo', () => {
  it('caso feliz: un operador creado por el administrador entra sin que le pidan cambiar la clave', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const datos = { nombre: 'Nuevo Operador', cedula: '30111222', email: 'nuevo.operador@correo.com', telefono: '573001299001', contrasena: 'ClavePrueba2026!', rol: 'OPERADOR' };
    const creado = await admin.agente.post('/api/admin/usuarios').send(datos);
    expect(creado.status).toBe(201);
    expect(creado.body.usuario.debeCambiarClave).toBe(false);
  });
});

describe('vista de cliente para el personal', () => {
  it('caso feliz: un operador con la vista cliente crea y ve solo sus propias alertas', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const otro = await registrarCliente(entorno);
    await otro.agente.post('/api/envios').send({ trackings: ['AJENO-1'], tienda: 'Shein', valorDeclaradoUsd: 10 });

    const propia = await operador.agente.post('/api/envios').set('X-Vista', 'cliente').send({ trackings: ['PROPIO-1'], tienda: 'Shein', valorDeclaradoUsd: 10 });
    expect(propia.status).toBe(201);

    const comoCliente = await operador.agente.get('/api/envios').set('X-Vista', 'cliente');
    expect(comoCliente.status).toBe(200);
    expect(comoCliente.body.envios).toHaveLength(1);

    const comoPersonal = await operador.agente.get('/api/envios');
    expect(comoPersonal.body.envios.length).toBeGreaterThanOrEqual(2);
  });

  it('error: la vista cliente no da permisos extra, solo los quita', async () => {
    const cliente = await registrarCliente(entorno, {}, { conPerfil: false });
    expect((await cliente.agente.get('/api/staff/resumen').set('X-Vista', 'personal')).status).toBe(403);
    expect((await cliente.agente.get('/api/admin/usuarios').set('X-Vista', 'cliente')).status).toBe(403);
  });
});

describe('datos de pago: marca de prueba', () => {
  const reales = {
    esPrueba: true,
    pagoMovil: { activo: true, banco: '0102 - BANCO DE VENEZUELA', cedula: '12345678', telefono: '04141234567' },
    cuenta: { activo: false, tipo: 'CORRIENTE', banco: 'BANCO DE PRUEBA', numero: '0000', titular: 'TITULAR DE PRUEBA', cedula: '0' },
    binance: { activo: false, usuario: 'DATOS DE PRUEBA', correo: 'prueba@example.com', nota: '' },
    notaVerificacion: 'Enviar captura.',
  };

  it('caso feliz: al guardar datos reales en los métodos activos deja de ser de prueba', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    expect((await admin.agente.put('/api/admin/config/datosPago').send({ valor: reales })).status).toBe(200);
    const guardado = await admin.agente.get('/api/admin/config/datosPago');
    expect(guardado.body.valor.esPrueba).toBe(false);
  });

  it('error: si un método activo aún tiene texto de prueba, sigue marcado como de prueba', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const conPrueba = { ...reales, cuenta: { ...reales.cuenta, activo: true } };
    await admin.agente.put('/api/admin/config/datosPago').send({ valor: conPrueba });
    expect((await admin.agente.get('/api/admin/config/datosPago')).body.valor.esPrueba).toBe(true);
  });

  it('límite: sin ningún método activo sigue marcado como de prueba', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    await admin.agente.put('/api/admin/config/datosPago').send({ valor: { ...reales, pagoMovil: { ...reales.pagoMovil, activo: false } } });
    expect((await admin.agente.get('/api/admin/config/datosPago')).body.valor.esPrueba).toBe(true);
  });
});

describe('estadísticas de usuarios', () => {
  it('caso feliz: cuenta clientes, nuevos de la semana y personal sin contar la cuenta interna', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    await crearPersonalYEntrar(entorno, 'OPERADOR');
    await registrarCliente(entorno, {}, { conPerfil: false });
    await registrarCliente(entorno, {}, { conPerfil: false });
    const r = await admin.agente.get('/api/admin/estadisticas/usuarios');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ clientes: 2, operadores: 1, administradores: 1, total: 4 });
    expect(r.body.clientesNuevos7Dias).toBeLessThanOrEqual(r.body.clientes);
  });

  it('error: un operador no puede ver las estadísticas', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    expect((await operador.agente.get('/api/admin/estadisticas/usuarios')).status).toBe(403);
  });
});
