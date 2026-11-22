import { beforeEach, describe, expect, it } from 'vitest';
import { PNG_MINIMO, crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

type Agente = Awaited<ReturnType<typeof registrarCliente>>['agente'];

async function alerta(cliente: { agente: Agente }, tracking: string) {
  const r = await cliente.agente.post('/api/envios').send({ trackings: [tracking], tienda: 'Shein', valoresUsd: [20] });
  return { envioId: r.body.envio.id as string, paqueteId: r.body.envio.paquetes[0].id as string };
}

async function pagoEnRevision(operador: Agente, cliente: Awaited<ReturnType<typeof registrarCliente>>) {
  const tracking = `ENV-${Math.floor(Math.random() * 1e9)}`;
  const a = await alerta(cliente, tracking);
  await operador.post('/api/staff/escaneo').send({ texto: tracking });
  const consolidado = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [a.paqueteId], modalidad: 'M1', transportista: 'MRW' });
  const envioId = consolidado.body.envio.id as string;
  const cotizado = await operador.post(`/api/staff/envios/${envioId}/cotizar`).send({ pesoKg: 3 });
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

describe('lista de envíos paginada en el servidor (RF-149 a RF-151, RF-161)', () => {
  it('caso feliz: con 25 envíos y páginas de 10 la tercera trae 5, el total dice 25 y no hay tope', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    for (let i = 0; i < 25; i += 1) await alerta(cliente, `PAG-${i}-${Math.floor(Math.random() * 1e6)}`);
    const tercera = await operador.agente.get('/api/staff/envios/lista?porPagina=10&pagina=3');
    expect(tercera.status).toBe(200);
    expect(tercera.body).toMatchObject({ total: 25, pagina: 3, porPagina: 10, paginas: 3 });
    expect(tercera.body.envios).toHaveLength(5);
    const primera = await operador.agente.get('/api/staff/envios/lista?porPagina=10&pagina=1');
    const ids = new Set([...primera.body.envios, ...(await operador.agente.get('/api/staff/envios/lista?porPagina=10&pagina=2')).body.envios, ...tercera.body.envios].map((e: { id: string }) => e.id));
    expect(ids.size).toBe(25);
  });

  it('caso feliz: por defecto va del más reciente al más antiguo, y «ANTIGUO» lo invierte', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    for (let i = 0; i < 4; i += 1) await alerta(cliente, `ORD-${i}-${Math.floor(Math.random() * 1e6)}`);
    const fechas = (lista: Array<{ creadoEn: string }>) => lista.map((e) => new Date(e.creadoEn).getTime());
    const reciente = fechas((await operador.agente.get('/api/staff/envios/lista')).body.envios);
    const antiguo = fechas((await operador.agente.get('/api/staff/envios/lista?orden=ANTIGUO')).body.envios);
    expect([...reciente].sort((a, b) => b - a)).toEqual(reciente);
    expect([...antiguo].sort((a, b) => a - b)).toEqual(antiguo);
  });

  it('límite: «Activos» oculta los entregados; un estado concreto o «Todos» sí los muestran', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const viva = await alerta(cliente, `VIVA-${Math.floor(Math.random() * 1e6)}`);
    const entregada = await alerta(cliente, `ENTR-${Math.floor(Math.random() * 1e6)}`);
    await entorno.contexto.repos.envios.actualizar(entregada.envioId, { estado: 'CERRADO' });
    const idsDe = async (consulta: string) => ((await operador.agente.get(`/api/staff/envios/lista${consulta}`)).body.envios as Array<{ id: string }>).map((e) => e.id);
    expect(await idsDe('')).toEqual([viva.envioId]);
    expect(await idsDe('?estado=CERRADO')).toEqual([entregada.envioId]);
    expect(await idsDe('?estado=TODOS')).toHaveLength(2);
  });

  it('límite: una página fuera de rango devuelve la última y una lista vacía devuelve una sola página', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const vacia = await operador.agente.get('/api/staff/envios/lista?pagina=9');
    expect(vacia.body).toMatchObject({ total: 0, pagina: 1, paginas: 1, envios: [] });
  });

  it('error: un estado inventado o un tamaño de página absurdo se rechazan, y un cliente no entra', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    expect((await operador.agente.get('/api/staff/envios/lista?estado=INVENTADO')).status).toBe(400);
    expect((await operador.agente.get('/api/staff/envios/lista?porPagina=5000')).status).toBe(400);
    const cliente = await registrarCliente(entorno);
    expect((await cliente.agente.get('/api/staff/envios/lista')).status).toBe(403);
  });
});

