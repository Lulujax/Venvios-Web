import { AppError } from '../utils/errors';

export const TOLERANCIA_BS_CENTAVOS = 100;
export const LARGO_REFERENCIA = 6;

export function validarReferenciaPago(referencia: unknown): string {
  const limpia = typeof referencia === 'string' ? referencia.replace(/\s/g, '') : '';
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
