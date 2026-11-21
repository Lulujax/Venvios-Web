import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi, api, mensajeDeError, urlArchivo } from '../src/lib/api';
import { aNumero, formatearBs, formatearKg, formatearUsd, pasoActual, primerNombre } from '../src/lib/formato';
import {
  validarCedula,
  validarContrasena,
  validarMonto,
  validarNombre,
  validarReferencia,
  validarTelefono,
  validarTracking,
} from '../src/lib/validar';
import { aceptarLectura, describirErrorCamara } from '../src/components/Escaner';
import { enlaceRastreo } from '../src/lib/whatsapp';

afterEach(() => vi.restoreAllMocks());

describe('formato', () => {
  it('caso feliz: dinero y peso con dos decimales', () => {
    expect(formatearUsd(4433)).toContain('44');
    expect(formatearUsd(4433)).toContain('$');
    expect(formatearBs(412345)).toContain('Bs');
    expect(formatearKg(4.35)).toContain('kg');
  });

  it('límite: cero y valores ausentes', () => {
    expect(formatearUsd(0)).toContain('0');
    expect(formatearUsd(null)).toBe('—');
    expect(formatearKg(undefined)).toBe('—');
    expect(formatearBs(Number.NaN)).toBe('—');
  });

  it('acepta coma decimal y devuelve NaN si no es número', () => {
    expect(aNumero('4,35')).toBe(4.35);
    expect(aNumero(' 12.5 ')).toBe(12.5);
    expect(Number.isNaN(aNumero('abc'))).toBe(true);
  });

  it('pasos del envío y primer nombre', () => {
    expect(pasoActual('POR_CONSOLIDAR')).toBe(0);
    expect(pasoActual('POR_PAGAR')).toBe(1);
    expect(pasoActual('DESPACHADO')).toBe(4);
    expect(pasoActual('CANCELADO')).toBe(-1);
    expect(pasoActual('PREALERTADO')).toBe(-1);
    expect(primerNombre('  María Fernanda Rangel ')).toBe('María');
  });
});

describe('validaciones del formulario', () => {
  it('cédula: válida, límite y error', () => {
    expect(validarCedula('V-12.345.678')).toBeNull();
    expect(validarCedula('12345')).toBeNull();
    expect(validarCedula('1234')).not.toBeNull();
    expect(validarCedula('')).not.toBeNull();
  });

  it('teléfono con código de país', () => {
    expect(validarTelefono('584141234567')).toBeNull();
    expect(validarTelefono('3001234567')).toBeNull();
    expect(validarTelefono('12345')).not.toBeNull();
  });

  it('nombre, contraseña, monto, referencia y tracking', () => {
    expect(validarNombre('Luis Peña')).toBeNull();
    expect(validarNombre('Luis')).not.toBeNull();
    expect(validarContrasena('Clave2026!')).toBeNull();
    expect(validarContrasena('12345678')).not.toBeNull();
    expect(validarMonto('44,33')).toBeNull();
    expect(validarMonto('0')).not.toBeNull();
    expect(validarMonto('abc')).not.toBeNull();
    expect(validarReferencia('123456')).toBeNull();
    expect(validarReferencia('123456789012')).toBeNull();
    expect(validarReferencia('12345')).not.toBeNull();
    expect(validarReferencia('1234567890123')).not.toBeNull();
    expect(validarReferencia('BIN-12')).not.toBeNull();
    expect(validarReferencia('4F9A2B7C1D', 'BINANCE')).toBeNull();
    expect(validarReferencia('A', 'BINANCE')).toBeNull();
    expect(validarReferencia('A'.repeat(200), 'BINANCE')).toBeNull();
    expect(validarReferencia('', 'BINANCE')).not.toBeNull();
    expect(validarReferencia('BIN-12345678', 'BINANCE')).not.toBeNull();
    expect(validarTracking('XC-0001')).toBeNull();
    expect(validarTracking('--')).not.toBeNull();
  });
});

describe('cliente de la API', () => {
  function simularRespuesta(estado: number, cuerpo: unknown) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: estado })));
  }

  it('caso feliz: devuelve el JSON', async () => {
    simularRespuesta(200, { ok: true });
    await expect(api.get('/salud')).resolves.toEqual({ ok: true });
  });

  it('error: traduce el mensaje y los datos que manda el servidor', async () => {
    simularRespuesta(409, { error: { mensaje: 'Ese tracking ya está registrado.', codigo: 'CONFLICTO', datos: { envioId: 'e1' } } });
    const error = (await api.post('/envios', {}).catch((e) => e)) as ErrorApi;
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.estado).toBe(409);
    expect(error.datos).toEqual({ envioId: 'e1' });
    expect(mensajeDeError(error)).toBe('Ese tracking ya está registrado.');
  });

  it('error: sin conexión da un mensaje claro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fallo'); }));
    const error = (await api.get('/salud').catch((e) => e)) as ErrorApi;
    expect(error.codigo).toBe('SIN_CONEXION');
    expect(error.message).toContain('conexión');
  });

  it('límite: respuesta no JSON usa el mensaje genérico', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })));
    const error = (await api.get('/x').catch((e) => e)) as ErrorApi;
    expect(error.message).toContain('Algo salió mal');
  });

  it('ruta de archivos privados', () => {
    expect(urlArchivo('comprobantes/e1/a.jpg')).toBe('/api/archivos/comprobantes/e1/a.jpg');
    expect(urlArchivo(null)).toBeNull();
  });
});

describe('escáner y rastreo', () => {
  it('ignora la misma lectura repetida dentro de la ventana', () => {
    expect(aceptarLectura(null, 'XC123456', 1000)).toBe(true);
    expect(aceptarLectura({ texto: 'XC123456', hora: 1000 }, 'XC123456', 2000)).toBe(false);
    expect(aceptarLectura({ texto: 'XC123456', hora: 1000 }, 'XC123456', 4000)).toBe(true);
    expect(aceptarLectura({ texto: 'XC123456', hora: 1000 }, 'OTRO9999', 1200)).toBe(true);
    expect(aceptarLectura(null, '   ', 1000)).toBe(false);
  });

  it('explica por qué falla la cámara', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const permiso = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    const sinCamara = Object.assign(new Error('x'), { name: 'NotFoundError' });
    expect(describirErrorCamara(permiso)).toContain('permiso');
    expect(describirErrorCamara(sinCamara)).toContain('cámara');
    expect(describirErrorCamara(new Error('raro'))).toContain('a mano');
  });

  it('error: en una página sin candado lo dice primero', () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    expect(describirErrorCamara(new Error('x'))).toContain('candado');
  });

  it('enlace de rastreo con y sin parámetro de guía', () => {
    expect(enlaceRastreo('https://mrwve.com', null, 'ABC123')).toBe('https://mrwve.com');
    expect(enlaceRastreo('https://x.com/track', 'guia', 'A B')).toBe('https://x.com/track?guia=A%20B');
    expect(enlaceRastreo('https://x.com/t?a=1', 'g', '9')).toBe('https://x.com/t?a=1&g=9');
  });
});
