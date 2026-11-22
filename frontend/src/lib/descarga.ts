import { urlArchivo } from './api';
import { crearRegistro } from './registro';

const registro = crearRegistro('descarga');

export type TipoFoto = 'paquete' | 'guia' | 'comprobante';

const EXTENSIONES_CONOCIDAS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const LARGO_MAXIMO_REFERENCIA = 60;
const PATRON_NOMBRE_VALIDO = /^[a-z]+-[A-Za-z0-9-]+\.[a-z0-9]+$/;
const ESPERA_LIBERAR_MS = 1000;

export function limpiarReferencia(texto: string): string {
  if (typeof texto !== 'string') throw new Error('La referencia de la foto debe ser texto.');
  const limpia = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LARGO_MAXIMO_REFERENCIA)
    .replace(/-+$/g, '');
  if (!limpia) throw new Error('La referencia de la foto no tiene letras ni números.');
  return limpia;
}

function extensionDe(tipoMime: string): string {
  if (!tipoMime.startsWith('image/')) throw new Error('El archivo descargado no es una imagen.');
  const conocida = EXTENSIONES_CONOCIDAS[tipoMime];
  if (conocida) return conocida;
  const subtipo = tipoMime.slice('image/'.length).replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!subtipo) throw new Error('No se pudo saber el tipo de imagen.');
  return subtipo;
}

export function nombreArchivoFoto(tipo: TipoFoto, referencia: string, tipoMime: string): string {
  const nombre = `${tipo}-${limpiarReferencia(referencia)}.${extensionDe(tipoMime)}`;
  if (!PATRON_NOMBRE_VALIDO.test(nombre)) throw new Error('El nombre de la foto no es válido.');
  return nombre;
}

export async function guardarFotoEnDispositivo(ruta: string | null, tipo: TipoFoto, referencia: string): Promise<string> {
  const url = urlArchivo(ruta);
  if (!url) throw new Error('No hay foto para descargar.');
  registro.info('Descargando foto', { tipo });
  let respuesta: Response;
  try {
    respuesta = await fetch(url, { credentials: 'same-origin' });
  } catch {
    registro.error('No hubo conexión para descargar la foto', { tipo });
    throw new Error('No pudimos descargar la foto. Revisa tu conexión e intenta de nuevo.');
  }
  if (!respuesta.ok) {
    registro.error('El servidor no entregó la foto', { tipo, estado: respuesta.status });
    throw new Error('No pudimos descargar la foto. Intenta de nuevo.');
  }
  const imagen = await respuesta.blob();
  const nombre = nombreArchivoFoto(tipo, referencia, imagen.type);
  const direccion = URL.createObjectURL(imagen);
  const enlace = document.createElement('a');
  enlace.href = direccion;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(direccion), ESPERA_LIBERAR_MS);
  registro.info('Foto descargada', { tipo });
  return nombre;
}
