import { randomInt } from 'node:crypto';

const ALFABETO_CASILLERO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Código de casillero sin caracteres ambiguos: VEX-CUC-7K4Q */
export function generarCodigoCasillero(): string {
  let sufijo = '';
  for (let i = 0; i < 4; i += 1) {
    sufijo += ALFABETO_CASILLERO[randomInt(0, ALFABETO_CASILLERO.length)];
  }
  return `VEX-CUC-${sufijo}`;
}

/** Guía de paquete: VEX-2026-04217 */
export function generarNumeroGuia(anio: number = new Date().getFullYear()): string {
  return `VEX-${anio}-${String(randomInt(1, 100000)).padStart(5, '0')}`;
}
