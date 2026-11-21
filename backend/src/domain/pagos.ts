import { AppError } from '../utils/errors';

export const TOLERANCIA_BS_CENTAVOS = 100;
export const MIN_REFERENCIA = 6;
export const MAX_REFERENCIA = 12;
export const MIN_ID_BINANCE = 1;

export function validarReferenciaPago(referencia: unknown, metodo: string = 'PAGO_MOVIL'): string {
  const limpia = typeof referencia === 'string' ? referencia.replace(/\s/g, '') : '';
  if (metodo === 'BINANCE') {
    if (!new RegExp(`^[A-Za-z0-9]{${MIN_ID_BINANCE},}$`).test(limpia)) {
      throw AppError.badRequest('Escribe el ID de la transacción de Binance: solo letras y números, sin guiones ni espacios.', 'REFERENCIA_INVALIDA');
    }
    return limpia;
  }
  if (!new RegExp(`^\\d{${MIN_REFERENCIA},${MAX_REFERENCIA}}$`).test(limpia)) {
    throw AppError.badRequest(`Escribe entre ${MIN_REFERENCIA} y ${MAX_REFERENCIA} dígitos de la referencia, solo números.`, 'REFERENCIA_INVALIDA');
  }
  return limpia;
}

export function esMontoExacto(moneda: 'USD' | 'BS', montoCentavos: number, saldoUsdCentavos: number, saldoBsCentavos: number): boolean {
  if (!Number.isInteger(montoCentavos) || montoCentavos <= 0) return false;
  if (moneda === 'USD') return montoCentavos === saldoUsdCentavos;
  return Math.abs(montoCentavos - saldoBsCentavos) <= TOLERANCIA_BS_CENTAVOS;
}
