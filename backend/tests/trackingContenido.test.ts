import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';
import { candidatosDeContenido, codigoContieneTracking } from '../src/domain/tracking';

const CODIGO_BARRAS_COORDINADORA = '701234567890001';
const CODIGO_QR_COORDINADORA = '70060011200013600101234567890001';
const NUMERO_IMPRESO_COORDINADORA = '01234567890.1';

describe('el código leído contiene el tracking de la prealerta', () => {
  it('caso feliz: el código de barras y el QR de Coordinadora coinciden con el número impreso', () => {
    expect(codigoContieneTracking(CODIGO_BARRAS_COORDINADORA, NUMERO_IMPRESO_COORDINADORA)).toBe(true);
    expect(codigoContieneTracking(CODIGO_QR_COORDINADORA, NUMERO_IMPRESO_COORDINADORA)).toBe(true);
  });

  it('caso feliz: un tracking normal contenido dentro de un código más largo coincide', () => {
    expect(codigoContieneTracking('XX2600000000123456YY', '2600000000123456')).toBe(true);
  });

  it('límite: un tracking de menos de 8 caracteres nunca coincide por contenido', () => {
    expect(codigoContieneTracking('123456789012', '1234567')).toBe(false);
    expect(candidatosDeContenido('1234567')).toEqual([]);
  });

  it('límite: el número impreso con otra pieza no coincide con el código de la pieza 1', () => {
    expect(codigoContieneTracking(CODIGO_BARRAS_COORDINADORA, '01234567890.2')).toBe(false);
  });

  it('error: un número distinto no coincide', () => {
    expect(codigoContieneTracking(CODIGO_BARRAS_COORDINADORA, '9999999999')).toBe(false);
  });

  it('error: un texto demasiado corto falla con mensaje claro', () => {
    expect(() => codigoContieneTracking('ab', NUMERO_IMPRESO_COORDINADORA)).toThrow('El tracking es demasiado corto.');
  });
});

describe('escaneo de paquetes con código más largo que la prealerta', () => {
  let entorno: Entorno;

  beforeEach(async () => {
    entorno = await crearEntorno();
  });

  async function prealertar(trackings: string[]) {
    const cliente = await registrarCliente(entorno);
    const respuesta = await cliente.agente.post('/api/envios').send({ trackings, tienda: 'Tienda', valorDeclaradoUsd: 30, modalidad: 'M1', transportista: 'MRW' });
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(201);
    return respuesta.body.envio as { id: string };
  }

  it('caso feliz: escanear el código de barras de Coordinadora recibe el paquete prealertado con el número impreso', async () => {
    const envio = await prealertar([NUMERO_IMPRESO_COORDINADORA]);
    const { agente } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const respuesta = await agente.post('/api/staff/escaneo').send({ texto: CODIGO_BARRAS_COORDINADORA });
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    expect(respuesta.body.resultado).toBe('RECIBIDO');
    expect(respuesta.body.envioId).toBe(envio.id);
  });

  it('límite: si ningún paquete esperado coincide, queda como sin prealerta', async () => {
    await prealertar(['ABCDEFGH1234']);
    const { agente } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const respuesta = await agente.post('/api/staff/escaneo').send({ texto: CODIGO_BARRAS_COORDINADORA });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.resultado).toBe('SIN_PREALERTA');
  });

  it('error: si el código coincide con dos paquetes esperados no marca ninguno y pide el número completo', async () => {
    await prealertar(['91234567890']);
    await prealertar(['1234567890010']);
    const { agente } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const respuesta = await agente.post('/api/staff/escaneo').send({ texto: '91234567890010' });
    expect(respuesta.status).toBe(409);
    expect(JSON.stringify(respuesta.body)).toContain('más de un paquete');
  });
});
