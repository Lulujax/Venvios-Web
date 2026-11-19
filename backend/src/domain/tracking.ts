import { AppError } from '../utils/errors';

const PREFIJOS_COMUNES = ['JJD', 'JD', 'YT', 'SF', 'LP'];
const LARGO_MINIMO_TRAS_PREFIJO = 8;

export function normalizarTracking(texto: string): string {
  if (typeof texto !== 'string') throw AppError.badRequest('El tracking debe ser texto.');
  const limpio = texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpio.length < 4) throw AppError.badRequest('El tracking es demasiado corto.');
  if (limpio.length > 60) throw AppError.badRequest('El tracking es demasiado largo.');
  const sinCeros = limpio.replace(/^0+/, '');
  return sinCeros.length >= 4 ? sinCeros : limpio;
}

function quitarPrefijo(valor: string): string {
  for (const prefijo of PREFIJOS_COMUNES) {
    if (valor.startsWith(prefijo) && valor.length - prefijo.length >= LARGO_MINIMO_TRAS_PREFIJO) {
      return valor.slice(prefijo.length);
    }
  }
  return valor;
}

export function coincidenTrackings(a: string, b: string): boolean {
  const normalA = normalizarTracking(a);
  const normalB = normalizarTracking(b);
  if (normalA === normalB) return true;
  return quitarPrefijo(normalA) === quitarPrefijo(normalB);
}
