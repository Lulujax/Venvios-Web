import { readFileSync } from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import {
  OPCIONES_LECTURA,
  combinarLectores,
  crearLector,
  crearLectorNativo,
  crearLectorWasm,
  unicos,
  type ConstructorDetectorNativo,
  type LectorCodigos,
  type LeerWasm,
} from '../src/lib/lectorCodigos';

function imagenDeQr(texto: string, escala = 8, margen = 4): ImageData {
  const qr = QRCode.create(texto, { errorCorrectionLevel: 'M' });
  const lado = qr.modules.size;
  const total = (lado + margen * 2) * escala;
  const datos = new Uint8ClampedArray(total * total * 4).fill(255);
  for (let fila = 0; fila < lado; fila += 1) {
    for (let columna = 0; columna < lado; columna += 1) {
      if (!qr.modules.get(fila, columna)) continue;
      for (let y = 0; y < escala; y += 1) {
        for (let x = 0; x < escala; x += 1) {
          const posicion = (((fila + margen) * escala + y) * total + (columna + margen) * escala + x) * 4;
          datos[posicion] = 0;
          datos[posicion + 1] = 0;
          datos[posicion + 2] = 0;
        }
      }
    }
  }
  return { data: datos, width: total, height: total, colorSpace: 'srgb' } as ImageData;
}

function imagenEnBlanco(lado = 200): ImageData {
  return { data: new Uint8ClampedArray(lado * lado * 4).fill(255), width: lado, height: lado, colorSpace: 'srgb' } as ImageData;
}

let leerWasmDePrueba: LeerWasm;

beforeAll(async () => {
  const binario = readFileSync(path.resolve(__dirname, '../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'));
  await prepareZXingModule({ overrides: { wasmBinary: binario }, fireImmediately: true });
  leerWasmDePrueba = (entrada) => readBarcodes(entrada, OPCIONES_LECTURA);
});

const VIDEO_FALSO = {} as HTMLVideoElement;
const IMAGEN_FALSA = new Blob(['x'], { type: 'image/png' });

function lectorFalso(nombre: string, comportamiento: Partial<LectorCodigos> = {}): LectorCodigos {
  return {
    nombre,
    leerCuadro: vi.fn().mockResolvedValue([]),
    leerImagen: vi.fn().mockResolvedValue([]),
    ...comportamiento,
  };
}

describe('unicos', () => {
  it('caso feliz: quita espacios y repetidos conservando el orden', () => {
    expect(unicos([' A1 ', 'A1', 'B2'])).toEqual(['A1', 'B2']);
  });

  it('límite: lista vacía y textos vacíos no dejan nada', () => {
    expect(unicos([])).toEqual([]);
    expect(unicos(['', '   '])).toEqual([]);
  });

  it('error: valores que no son texto se descartan', () => {
    expect(unicos([null as unknown as string, 'OK1234'])).toEqual(['OK1234']);
  });
});

describe('lector nativo', () => {
  function constructorFalso(formatosSoportados: string[], deteccion: Array<{ rawValue: string }>) {
    const opcionesRecibidas: Array<{ formats?: string[] } | undefined> = [];
    class DetectorFalso {
      constructor(opciones?: { formats?: string[] }) {
        opcionesRecibidas.push(opciones);
      }
      detect = vi.fn().mockResolvedValue(deteccion);
      static getSupportedFormats = vi.fn().mockResolvedValue(formatosSoportados);
    }
    return { Constructor: DetectorFalso as unknown as ConstructorDetectorNativo, opcionesRecibidas };
  }

  it('caso feliz: pide solo los formatos que el navegador soporta y devuelve textos únicos', async () => {
    const { Constructor, opcionesRecibidas } = constructorFalso(['qr_code', 'code_128', 'otro'], [{ rawValue: ' X1234 ' }, { rawValue: 'X1234' }]);
    const lector = await crearLectorNativo(Constructor);
    expect(opcionesRecibidas[0]?.formats).toEqual(['qr_code', 'code_128']);
    expect(await lector.leerCuadro(VIDEO_FALSO)).toEqual(['X1234']);
  });

  it('límite: sin códigos en la imagen devuelve lista vacía', async () => {
    const { Constructor } = constructorFalso(['qr_code'], []);
    const lector = await crearLectorNativo(Constructor);
    expect(await lector.leerCuadro(VIDEO_FALSO)).toEqual([]);
  });

  it('error: si no soporta ningún formato útil falla con mensaje claro', async () => {
    const { Constructor } = constructorFalso(['otro'], []);
    await expect(crearLectorNativo(Constructor)).rejects.toThrow('El lector nativo no soporta ningún formato útil.');
  });
});

