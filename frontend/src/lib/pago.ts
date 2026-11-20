export type MonedaPago = 'USD' | 'BS';

export const TEXTO_MONEDA: Record<MonedaPago, string> = {
  USD: 'Dólares ($)',
  BS: 'Bolívares (Bs)',
};

export function monedaDelMetodo(metodo: string): MonedaPago {
  if (metodo === 'BINANCE') return 'USD';
  if (metodo === 'PAGO_MOVIL' || metodo === 'TRANSFERENCIA') return 'BS';
  throw new Error(`Método de pago desconocido: ${metodo}`);
}
