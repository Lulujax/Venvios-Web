import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
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
