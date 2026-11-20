import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { AppError } from '../utils/errors';

function obtenerLlave(llaveHex: string | undefined): Buffer {
  if (!llaveHex || !/^[0-9a-fA-F]{64}$/.test(llaveHex)) {
    throw new Error('Falta CEDULA_KEY: debe tener 64 caracteres hexadecimales.');
  }
  return Buffer.from(llaveHex, 'hex');
}

export class CifradoCedula {
  private readonly llave: Buffer;

  constructor(llaveHex: string | undefined) {
    this.llave = obtenerLlave(llaveHex);
  }

  cifrar(texto: string): string {
    if (!texto) throw AppError.badRequest('No hay texto para cifrar.');
    const iv = randomBytes(12);
    const cifrador = createCipheriv('aes-256-gcm', this.llave, iv);
    const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
    const etiqueta = cifrador.getAuthTag();
    return [iv, etiqueta, cifrado].map((parte) => parte.toString('base64')).join('.');
  }

  cifrarOpcional(texto: string | null): string | null {
    return texto ? this.cifrar(texto) : null;
  }

  descifrarOpcional(cifrado: string | null): string | null {
    return cifrado ? this.descifrar(cifrado) : null;
  }

  descifrar(cifrado: string): string {
    const partes = cifrado.split('.');
    if (partes.length !== 3) throw new Error('Dato cifrado con formato inválido.');
    const [iv, etiqueta, contenido] = partes.map((parte) => Buffer.from(parte, 'base64')) as [Buffer, Buffer, Buffer];
    const descifrador = createDecipheriv('aes-256-gcm', this.llave, iv);
    descifrador.setAuthTag(etiqueta);
    return Buffer.concat([descifrador.update(contenido), descifrador.final()]).toString('utf8');
  }

  huella(texto: string): string {
    return createHmac('sha256', this.llave).update(texto, 'utf8').digest('hex');
  }
}
