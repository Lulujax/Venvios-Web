type Nivel = 'debug' | 'info' | 'warn' | 'error';

const ORDEN: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function nivelConfigurado(): Nivel {
  const valor = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return valor in ORDEN ? (valor as Nivel) : 'info';
}

function escribir(nivel: Nivel, mensaje: string, datos?: Record<string, unknown>): void {
  if (process.env.VITEST && process.env.LOG_LEVEL === undefined) return;
  if (ORDEN[nivel] < ORDEN[nivelConfigurado()]) return;
  const linea = `[${new Date().toISOString()}] ${nivel.toUpperCase()} ${mensaje}`;
  const salida = datos ? [linea, datos] : [linea];
  if (nivel === 'error') console.error(...salida);
  else if (nivel === 'warn') console.warn(...salida);
  else console.log(...salida);
}

export const logger = {
  debug: (mensaje: string, datos?: Record<string, unknown>) => escribir('debug', mensaje, datos),
  info: (mensaje: string, datos?: Record<string, unknown>) => escribir('info', mensaje, datos),
  warn: (mensaje: string, datos?: Record<string, unknown>) => escribir('warn', mensaje, datos),
  error: (mensaje: string, datos?: Record<string, unknown>) => escribir('error', mensaje, datos),
};
