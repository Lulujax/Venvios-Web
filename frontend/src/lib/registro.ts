type Nivel = 'info' | 'warn' | 'error';

export interface Registro {
  info: (mensaje: string, datos?: Record<string, unknown>) => void;
  warn: (mensaje: string, datos?: Record<string, unknown>) => void;
  error: (mensaje: string, datos?: Record<string, unknown>) => void;
}

export function logsActivos(): boolean {
  if (import.meta.env.MODE === 'test') return false;
  return import.meta.env.DEV || import.meta.env.VITE_LOGS === 'true';
}

export function crearRegistro(modulo: string): Registro {
  const escribir = (nivel: Nivel, mensaje: string, datos?: Record<string, unknown>): void => {
    if (!logsActivos()) return;
    const prefijo = `[${modulo}] ${mensaje}`;
    if (datos) console[nivel](prefijo, datos);
    else console[nivel](prefijo);
  };
  return {
    info: (mensaje, datos) => escribir('info', mensaje, datos),
    warn: (mensaje, datos) => escribir('warn', mensaje, datos),
    error: (mensaje, datos) => escribir('error', mensaje, datos),
  };
}
