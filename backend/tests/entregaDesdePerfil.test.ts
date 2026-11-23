import { beforeEach, describe, expect, it } from 'vitest';
import { cargarDatosDePrueba, leerFixtureDatosPrueba } from '../src/services/DatosPrueba';
import { ENTREGA_PERFIL_PRUEBA, PNG_MINIMO, crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

const ENTREGA_VACIA = { nombreCifrado: null, cedulaCifrada: null, telefonoCifrado: null, agencia: null, ciudad: null, estado: null };

beforeEach(async () => {
  entorno = await crearEntorno();
});

async function envioPorPagar(operador: Awaited<ReturnType<typeof crearPersonalYEntrar>>['agente'], cliente: Awaited<ReturnType<typeof registrarCliente>>, transportista: 'MRW' | 'ZOOM' = 'MRW') {
  const tracking = `ENT-${Math.floor(Math.random() * 1e9)}`;
  const alerta = await cliente.agente.post('/api/envios').send({ trackings: [tracking], tienda: 'Shein', valoresUsd: [20] });
  await operador.post('/api/staff/escaneo').send({ texto: tracking });
  const consolidado = await operador.post('/api/envios/consolidar').send({ clienteId: cliente.usuario.id, paqueteIds: [alerta.body.envio.paquetes[0].id], modalidad: 'M1', transportista });
  const envioId = consolidado.body.envio.id as string;
  const cotizado = await operador.post(`/api/staff/envios/${envioId}/cotizar`).send({ pesoKg: 3 });
  return { envioId, totalUsd: (cotizado.body.envio.precio.totalCentavos as number) / 100 };
}

async function pagarYConfirmar(operador: Awaited<ReturnType<typeof crearPersonalYEntrar>>['agente'], cliente: Awaited<ReturnType<typeof registrarCliente>>, envioId: string, totalUsd: number) {
  const pago = await cliente.agente
    .post(`/api/envios/${envioId}/pagos`)
    .field('metodo', 'BINANCE')
    .field('moneda', 'USD')
    .field('monto', totalUsd.toFixed(2))
    .field('referencia', `REF${Math.floor(Math.random() * 1e9)}`)
    .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
  return operador.post(`/api/staff/pagos/${pago.body.envio.pagos[0].id}/confirmar`);
}

describe('los datos de entrega vienen del perfil del cliente (RF-166, RF-168)', () => {
  it('caso feliz: al confirmar el pago, un envío sin datos de entrega los recibe del perfil y queda anotado', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno, { nombre: 'Rosa Prueba' });
    const { envioId, totalUsd } = await envioPorPagar(operador.agente, cliente);
    await entorno.contexto.repos.envios.actualizar(envioId, { entrega: ENTREGA_VACIA });
    const confirmado = await pagarYConfirmar(operador.agente, cliente, envioId, totalUsd);
    expect(confirmado.status).toBe(200);
    expect(confirmado.body.envio.estado).toBe('PAGADO');
    expect(confirmado.body.envio.entrega).toMatchObject({ nombre: 'Rosa Prueba', agencia: ENTREGA_PERFIL_PRUEBA.MRW.agencia, ciudad: ENTREGA_PERFIL_PRUEBA.MRW.ciudad, estado: ENTREGA_PERFIL_PRUEBA.MRW.estado });
    const historial = await operador.agente.get(`/api/staff/envios/${envioId}/historial`);
    expect(JSON.stringify(historial.body.eventos)).toContain('Datos de entrega completados con el perfil del cliente');
  });

  it('caso feliz: usa el destino de la transportista elegida, Zoom en lugar de MRW', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const { envioId, totalUsd } = await envioPorPagar(operador.agente, cliente, 'ZOOM');
    await entorno.contexto.repos.envios.actualizar(envioId, { entrega: ENTREGA_VACIA });
    const confirmado = await pagarYConfirmar(operador.agente, cliente, envioId, totalUsd);
    expect(confirmado.body.envio.entrega.agencia).toBe(ENTREGA_PERFIL_PRUEBA.ZOOM.agencia);
  });

  it('límite: no sobrescribe los datos que el personal ya escribió', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const { envioId, totalUsd } = await envioPorPagar(operador.agente, cliente);
    await entorno.contexto.repos.envios.actualizar(envioId, { entrega: { ...ENTREGA_VACIA, agencia: 'MRW Agencia Escrita Por El Operador' } });
    const confirmado = await pagarYConfirmar(operador.agente, cliente, envioId, totalUsd);
    expect(confirmado.body.envio.entrega.agencia).toBe('MRW Agencia Escrita Por El Operador');
    expect(confirmado.body.envio.entrega.ciudad).toBeNull();
  });

  it('error: si el perfil del cliente no tiene el destino, el pago se confirma igual y la entrega sigue vacía', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno, {}, { conPerfil: false });
    const { envioId, totalUsd } = await envioPorPagar(operador.agente, cliente);
    const confirmado = await pagarYConfirmar(operador.agente, cliente, envioId, totalUsd);
    expect(confirmado.status).toBe(200);
    expect(confirmado.body.envio.estado).toBe('PAGADO');
    expect(confirmado.body.envio.entrega.agencia).toBeNull();
  });

  it('caso feliz: el operador puede copiar el perfil con un toque cuando faltan los datos', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);
    const { envioId } = await envioPorPagar(operador.agente, cliente);
    await entorno.contexto.repos.envios.actualizar(envioId, { entrega: ENTREGA_VACIA });
    const r = await operador.agente.post(`/api/envios/${envioId}/entrega/perfil`);
    expect(r.status).toBe(200);
    expect(r.body.envio.entrega.agencia).toBe(ENTREGA_PERFIL_PRUEBA.MRW.agencia);
  });

  it('error: copiar el perfil de un cliente que no lo tiene da un mensaje claro', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno, {}, { conPerfil: false });
    const { envioId } = await envioPorPagar(operador.agente, cliente);
    const r = await operador.agente.post(`/api/envios/${envioId}/entrega/perfil`);
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('PERFIL_INCOMPLETO');
  });
});

describe('envíos de los datos de prueba (RF-168)', () => {
  it('caso feliz: los consolidados precargados de Rosa traen la agencia, ciudad y estado de su perfil', async () => {
    await cargarDatosDePrueba(entorno.contexto, leerFixtureDatosPrueba());
    const rosa = await entorno.contexto.repos.usuarios.porEmail('rosa.prueba3@ejemplo.com', 'CLIENTE');
    const consolidados = (await entorno.contexto.repos.envios.listar({ clienteId: rosa!.id })).filter((e) => e.tipo === 'CONSOLIDADO');
    expect(consolidados.length).toBeGreaterThan(0);
    for (const envio of consolidados) {
      expect(envio.entrega.agencia, `agencia del consolidado ${envio.numero}`).toBeTruthy();
      expect(envio.entrega.ciudad).toBeTruthy();
      expect(envio.entrega.estado).toBeTruthy();
      expect(envio.entrega.nombreCifrado).toBeTruthy();
    }
  });

  it('límite: todos los consolidados de todos los clientes de prueba traen su entrega, no solo los de Rosa', async () => {
    await cargarDatosDePrueba(entorno.contexto, leerFixtureDatosPrueba());
    const todos = (await entorno.contexto.repos.envios.listar({})).filter((e) => e.tipo === 'CONSOLIDADO');
    expect(todos.length).toBeGreaterThan(5);
    expect(todos.filter((e) => !e.entrega.agencia)).toEqual([]);
  });
});
