import { beforeEach, describe, expect, it } from 'vitest';
import { recorridoVisible } from '../src/domain/hitos';
import { PNG_MINIMO, crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

function pasos(envio: { paquetes: Array<{ seguimiento: Array<{ etiqueta: string }> }> }): string[] {
  return envio.paquetes[0]!.seguimiento.map((h) => h.etiqueta);
}

describe('seguimiento por paquete', () => {
  it('caso feliz: cada transición agrega un paso, de la prealerta a la entrega', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const alerta = await cliente.agente.post('/api/envios').send({ trackings: ['SEG-100000001'], tienda: 'Shein', valoresUsd: [20] });
    expect(pasos(alerta.body.envio)).toEqual(['Prealertado']);
    await operador.agente.post('/api/staff/escaneo').send({ texto: 'SEG-100000001' });
    const enBodega = await cliente.agente.get(`/api/envios/${alerta.body.envio.id}`);
    expect(pasos(enBodega.body.envio)).toEqual(['Prealertado', 'En oficina']);

    const consolidado = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [alerta.body.envio.paquetes[0].id], modalidad: 'M1', transportista: 'MRW' });
    const envioId = consolidado.body.envio.id as string;
    expect(pasos(consolidado.body.envio)).toEqual(['Prealertado', 'En oficina', 'Consolidando']);

    const cotizado = await operador.agente.post(`/api/staff/envios/${envioId}/cotizar`).send({ pesoKg: 3 });
    expect(pasos(cotizado.body.envio).at(-1)).toBe('Por pagar');
    const total = cotizado.body.envio.precio.totalCentavos as number;
    const pago = await cliente.agente
      .post(`/api/envios/${envioId}/pagos`)
      .field('metodo', 'BINANCE')
      .field('moneda', 'USD')
      .field('monto', (total / 100).toFixed(2))
      .field('referencia', 'BIN990011990011')
      .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
    expect(pasos(pago.body.envio).at(-1)).toBe('Pago en revisión');
    const confirmado = await operador.agente.post(`/api/staff/pagos/${pago.body.envio.pagos[0].id}/confirmar`);
    expect(pasos(confirmado.body.envio).at(-1)).toBe('Enviando a Venezuela');
    const despacho = await operador.agente.post(`/api/staff/envios/${envioId}/despachar`).field('guia', 'MRW-445566');
    expect(pasos(despacho.body.envio).at(-1)).toBe('En ruta');
    const cierre = await cliente.agente.post(`/api/envios/${envioId}/recibido`);
    expect(pasos(cierre.body.envio)).toEqual(['Prealertado', 'En oficina', 'Consolidando', 'Por pagar', 'Pago en revisión', 'Enviando a Venezuela', 'En ruta', 'Entregado']);
    expect(cierre.body.envio.paquetes[0].seguimiento.every((h: { fecha: string }) => !Number.isNaN(Date.parse(h.fecha)))).toBe(true);
  });

  it('límite: al devolver el paquete a la bodega el recorrido reinicia desde «En oficina»', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const alerta = await cliente.agente.post('/api/envios').send({ trackings: ['SEG-200000001'], tienda: 'Shein', valoresUsd: [20] });
    await operador.agente.post('/api/staff/escaneo').send({ texto: 'SEG-200000001' });
    const paqueteId = alerta.body.envio.paquetes[0].id as string;
    const consolidado = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [paqueteId], modalidad: 'M1', transportista: 'MRW' });
    await operador.agente.post(`/api/staff/envios/${consolidado.body.envio.id}/cotizar`).send({ pesoKg: 2 });
    const deshecho = await cliente.agente.post(`/api/envios/${consolidado.body.envio.id}/deshacer`).send({});
    expect(deshecho.status, JSON.stringify(deshecho.body)).toBe(200);
    const detalle = await operador.agente.get(`/api/staff/bodega?q=SEG-200000001`);
    const item = detalle.body.paquetes.find((p: { paqueteId: string }) => p.paqueteId === paqueteId);
    const envioActual = await operador.agente.get(`/api/envios/${item.envioId}`);
    expect(pasos(envioActual.body.envio)).toEqual(['Prealertado', 'En oficina']);
  });

  it('un paquete que llega sin prealerta no muestra «Prealertado»', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const escaneo = await operador.agente.post('/api/staff/escaneo').send({ texto: 'SEG-300000001' });
    expect(escaneo.body.resultado).toBe('SIN_PREALERTA');
    const registrado = await operador.agente.post('/api/staff/sin-prealerta').send({ texto: 'SEG-300000001' });
    expect(registrado.status, JSON.stringify(registrado.body)).toBe(201);
    const envio = await operador.agente.get(`/api/envios/${registrado.body.envio.id}`);
    expect(pasos(envio.body.envio)).toEqual(['En oficina']);
  });
});

describe('recorrido visible', () => {
  const fecha = (segundos: number) => new Date(1_700_000_000_000 + segundos * 1000);

  it('caso feliz: ordena por fecha', () => {
    const lista = recorridoVisible([
      { tipo: 'EN_OFICINA' as const, creadoEn: fecha(2) },
      { tipo: 'PREALERTADO' as const, creadoEn: fecha(1) },
    ]);
    expect(lista.map((h) => h.tipo)).toEqual(['PREALERTADO', 'EN_OFICINA']);
  });

  it('límite: sin pasos devuelve una lista vacía', () => {
    expect(recorridoVisible([])).toEqual([]);
  });

  it('caso feliz: tras volver a la oficina conserva la prealerta y descarta los pasos intermedios', () => {
    const lista = recorridoVisible([
      { tipo: 'PREALERTADO' as const, creadoEn: fecha(1) },
      { tipo: 'EN_OFICINA' as const, creadoEn: fecha(2) },
      { tipo: 'CONSOLIDANDO' as const, creadoEn: fecha(3) },
      { tipo: 'POR_PAGAR' as const, creadoEn: fecha(4) },
      { tipo: 'EN_OFICINA' as const, creadoEn: fecha(5) },
    ]);
    expect(lista.map((h) => h.tipo)).toEqual(['PREALERTADO', 'EN_OFICINA']);
    expect(lista[1]!.creadoEn).toEqual(fecha(5));
  });
});

describe('búsqueda por código de consolidación', () => {
  it('caso feliz: el operador encuentra el envío con «Consolidación XXXXXX» o solo con el código', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const alerta = await cliente.agente.post('/api/envios').send({ trackings: ['COD-100000001'], tienda: 'Shein', valoresUsd: [5] });
    await operador.agente.post('/api/staff/escaneo').send({ texto: 'COD-100000001' });
    const consolidado = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [alerta.body.envio.paquetes[0].id], modalidad: 'M1', transportista: 'MRW' });
    const id = consolidado.body.envio.id as string;
    const codigo = id.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase();
    const conPalabra = await operador.agente.get(`/api/envios?q=${encodeURIComponent(`Consolidación ${codigo}`)}`);
    expect(conPalabra.body.envios.map((e: { id: string }) => e.id)).toContain(id);
    const soloCodigo = await operador.agente.get(`/api/envios?q=${codigo.toLowerCase()}`);
    expect(soloCodigo.body.envios.map((e: { id: string }) => e.id)).toContain(id);
  });

  it('error: un código que no existe no devuelve envíos', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const r = await operador.agente.get('/api/envios?q=ZZZZZZ');
    expect(r.body.envios).toHaveLength(0);
  });
});
