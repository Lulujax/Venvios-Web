import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface ArchivoEntrada {
  buffer: Buffer;
  mime: string;
}

export interface AccesoArchivo {
  url?: string;
  buffer?: Buffer;
  mime?: string;
}

export interface Almacenamiento {
  subir(ruta: string, archivo: ArchivoEntrada): Promise<void>;
  acceso(ruta: string): Promise<AccesoArchivo>;
}

const MIMES_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES_IMAGEN = 3 * 1024 * 1024;

const EXTENSIONES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function validarImagen(archivo: ArchivoEntrada | undefined): ArchivoEntrada {
  if (!archivo || archivo.buffer.length === 0) throw AppError.badRequest('Falta la imagen.');
  if (!MIMES_IMAGEN.includes(archivo.mime)) throw AppError.badRequest('Solo se aceptan imágenes JPG, PNG o WEBP.');
  if (archivo.buffer.length > MAX_BYTES_IMAGEN) throw AppError.badRequest('La imagen pesa más de 3 MB.');
  return archivo;
}

export function rutaArchivo(carpeta: string, envioId: string, mime: string): string {
  return `${carpeta}/${envioId}/${randomUUID()}.${EXTENSIONES[mime] ?? 'jpg'}`;
}

export function envioIdDeRuta(ruta: string): string | null {
  const partes = ruta.split('/');
  return partes.length === 3 ? partes[1]! : null;
}

export class AlmacenamientoMemoria implements Almacenamiento {
  private readonly archivos = new Map<string, ArchivoEntrada>();

  async subir(ruta: string, archivo: ArchivoEntrada): Promise<void> {
    this.archivos.set(ruta, archivo);
  }

  async acceso(ruta: string): Promise<AccesoArchivo> {
    const archivo = this.archivos.get(ruta);
    if (!archivo) throw AppError.notFound('El archivo no existe.');
    return { buffer: archivo.buffer, mime: archivo.mime };
  }
}

export class AlmacenamientoSupabase implements Almacenamiento {
  constructor(
    private readonly urlBase: string,
    private readonly claveServicio: string,
    private readonly bucket: string,
  ) {
    if (!urlBase || !claveServicio || !bucket) throw new Error('Faltan SUPABASE_URL, SUPABASE_SERVICE_KEY o SUPABASE_BUCKET.');
  }

  private cabeceras(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.claveServicio}`, apikey: this.claveServicio, ...extra };
  }

  async subir(ruta: string, archivo: ArchivoEntrada): Promise<void> {
    const respuesta = await fetch(`${this.urlBase}/storage/v1/object/${this.bucket}/${ruta}`, {
      method: 'POST',
      headers: this.cabeceras({ 'Content-Type': archivo.mime, 'x-upsert': 'false' }),
      body: new Uint8Array(archivo.buffer),
    });
    if (!respuesta.ok) {
      logger.error('Falló la subida a Supabase Storage', { estado: respuesta.status });
      throw new AppError('No pudimos guardar la imagen. Intenta de nuevo.', 502, 'ALMACENAMIENTO');
    }
  }

  async acceso(ruta: string): Promise<AccesoArchivo> {
    const respuesta = await fetch(`${this.urlBase}/storage/v1/object/sign/${this.bucket}/${ruta}`, {
      method: 'POST',
      headers: this.cabeceras({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: 120 }),
    });
    if (!respuesta.ok) throw AppError.notFound('El archivo no existe.');
    const cuerpo = (await respuesta.json()) as { signedURL?: string };
    if (!cuerpo.signedURL) throw AppError.notFound('El archivo no existe.');
    return { url: `${this.urlBase}/storage/v1${cuerpo.signedURL}` };
  }
}