describe('lector wasm con imágenes reales', () => {
  it('caso feliz: lee el QR de una guía normal', async () => {
    const lector = crearLectorWasm(leerWasmDePrueba, () => imagenDeQr('JTC000123456789'));
    expect(await lector.leerCuadro(VIDEO_FALSO)).toEqual(['JTC000123456789']);
  });

  it('caso feliz: lee un QR largo como el de Coordinadora', async () => {
    const texto = '70060011200013600101234567890001';
    const lector = crearLectorWasm(leerWasmDePrueba, () => imagenDeQr(texto));
    expect(await lector.leerCuadro(VIDEO_FALSO)).toEqual([texto]);
  });

  it('caso feliz: lee un QR chico (escala 3) como el de una etiqueta lejana', async () => {
    const lector = crearLectorWasm(leerWasmDePrueba, () => imagenDeQr('2600000000123456', 3));
    expect(await lector.leerCuadro(VIDEO_FALSO)).toEqual(['2600000000123456']);
  });

  it('límite: una imagen en blanco no devuelve nada', async () => {
    const lector = crearLectorWasm(leerWasmDePrueba, () => imagenEnBlanco());
    expect(await lector.leerCuadro(VIDEO_FALSO)).toEqual([]);
  });

  it('error: si la cámara aún no entrega imagen, el error llega a quien llama', async () => {
    const lector = crearLectorWasm(leerWasmDePrueba, () => {
      throw new Error('La cámara todavía no entrega imagen.');
    });
    await expect(lector.leerCuadro(VIDEO_FALSO)).rejects.toThrow('La cámara todavía no entrega imagen.');
  });
});

describe('combinar lectores', () => {
  it('caso feliz: con lector nativo disponible lo usa y no toca el de respaldo', async () => {
    const nativo = lectorFalso('nativo', { leerCuadro: vi.fn().mockResolvedValue(['NAT12345']) });
    const respaldo = lectorFalso('wasm');
    const combinado = combinarLectores(nativo, respaldo);
    expect(await combinado.leerCuadro(VIDEO_FALSO)).toEqual(['NAT12345']);
    expect(respaldo.leerCuadro).not.toHaveBeenCalled();
    expect(combinado.nombre).toBe('nativo+wasm');
  });

  it('límite: sin lector nativo se usa directamente el de respaldo', () => {
    const respaldo = lectorFalso('wasm');
    expect(combinarLectores(null, respaldo)).toBe(respaldo);
  });

  it('límite: en una foto, si el nativo no ve nada, el respaldo lo intenta', async () => {
    const nativo = lectorFalso('nativo');
    const respaldo = lectorFalso('wasm', { leerImagen: vi.fn().mockResolvedValue(['WAS12345']) });
    expect(await combinarLectores(nativo, respaldo).leerImagen(IMAGEN_FALSA)).toEqual(['WAS12345']);
  });

  it('error: si el nativo falla pasa al respaldo y no vuelve a llamar al nativo', async () => {
    const nativo = lectorFalso('nativo', { leerCuadro: vi.fn().mockRejectedValue(new Error('se cayó')) });
    const respaldo = lectorFalso('wasm', { leerCuadro: vi.fn().mockResolvedValue(['WAS12345']) });
    const combinado = combinarLectores(nativo, respaldo);
    expect(await combinado.leerCuadro(VIDEO_FALSO)).toEqual(['WAS12345']);
    expect(await combinado.leerCuadro(VIDEO_FALSO)).toEqual(['WAS12345']);
    expect(nativo.leerCuadro).toHaveBeenCalledTimes(1);
  });
});

describe('crear lector', () => {
  it('caso feliz: sin detector nativo queda solo el lector wasm', async () => {
    const lector = await crearLector({ leerWasm: leerWasmDePrueba });
    expect(lector.nombre).toBe('wasm');
  });

  it('error: si el detector nativo no sirve, sigue con el lector wasm', async () => {
    class DetectorRoto {
      static getSupportedFormats = vi.fn().mockRejectedValue(new Error('sin formatos'));
    }
    const lector = await crearLector({ Detector: DetectorRoto as unknown as ConstructorDetectorNativo, leerWasm: leerWasmDePrueba });
    expect(lector.nombre).toBe('wasm');
  });
});
