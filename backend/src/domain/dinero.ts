import { AppError } from '../utils/errors';

export function dolaresABolivaresCentavos(centavosUsd: number, tasaBcv: number): number {
  if (!Number.isInteger(centavosUsd) || centavosUsd < 0) {
    throw AppError.badRequest('El monto en dólares debe ser un número entero de centavos no negativo.');
  }
  if (!Number.isFinite(tasaBcv) || tasaBcv <= 0) {
    throw AppError.badRequest('La tasa BCV debe ser mayor que cero.');
  }
  const resultado = Math.round(centavosUsd * tasaBcv);
  if (resultado < 0) throw new Error('Postcondición rota: bolívares negativos.');
  return resultado;
}

export function formatearUsd(centavos: number): string {
  return `${(centavos / 100).toFixed(2)} $`;
}

export function formatearBs(centavos: number): string {
  return `${(centavos / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
}
