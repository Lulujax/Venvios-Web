export type AmbitoWeb = 'cliente' | 'equipo';

export const CABECERA_AMBITO = 'X-Ambito';

const PREFIJOS_EQUIPO = ['/panel', '/equipo'];

export function ambitoDeRuta(ruta: string): AmbitoWeb {
  if (typeof ruta !== 'string') throw new Error('La ruta debe ser un texto.');
  const coincide = PREFIJOS_EQUIPO.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`));
  return coincide ? 'equipo' : 'cliente';
}

export function ambitoActual(): AmbitoWeb {
  if (typeof window === 'undefined') return 'cliente';
  return ambitoDeRuta(window.location.pathname);
}

export function rutaLogin(ambito: AmbitoWeb): string {
  return ambito === 'equipo' ? '/equipo/auth/login' : '/auth/login';
}

export function rutaEntrada(ambito: AmbitoWeb): string {
  return ambito === 'equipo' ? '/equipo' : '/ingresar';
}
