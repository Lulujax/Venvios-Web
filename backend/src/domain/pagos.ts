import { AppError } from '../utils/errors';

export const TOLERANCIA_BS_CENTAVOS = 100;
export const LARGO_REFERENCIA = 6;
export const MIN_ID_BINANCE = 8;
export const MAX_ID_BINANCE = 40;

export function validarReferenciaPago(referencia: unknown, metodo: string = 'PAGO_MOVIL'): string {
  const limpia = typeof referencia === 'string' ? referencia.replace(/\s/g, '') : '';
  if (metodo === 'BINANCE') {
    if (!new RegExp(`^[A-Za-z0-9]{${MIN_ID_BINANCE},${MAX_ID_BINANCE}}$`).test(limpia)) {
      throw AppError.badRequest(`Escribe el ID de la transacción de Binance: entre ${MIN_ID_BINANCE} y ${MAX_ID_BINANCE} letras y números, sin guiones ni espacios.`, 'REFERENCIA_INVALIDA');
    }
    return limpia;
  }
  if (!new RegExp(`^\\d{${LARGO_REFERENCIA}}$`).test(limpia)) {
    throw AppError.badRequest(`Escribe los últimos ${LARGO_REFERENCIA} dígitos de la referencia, solo números.`, 'REFERENCIA_INVALIDA');
  }
  return limpia;
}

export function esMontoExacto(moneda: 'USD' | 'BS', montoCentavos: number, saldoUsdCentavos: number, saldoBsCentavos: number): boolean {
  if (!Number.isInteger(montoCentavos) || montoCentavos <= 0) return false;
  if (moneda === 'USD') return montoCentavos === saldoUsdCentavos;
  return Math.abs(montoCentavos - saldoBsCentavos) <= TOLERANCIA_BS_CENTAVOS;
}