describe('descargar CSV (RF-152, RF-159)', () => {
  it('caso feliz: el CSV de envíos trae todas las filas del filtro, con encabezado y sin cédula ni teléfono', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno, { nombre: 'Marta Exportada' });
    for (let i = 0; i < 12; i += 1) await alerta(cliente, `CSV-${i}-${Math.floor(Math.random() * 1e6)}`);
    const r = await operador.agente.get('/api/staff/envios/exportar.csv');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toMatch(/attachment; filename="envios-\d{4}-\d{2}-\d{2}\.csv"/);
    const texto = r.text.replace(/^﻿/, '');
    const lineas = texto.trim().split('\r\n');
    expect(lineas[0]).toBe('Envío;Tipo;Cliente;Casillero;Estado;Paquetes;Trackings;Transportista;Total USD;Creado (UTC);Actualizado (UTC)');
    expect(lineas).toHaveLength(13);
    expect(lineas[1]).toContain('Marta Exportada');
    expect(texto).not.toMatch(/cédula|cedula/i);
  });

  it('límite: el CSV de la bodega respeta el filtro de días y trae los días en bodega', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const vieja = await alerta(cliente, `VIEJO-${Math.floor(Math.random() * 1e6)}`);
    const nueva = await alerta(cliente, `NUEVO-${Math.floor(Math.random() * 1e6)}`);
    for (const a of [vieja, nueva]) {
      const guardada = await entorno.contexto.repos.envios.porId(a.envioId);
      await operador.agente.post('/api/staff/escaneo').send({ texto: guardada!.paquetes[0]!.trackingTexto });
    }
    await entorno.contexto.repos.envios.actualizarPaquete(vieja.paqueteId, { recibidoEn: new Date(Date.now() - 20 * 86_400_000) });
    const filtrados = await operador.agente.get('/api/staff/bodega?minDias=15');
    expect(filtrados.body.paquetes).toHaveLength(1);
    expect(filtrados.body.paquetes[0]).toMatchObject({ paqueteId: vieja.paqueteId, diasEnBodega: 20, avisado: false });
    const csv = await operador.agente.get('/api/staff/bodega/exportar.csv?minDias=15');
    const lineas = csv.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lineas).toHaveLength(2);
    expect(lineas[1]).toContain(';20;');
  });

  it('error: un cliente no puede descargar ninguno de los dos CSV', async () => {
    const cliente = await registrarCliente(entorno);
    expect((await cliente.agente.get('/api/staff/envios/exportar.csv')).status).toBe(403);
    expect((await cliente.agente.get('/api/staff/bodega/exportar.csv')).status).toBe(403);
  });
});

describe('acciones en lote de la bodega (RF-157, RF-158, RF-160)', () => {
  it('caso feliz: marcar varios como avisados los cambia todos y «Sin avisar» deja de mostrarlos', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const trackings = [`AVI-1-${Math.floor(Math.random() * 1e6)}`, `AVI-2-${Math.floor(Math.random() * 1e6)}`];
    const ids: string[] = [];
    for (const t of trackings) {
      ids.push((await alerta(cliente, t)).paqueteId);
      await operador.agente.post('/api/staff/escaneo').send({ texto: t });
    }
    expect((await operador.agente.get('/api/staff/bodega?sinAvisar=1')).body.paquetes).toHaveLength(2);
    const r = await operador.agente.post('/api/staff/paquetes/avisados-lote').send({ ids });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ exitosos: ids, fallidos: [] });
    expect((await operador.agente.get('/api/staff/bodega?sinAvisar=1')).body.paquetes).toHaveLength(0);
  });

  it('caso feliz: asignar varios paquetes sin dueño a un cliente los pasa todos a su cuenta', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno, { nombre: 'Dueña Nueva' });
    const ids: string[] = [];
    for (const t of [`SIN-1-${Math.floor(Math.random() * 1e6)}`, `SIN-2-${Math.floor(Math.random() * 1e6)}`]) {
      const r = await operador.agente.post('/api/staff/sin-prealerta').send({ texto: t });
      ids.push(r.body.envio.paquetes[0].id);
    }
    expect((await operador.agente.get('/api/staff/bodega?sinDueno=1')).body.paquetes).toHaveLength(2);
    const r = await operador.agente.post('/api/staff/paquetes/asignar-lote').send({ ids, clienteId: cliente.usuario.id });
    expect(r.status).toBe(200);
    expect(r.body.exitosos).toEqual(ids);
    expect(r.body.fallidos).toEqual([]);
    expect((await operador.agente.get('/api/staff/bodega?sinDueno=1')).body.paquetes).toHaveLength(0);
  });

  it('límite: el mismo paquete repetido se cuenta una vez', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const t = `REP-${Math.floor(Math.random() * 1e6)}`;
    const a = await alerta(cliente, t);
    await operador.agente.post('/api/staff/escaneo').send({ texto: t });
    const r = await operador.agente.post('/api/staff/paquetes/avisados-lote').send({ ids: [a.paqueteId, a.paqueteId] });
    expect(r.body.exitosos).toEqual([a.paqueteId]);
  });

  it('error: un paquete que no existe falla con su motivo y los demás se procesan', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const t = `MIX-${Math.floor(Math.random() * 1e6)}`;
    const a = await alerta(cliente, t);
    await operador.agente.post('/api/staff/escaneo').send({ texto: t });
    const r = await operador.agente.post('/api/staff/paquetes/avisados-lote').send({ ids: ['no-existe', a.paqueteId] });
    expect(r.status).toBe(200);
    expect(r.body.exitosos).toEqual([a.paqueteId]);
    expect(r.body.fallidos).toHaveLength(1);
    expect(r.body.fallidos[0].id).toBe('no-existe');
    expect(typeof r.body.fallidos[0].motivo).toBe('string');
  });

  it('error: más de 100 paquetes, un lote vacío o un cliente se rechazan', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const demasiados = Array.from({ length: 101 }, (_, i) => `p-${i}`);
    expect((await operador.agente.post('/api/staff/paquetes/avisados-lote').send({ ids: demasiados })).status).toBe(400);
    expect((await operador.agente.post('/api/staff/paquetes/avisados-lote').send({ ids: [] })).status).toBe(400);
    expect((await operador.agente.post('/api/staff/paquetes/asignar-lote').send({ ids: demasiados, clienteId: 'x' })).status).toBe(400);
    const cliente = await registrarCliente(entorno);
    expect((await cliente.agente.post('/api/staff/paquetes/avisados-lote').send({ ids: ['x'] })).status).toBe(403);
  });
});

