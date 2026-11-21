import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

type Agente = Awaited<ReturnType<typeof registrarCliente>>['agente'];

async function recibirTodos(operador: Agente, trackings: string[]) {
  for (const texto of trackings) await operador.post('/api/staff/escaneo').send({ texto });
}

describe('valor declarado por guía', () => {
  it('caso feliz: consolido 2 de 3 paquetes y el valor del envío es la suma de esos 2', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const { agente } = await registrarCliente(entorno);
    const trackings = ['VAL-100000001', 'VAL-100000002', 'VAL-100000003'];
    const alerta = await agente.post('/api/envios').send({ trackings, tienda: 'Shein', valoresUsd: [10, 25.5, 40] });
    expect(alerta.status, JSON.stringify(alerta.body)).toBe(201);
    expect(alerta.body.envio.valorDeclaradoCentavos).toBe(7550);
    expect(alerta.body.envio.paquetes.map((p: { valorDeclaradoCentavos: number }) => p.valorDeclaradoCentavos)).toEqual([1000, 2550, 4000]);
    await recibirTodos(operador.agente, trackings);

    const ids = alerta.body.envio.paquetes.map((p: { id: string }) => p.id) as string[];
    const consolidado = await agente.post('/api/envios/consolidar').send({ paqueteIds: [ids[0], ids[2]], modalidad: 'M1', transportista: 'MRW' });
    expect(consolidado.status, JSON.stringify(consolidado.body)).toBe(201);
    expect(consolidado.body.envio.valorDeclaradoCentavos).toBe(5000);
  });

  it('el valor que mande el cliente al consolidar se ignora: manda la suma de los paquetes', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const { agente } = await registrarCliente(entorno);
    const alerta = await agente.post('/api/envios').send({ trackings: ['VAL-200000001'], tienda: 'Amazon', valoresUsd: [12] });
    await recibirTodos(operador.agente, ['VAL-200000001']);
    const consolidado = await agente
      .post('/api/envios/consolidar')
      .send({ paqueteIds: [alerta.body.envio.paquetes[0].id], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 999 });
    expect(consolidado.body.envio.valorDeclaradoCentavos).toBe(1200);
  });

  it('límite: un valor total antiguo se reparte entre las guías sin perder centavos', async () => {
    const { agente } = await registrarCliente(entorno);
    const alerta = await agente.post('/api/envios').send({ trackings: ['VAL-300000001', 'VAL-300000002', 'VAL-300000003'], tienda: 'Shein', valorDeclaradoUsd: 10 });
    const valores = alerta.body.envio.paquetes.map((p: { valorDeclaradoCentavos: number }) => p.valorDeclaradoCentavos) as number[];
    expect(valores.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(valores).toEqual([334, 333, 333]);
  });

  it('límite: cero es un valor válido para una guía', async () => {
    const { agente } = await registrarCliente(entorno);
    const alerta = await agente.post('/api/envios').send({ trackings: ['VAL-400000001', 'VAL-400000002'], tienda: 'Shein', valoresUsd: [0, 5] });
    expect(alerta.status).toBe(201);
    expect(alerta.body.envio.valorDeclaradoCentavos).toBe(500);
  });

  it('error: faltan valores, sobran valores o uno es negativo', async () => {
    const { agente } = await registrarCliente(entorno);
    const faltan = await agente.post('/api/envios').send({ trackings: ['VAL-500000001', 'VAL-500000002'], tienda: 'Shein', valoresUsd: [10] });
    expect(faltan.status).toBe(400);
    const sobran = await agente.post('/api/envios').send({ trackings: ['VAL-500000003'], tienda: 'Shein', valoresUsd: [10, 20] });
    expect(sobran.status).toBe(400);
    const negativo = await agente.post('/api/envios').send({ trackings: ['VAL-500000004'], tienda: 'Shein', valoresUsd: [-1] });
    expect(negativo.status).toBe(400);
  });

  it('al quitar un paquete del consolidado, el valor del envío baja con él', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const { agente } = await registrarCliente(entorno);
    const trackings = ['VAL-600000001', 'VAL-600000002'];
    const alerta = await agente.post('/api/envios').send({ trackings, tienda: 'Shein', valoresUsd: [10, 30] });
    await recibirTodos(operador.agente, trackings);
    const ids = alerta.body.envio.paquetes.map((p: { id: string }) => p.id) as string[];
    const consolidado = await agente.post('/api/envios/consolidar').send({ paqueteIds: ids, modalidad: 'M1', transportista: 'MRW' });
    expect(consolidado.body.envio.valorDeclaradoCentavos).toBe(4000);
    const quitado = await operador.agente.post(`/api/staff/envios/${consolidado.body.envio.id}/quitar-paquete`).send({ paqueteId: ids[1] });
    expect(quitado.status, JSON.stringify(quitado.body)).toBe(200);
    expect(quitado.body.envio.valorDeclaradoCentavos).toBe(1000);
  });
});
