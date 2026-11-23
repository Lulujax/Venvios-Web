import { logger } from '../utils/logger';

const PUERTO_SESION_SUPABASE = '5432';
const PUERTO_TRANSACCION_SUPABASE = '6543';
const SUFIJO_POOLER_SUPABASE = '.pooler.supabase.com';

export interface ResultadoConexion {
  url: string;
  cambios: string[];
}

export function esEntornoServerless(entorno: NodeJS.ProcessEnv): boolean {
  return Boolean(entorno.VERCEL || entorno.NETLIFY || entorno.AWS_LAMBDA_FUNCTION_NAME);
}

export function ajustarUrlParaServerless(urlOriginal: string, serverless: boolean): ResultadoConexion {
  if (typeof urlOriginal !== 'string' || !/^postgres(ql)?:\/\//i.test(urlOriginal)) {
    throw new Error('La cadena de conexión debe empezar con postgresql:// o postgres://.');
  }
  if (!serverless) return { url: urlOriginal, cambios: [] };

  const url = new URL(urlOriginal);
  const cambios: string[] = [];
  const esPoolerSupabase = url.hostname.endsWith(SUFIJO_POOLER_SUPABASE);

  if (esPoolerSupabase && url.port === PUERTO_SESION_SUPABASE) {
    url.port = PUERTO_TRANSACCION_SUPABASE;
    cambios.push('puerto de sesión cambiado al de transacción');
  }
  if (esPoolerSupabase && url.port === PUERTO_TRANSACCION_SUPABASE && url.searchParams.get('pgbouncer') !== 'true') {
    url.searchParams.set('pgbouncer', 'true');
    cambios.push('pgbouncer activado');
  }
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '1');
    cambios.push('una conexión por instancia');
  }

  const resultado = url.toString();
  if (!/^postgres(ql)?:\/\//i.test(resultado)) throw new Error('No se pudo ajustar la cadena de conexión.');
  return { url: resultado, cambios };
}

export function urlConexionDesdeEntorno(entorno: NodeJS.ProcessEnv = process.env): string | undefined {
  const original = entorno.DATABASE_URL?.trim();
  if (!original) return undefined;
  const { url, cambios } = ajustarUrlParaServerless(original, esEntornoServerless(entorno));
  if (cambios.length > 0) logger.info('Conexión a la base ajustada para serverless', { cambios });
  return url;
}
