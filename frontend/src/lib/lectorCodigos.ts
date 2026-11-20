import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import urlWasm from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { crearRegistro } from './registro';

const registro = crearRegistro('lector');

export interface LectorCodigos {
  nombre: string;
  leerCuadro: (video: HTMLVideoElement) => Promise<string[]>;
  leerImagen: (imagen: Blob) => Promise<string[]>;
}

export const FORMATOS_NATIVOS = [
  'qr_code',
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'ean_13',
  'ean_8',
  'itf',
  'upc_a',
  'upc_e',
  'data_matrix',
  'pdf417',
  'aztec',
];

export const OPCIONES_LECTURA = { tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 4 };

interface DeteccionNativa {
  rawValue: string;
}

interface DetectorNativo {
  detect: (fuente: ImageBitmapSource) => Promise<DeteccionNativa[]>;
}

export interface ConstructorDetectorNativo {
  new (opciones?: { formats?: string[] }): DetectorNativo;
  getSupportedFormats?: () => Promise<string[]>;
}

export interface ResultadoWasm {
  text: string;
  isValid: boolean;
}

export type EntradaWasm = Blob | ImageData;
export type LeerWasm = (entrada: EntradaWasm) => Promise<ResultadoWasm[]>;

export interface EntornoLector {
  Detector?: ConstructorDetectorNativo;
  leerWasm: LeerWasm;
}

function motivoDe(falla: unknown): string {
  return falla instanceof Error ? falla.message : 'desconocido';
}

export function unicos(textos: string[]): string[] {
  const vistos = new Set<string>();
  for (const texto of textos) {
    const limpio = typeof texto === 'string' ? texto.trim() : '';
    if (limpio) vistos.add(limpio);
  }
  return [...vistos];
}

export async function crearLectorNativo(Constructor: ConstructorDetectorNativo): Promise<LectorCodigos> {
  const soportados = Constructor.getSupportedFormats ? await Constructor.getSupportedFormats() : [];
  const formatos = FORMATOS_NATIVOS.filter((formato) => soportados.includes(formato));
  if (formatos.length === 0) throw new Error('El lector nativo no soporta ningún formato útil.');
  const detector = new Constructor({ formats: formatos });
  registro.info('Lector nativo listo', { formatos: formatos.length });
  return {
    nombre: 'nativo',
    leerCuadro: async (video) => unicos((await detector.detect(video)).map((deteccion) => deteccion.rawValue)),
    leerImagen: async (imagen) => {
      const mapa = await createImageBitmap(imagen);
      try {
        return unicos((await detector.detect(mapa)).map((deteccion) => deteccion.rawValue));
      } finally {
        mapa.close();
      }
    },
  };
}

let lienzo: HTMLCanvasElement | null = null;

export function capturarCuadro(video: HTMLVideoElement): ImageData {
  const ancho = video.videoWidth;
  const alto = video.videoHeight;
  if (!ancho || !alto) throw new Error('La cámara todavía no entrega imagen.');
  lienzo ??= document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d', { willReadFrequently: true });
  if (!contexto) throw new Error('No se pudo preparar la imagen para leerla.');
  contexto.drawImage(video, 0, 0, ancho, alto);
  return contexto.getImageData(0, 0, ancho, alto);
}

export function crearLectorWasm(leer: LeerWasm, capturar: (video: HTMLVideoElement) => ImageData = capturarCuadro): LectorCodigos {
  const textosValidos = (resultados: ResultadoWasm[]): string[] => unicos(resultados.filter((resultado) => resultado.isValid).map((resultado) => resultado.text));
  return {
    nombre: 'wasm',
    leerCuadro: async (video) => textosValidos(await leer(capturar(video))),
    leerImagen: async (imagen) => textosValidos(await leer(imagen)),
  };
}

export function combinarLectores(nativo: LectorCodigos | null, respaldo: LectorCodigos): LectorCodigos {
  if (!nativo) return respaldo;
  let nativoSirve = true;
  const apagarNativo = (falla: unknown): void => {
    nativoSirve = false;
    registro.warn('El lector nativo falló: sigo con el de respaldo', { motivo: motivoDe(falla) });
  };
  return {
    nombre: `${nativo.nombre}+${respaldo.nombre}`,
    leerCuadro: async (video) => {
      if (nativoSirve) {
        try {
          return await nativo.leerCuadro(video);
        } catch (falla) {
          apagarNativo(falla);
        }
      }
      return respaldo.leerCuadro(video);
    },
    leerImagen: async (imagen) => {
      if (nativoSirve) {
        try {
          const textos = await nativo.leerImagen(imagen);
          if (textos.length > 0) return textos;
        } catch (falla) {
          apagarNativo(falla);
        }
      }
      return respaldo.leerImagen(imagen);
    },
  };
}

export async function crearLector(entorno: EntornoLector): Promise<LectorCodigos> {
  const respaldo = crearLectorWasm(entorno.leerWasm);
  let nativo: LectorCodigos | null = null;
  if (entorno.Detector) {
    try {
      nativo = await crearLectorNativo(entorno.Detector);
    } catch (falla) {
      registro.warn('No se pudo usar el lector nativo', { motivo: motivoDe(falla) });
    }
  } else {
    registro.info('Este navegador no trae lector nativo: uso el de respaldo');
  }
  const lector = combinarLectores(nativo, respaldo);
  registro.info('Lector elegido', { motor: lector.nombre });
  return lector;
}

function leerWasmDelNavegador(): LeerWasm {
  prepareZXingModule({
    overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith('.wasm') ? urlWasm : prefijo + ruta) },
  });
  return (entrada) => readBarcodes(entrada, OPCIONES_LECTURA);
}

let lectorEnCurso: Promise<LectorCodigos> | null = null;

export function crearLectorDelNavegador(): Promise<LectorCodigos> {
  if (!lectorEnCurso) {
    const global = window as unknown as { BarcodeDetector?: ConstructorDetectorNativo };
    lectorEnCurso = crearLector({ Detector: global.BarcodeDetector, leerWasm: leerWasmDelNavegador() }).catch((falla) => {
      lectorEnCurso = null;
      throw falla;
    });
  }
  return lectorEnCurso;
}
