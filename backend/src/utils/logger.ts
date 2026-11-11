import { redactPII } from './mask';

type Nivel = 'INFO' | 'WARN' | 'ERROR';

/**
 * Logger sin dependencias. Toda cadena pasa por redactPII antes de imprimirse,
 * de modo que teléfonos y correos nunca lleguen a los logs en claro.
 */
class Logger {
  private format(level: Nivel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const base = `${timestamp} [${level}] ${redactPII(message)}`;
    if (meta === undefined) return base;

    let serialized: string;
    try {
      serialized = JSON.stringify(meta);
    } catch {
      serialized = '[meta no serializable]';
    }
    return `${base} ${redactPII(serialized)}`;
  }

  info(message: string, meta?: unknown): void {
    console.info(this.format('INFO', message, meta));
  }

  warn(message: string, meta?: unknown): void {
    console.warn(this.format('WARN', message, meta));
  }

  error(message: string, meta?: unknown): void {
    console.error(this.format('ERROR', message, meta));
  }
}

export const logger = new Logger();