describe('despachar varios envíos pagados (RF-154, RF-160)', () => {
  it('caso feliz: despacha los envíos pagados con su guía y deja pasar uno que no está pagado con su motivo', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const uno = await pagoEnRevision(operador.agente, await registrarCliente(entorno, { nombre: 'Despacho Uno' }));
    const dos = await pagoEnRevision(operador.agente, await registrarCliente(entorno, { nombre: 'Despacho Dos' }));
    const sinPagar = await pagoEnRevision(operador.agente, await registrarCliente(entorno, { nombre: 'Despacho Tres' }));
    await operador.agente.post(`/api/staff/pagos/${uno.pagoId}/confirmar`);
    await operador.agente.post(`/api/staff/pagos/${dos.pagoId}/confirmar`);
    const r = await operador.agente.post('/api/staff/envios/despachar-lote').send({
      items: [
        { envioId: uno.envioId, guia: 'MRW-111222' },
        { envioId: dos.envioId, guia: 'MRW-333444' },
        { envioId: sinPagar.envioId, guia: 'MRW-555666' },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.exitosos).toEqual([uno.envioId, dos.envioId]);
    expect(r.body.fallidos).toHaveLength(1);
    expect(r.body.fallidos[0].id).toBe(sinPagar.envioId);
    const despachados = (await operador.agente.get('/api/staff/envios/lista?estado=DESPACHADO')).body.envios as Array<{ id: string; guia: { numero: string } }>;
    expect(despachados.map((e) => e.guia.numero).sort()).toEqual(['MRW-111222', 'MRW-333444']);
  });

  it('error: una guía vacía o demasiado corta falla en ese envío sin frenar a los demás', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const uno = await pagoEnRevision(operador.agente, await registrarCliente(entorno, { nombre: 'Guía Uno' }));
    const dos = await pagoEnRevision(operador.agente, await registrarCliente(entorno, { nombre: 'Guía Dos' }));
    await operador.agente.post(`/api/staff/pagos/${uno.pagoId}/confirmar`);
    await operador.agente.post(`/api/staff/pagos/${dos.pagoId}/confirmar`);
    const r = await operador.agente.post('/api/staff/envios/despachar-lote').send({ items: [{ envioId: uno.envioId, guia: '' }, { envioId: dos.envioId, guia: 'MRW-777888' }] });
    expect(r.body.exitosos).toEqual([dos.envioId]);
    expect(r.body.fallidos).toEqual([{ id: uno.envioId, motivo: 'Sube la foto de la guía o escribe su número.' }]);
  });

  it('error: más de 50 envíos, un lote vacío o un cliente se rechazan', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const demasiados = Array.from({ length: 51 }, (_, i) => ({ envioId: `e-${i}`, guia: 'MRW-111222' }));
    expect((await operador.agente.post('/api/staff/envios/despachar-lote').send({ items: demasiados })).status).toBe(400);
    expect((await operador.agente.post('/api/staff/envios/despachar-lote').send({ items: [] })).status).toBe(400);
    const cliente = await registrarCliente(entorno);
    expect((await cliente.agente.post('/api/staff/envios/despachar-lote').send({ items: [{ envioId: 'x', guia: 'MRW-111222' }] })).status).toBe(403);
  });
});
