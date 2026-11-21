import { beforeEach, describe, expect, it } from 'vitest';
import { PNG_MINIMO, crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

async function envioEnRuta() {
  const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
  const cliente = await registrarCliente(entorno);
  const tracking = `CIE-${Math.floor(Math.random() * 1e9)}`;
  const alerta = await cliente.agente.post('/api/envios').send({ trackings: [tracking], tienda: 'Shein', valoresUsd: [20] });
  await operador.agente.post('/api/staff/escaneo').send({ texto: tracking });
  const consolidado = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [alerta.body.envio.paquetes[0].id], modalidad: 'M1', transportista: 'MRW' });
  const envioId = consolidado.body.envio.id as string;
  const cotizado = await operador.agente.post(`/api/staff/envios/${envioId}/cotizar`).send({ pesoKg: 3 });
  const total = cotizado.body.envio.precio.totalCentavos as number;
  const pago = await cliente.agente
    .post(`/api/envios/${envioId}/pagos`)
    .field('metodo', 'BINANCE')
    .field('moneda', 'USD')
    .field('monto', (total / 100).toFixed(2))
    .field('referencia', 'BIN778899778899')
    .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
  await operador.agente.post(`/api/staff/pagos/${pago.body.envio.pagos[0].id}/confirmar`);
  const despacho = await operador.agente.post(`/api/staff/envios/${envioId}/despachar`).field('guia', 'MRW-100200');
  expect(despacho.body.envio.estado).toBe('DESPACHADO');
  return { operador, cliente, envioId };
}

describe('cierre del envío', () => {
  it('caso feliz: el cliente confirma «Ya lo recibí» y el envío queda entregado en el historial', async () => {
    const { operador, cliente, envioId } = await envioEnRuta();
    const r = await cliente.agente.post(`/api/envios/${envioId}/recibido`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.envio.estado).toBe('CERRADO');
    expect(r.body.envio.etiquetaEstado).toBe('Entregado');
    const historial = await operador.agente.get(`/api/staff/envios/${envioId}/historial`);
    expect(JSON.stringify(historial.body)).toContain('El cliente confirmó que recibió');
  });

  it('caso feliz: el operador también puede marcarlo entregado', async () => {
    const { operador, envioId } = await envioEnRuta();
    const r = await operador.agente.post(`/api/staff/envios/${envioId}/cerrar`);
    expect(r.body.envio.estado).toBe('CERRADO');
    const historial = await operador.agente.get(`/api/staff/envios/${envioId}/historial`);
    expect(JSON.stringify(historial.body)).toContain('El personal marcó');
  });

  it('error: un envío que no está en ruta no se puede confirmar', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const tracking = `CIE-${Math.floor(Math.random() * 1e9)}`;
    const alerta = await cliente.agente.post('/api/envios').send({ trackings: [tracking], tienda: 'Shein', valoresUsd: [20] });
    await operador.agente.post('/api/staff/escaneo').send({ texto: tracking });
    const consolidado = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [alerta.body.envio.paquetes[0].id], modalidad: 'M1', transportista: 'MRW' });
    const r = await cliente.agente.post(`/api/envios/${consolidado.body.envio.id}/recibido`);
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('ENVIO_NO_EN_RUTA');
  });

  it('error: un cliente no cierra el envío de otro, ni lo cierra dos veces, ni el personal por esta vía', async () => {
    const { operador, cliente, envioId } = await envioEnRuta();
    const ajeno = await registrarCliente(entorno);
    const intruso = await ajeno.agente.post(`/api/envios/${envioId}/recibido`);
    expect([403, 404]).toContain(intruso.status);
    expect((await operador.agente.post(`/api/envios/${envioId}/recibido`)).status).toBe(403);
    expect((await cliente.agente.post(`/api/envios/${envioId}/recibido`)).status).toBe(200);
    const otraVez = await cliente.agente.post(`/api/envios/${envioId}/recibido`);
    expect(otraVez.status).toBe(400);
  });
});
