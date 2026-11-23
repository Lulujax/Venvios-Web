import { beforeEach, describe, expect, it } from 'vitest';
import { PNG_MINIMO, crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

async function pagoPendiente(operadorAgente: Awaited<ReturnType<typeof crearPersonalYEntrar>>['agente'], nombre: string) {
  const cliente = await registrarCliente(entorno, { nombre });
  const tracking = `MAS-${Math.floor(Math.random() * 1e9)}`;
  const alerta = await cliente.agente.post('/api/envios').send({ trackings: [tracking], tienda: 'Shein', valoresUsd: [20] });
  await operadorAgente.post('/api/staff/escaneo').send({ texto: tracking });
  const consolidado = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [alerta.body.envio.paquetes[0].id], modalidad: 'M1', transportista: 'MRW' });
  const envioId = consolidado.body.envio.id as string;
  const cotizado = await operadorAgente.post(`/api/staff/envios/${envioId}/cotizar`).send({ pesoKg: 3 });
  const total = cotizado.body.envio.precio.totalCentavos as number;
  const pago = await cliente.agente
    .post(`/api/envios/${envioId}/pagos`)
    .field('metodo', 'BINANCE')
    .field('moneda', 'USD')
    .field('monto', (total / 100).toFixed(2))
    .field('referencia', `REF${Math.floor(Math.random() * 1e9)}`)
    .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
  return { envioId, pagoId: pago.body.envio.pagos[0].id as string };
}

describe('pagos por revisar en masa (RF-138, RF-143, RF-144, RF-146)', () => {
  it('caso feliz: la lista trae todos los pagos pendientes, sin tope, del más antiguo al más reciente', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const primero = await pagoPendiente(operador.agente, 'Primera Prueba');
    const segundo = await pagoPendiente(operador.agente, 'Segunda Prueba');
    const tercero = await pagoPendiente(operador.agente, 'Tercera Prueba');
    const lista = await operador.agente.get('/api/staff/pagos/pendientes');
    expect(lista.status).toBe(200);
    const ids = (lista.body.pagos as Array<{ pagoId: string }>).map((p) => p.pagoId);
    expect(ids).toEqual([primero.pagoId, segundo.pagoId, tercero.pagoId]);
    expect(lista.body.pagos[0]).toMatchObject({ envioId: primero.envioId, cliente: 'Primera Prueba', metodo: 'BINANCE', moneda: 'USD', tieneComprobante: true });
  });

  it('caso feliz: confirmar un lote confirma cada pago y cuenta los envíos que quedaron pagados', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const a = await pagoPendiente(operador.agente, 'Lote Uno Prueba');
    const b = await pagoPendiente(operador.agente, 'Lote Dos Prueba');
    const r = await operador.agente.post('/api/staff/pagos/confirmar-lote').send({ ids: [a.pagoId, b.pagoId] });
    expect(r.status).toBe(200);
    expect(r.body.confirmados).toEqual([a.pagoId, b.pagoId]);
    expect(r.body.fallidos).toEqual([]);
    expect(r.body.enviosPagados).toBe(2);
    expect((await operador.agente.get('/api/staff/pagos/pendientes')).body.pagos).toEqual([]);
  });

  it('límite: un lote con el mismo pago repetido lo cuenta una sola vez', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const a = await pagoPendiente(operador.agente, 'Repetido Prueba');
    const r = await operador.agente.post('/api/staff/pagos/confirmar-lote').send({ ids: [a.pagoId, a.pagoId] });
    expect(r.body.confirmados).toEqual([a.pagoId]);
  });

  it('error: si un pago ya fue revisado, los demás se confirman y ese aparece con su motivo', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const yaRevisado = await pagoPendiente(operador.agente, 'Ya Revisado Prueba');
    const pendiente = await pagoPendiente(operador.agente, 'Pendiente Prueba');
    await operador.agente.post(`/api/staff/pagos/${yaRevisado.pagoId}/confirmar`);
    const r = await operador.agente.post('/api/staff/pagos/confirmar-lote').send({ ids: [yaRevisado.pagoId, pendiente.pagoId] });
    expect(r.status).toBe(200);
    expect(r.body.confirmados).toEqual([pendiente.pagoId]);
    expect(r.body.fallidos).toEqual([{ id: yaRevisado.pagoId, motivo: 'Ese pago ya fue revisado.' }]);
  });

  it('límite: un lote de 101 pagos se rechaza con mensaje claro, y uno vacío también', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const demasiados = Array.from({ length: 101 }, (_, i) => `pago-${i}`);
    const grande = await operador.agente.post('/api/staff/pagos/confirmar-lote').send({ ids: demasiados });
    expect(grande.status).toBe(400);
    const vacio = await operador.agente.post('/api/staff/pagos/confirmar-lote').send({ ids: [] });
    expect(vacio.status).toBe(400);
  });

  it('error: un cliente no ve la lista del personal ni puede confirmar lotes', async () => {
    const cliente = await registrarCliente(entorno);
    expect((await cliente.agente.get('/api/staff/pagos/pendientes')).status).toBe(401);
    expect((await cliente.agente.post('/api/staff/pagos/confirmar-lote').send({ ids: ['x'] })).status).toBe(401);
  });
});
