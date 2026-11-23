import { beforeEach, describe, expect, it } from 'vitest';
import { PNG_MINIMO, crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

async function consolidadoPesado(valores: number[] = [20, 30]) {
  const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
  const cliente = await registrarCliente(entorno);
  const trackings = valores.map((_, indice) => `COT-${Math.floor(Math.random() * 1e8)}-${indice}`);
  const alerta = await cliente.agente.post('/api/envios').send({ trackings, tienda: 'Shein', valoresUsd: valores });
  for (const texto of trackings) await operador.agente.post('/api/staff/escaneo').send({ texto });
  const ids = alerta.body.envio.paquetes.map((p: { id: string }) => p.id) as string[];
  const consolidado = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: ids, modalidad: 'M1', transportista: 'MRW' });
  const envioId = consolidado.body.envio.id as string;
  const cotizado = await operador.agente.post(`/api/staff/envios/${envioId}/cotizar`).send({ pesoKg: 4 });
  expect(cotizado.status, JSON.stringify(cotizado.body)).toBe(200);
  return { operador, cliente, envioId, ids, envio: cotizado.body.envio };
}

describe('cotización editable', () => {
  it('caso feliz: editar el valor de un paquete recalcula el seguro y el total, y guarda el valor anterior', async () => {
    const { operador, envioId, ids, envio } = await consolidadoPesado();
    const totalAntes = envio.precio.totalCentavos as number;
    const r = await operador.agente.patch(`/api/staff/paquetes/${ids[1]}/valor`).send({ valorUsd: 100, motivo: 'La factura dice 100 dólares' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.envio.valorDeclaradoCentavos).toBe(12000);
    expect(r.body.envio.precio.totalCentavos).toBeGreaterThan(totalAntes);
    const historial = await operador.agente.get(`/api/staff/envios/${envioId}/historial`);
    const evento = historial.body.eventos.find((e: { tipo: string }) => e.tipo === 'VALOR_PAQUETE');
    expect(evento.datos.anteriorCentavos).toBe(3000);
    expect(evento.datos.nuevoCentavos).toBe(10000);
    expect(evento.detalle).toContain('La factura dice 100 dólares');
  });

  it('caso feliz: el seguro se edita a mano y se puede volver a automático', async () => {
    const { operador, envioId, envio } = await consolidadoPesado();
    const automatico = envio.precio.seguroCentavos as number;
    const flete = envio.precio.fleteCentavos as number;
    const manual = await operador.agente.patch(`/api/staff/envios/${envioId}/seguro`).send({ seguroUsd: 7.5, motivo: 'Descuento acordado' });
    expect(manual.body.envio.precio.seguroCentavos).toBe(750);
    expect(manual.body.envio.precio.seguroManual).toBe(true);
    expect(manual.body.envio.precio.totalCentavos).toBe(flete + 750);
    const vuelta = await operador.agente.patch(`/api/staff/envios/${envioId}/seguro`).send({ seguroUsd: null });
    expect(vuelta.status).toBe(200);
    expect(vuelta.body.envio.precio.seguroManual).toBe(false);
    expect(vuelta.body.envio.precio.seguroCentavos).toBe(automatico);
  });

  it('límite: un seguro de cero es válido y el valor manual sobrevive a un cambio de valor', async () => {
    const { operador, envioId, ids } = await consolidadoPesado();
    const cero = await operador.agente.patch(`/api/staff/envios/${envioId}/seguro`).send({ seguroUsd: 0, motivo: 'Sin seguro por pedido' });
    expect(cero.body.envio.precio.seguroCentavos).toBe(0);
    const cambio = await operador.agente.patch(`/api/staff/paquetes/${ids[0]}/valor`).send({ valorUsd: 500, motivo: 'Corrección de factura' });
    expect(cambio.body.envio.precio.seguroCentavos).toBe(0);
    expect(cambio.body.envio.precio.seguroManual).toBe(true);
  });

  it('error: sin motivo, con valor negativo o un seguro negativo se rechaza', async () => {
    const { operador, envioId, ids } = await consolidadoPesado();
    expect((await operador.agente.patch(`/api/staff/paquetes/${ids[0]}/valor`).send({ valorUsd: 10, motivo: '' })).status).toBe(400);
    expect((await operador.agente.patch(`/api/staff/paquetes/${ids[0]}/valor`).send({ valorUsd: -5, motivo: 'Corrección de factura' })).status).toBe(400);
    expect((await operador.agente.patch(`/api/staff/envios/${envioId}/seguro`).send({ seguroUsd: 5, motivo: '' })).status).toBe(400);
    expect((await operador.agente.patch(`/api/staff/envios/${envioId}/seguro`).send({ seguroUsd: -1, motivo: 'Corrección de factura' })).status).toBe(400);
  });

  it('error: el cliente no puede editar valores ni el seguro', async () => {
    const { cliente, envioId, ids } = await consolidadoPesado();
    expect((await cliente.agente.patch(`/api/staff/paquetes/${ids[0]}/valor`).send({ valorUsd: 1, motivo: 'Quiero pagar menos' })).status).toBe(401);
    expect((await cliente.agente.patch(`/api/staff/envios/${envioId}/seguro`).send({ seguroUsd: 0, motivo: 'Quiero pagar menos' })).status).toBe(401);
  });

  it('error: con un pago registrado el operador recibe «prohibido»; el administrador corrige por su ruta', async () => {
    const { operador, cliente, envioId, ids, envio } = await consolidadoPesado();
    const total = envio.precio.totalCentavos as number;
    const pago = await cliente.agente
      .post(`/api/envios/${envioId}/pagos`)
      .field('metodo', 'BINANCE')
      .field('moneda', 'USD')
      .field('monto', (total / 100).toFixed(2))
      .field('referencia', 'BIN445566445566')
      .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
    expect(pago.status).toBe(201);
    const valor = await operador.agente.patch(`/api/staff/paquetes/${ids[0]}/valor`).send({ valorUsd: 1, motivo: 'Corrección de factura' });
    expect(valor.status).toBe(403);
    const seguro = await operador.agente.patch(`/api/staff/envios/${envioId}/seguro`).send({ seguroUsd: 0, motivo: 'Corrección de factura' });
    expect(seguro.status).toBe(403);
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const ajuste = await admin.agente.post(`/api/admin/envios/${envioId}/ajuste`).send({ valorDeclaradoUsd: 40, motivo: 'Factura corregida' });
    expect(ajuste.status).toBe(200);
  });
});
