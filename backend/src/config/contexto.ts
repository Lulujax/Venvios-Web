import { CifradoCedula } from '../domain/cifrado';
import { crearRepositoriosMemoria } from '../repositories/memoria';
import type { Repositorios } from '../repositories/tipos';
import { AlmacenamientoMemoria, AlmacenamientoSupabase, type Almacenamiento } from '../services/Almacenamiento';
import { AuthService, LimitadorIntentos } from '../services/AuthService';
import { ConfigService } from '../services/ConfigService';
import { EnvioService } from '../services/EnvioService';
import { MensajeService } from '../services/MensajeService';
import { PagoService } from '../services/PagoService';
import { PublicoService } from '../services/PublicoService';
import { TasaService, type ConsultaTasa } from '../services/TasaService';
import { logger } from '../utils/logger';

export interface Contexto {
  repos: Repositorios;
  almacenamiento: Almacenamiento;
  cifrado: CifradoCedula;
  auth: AuthService;
  config: ConfigService;
  tasas: TasaService;
  envios: EnvioService;
  pagos: PagoService;
  mensajes: MensajeService;
  publico: PublicoService;
  produccion: boolean;
}

export interface OpcionesContexto {
  repos: Repositorios;
  almacenamiento: Almacenamiento;
  llaveCedula: string;
  secretoJwt: string;
  urlApp: string;
  consultaTasa?: ConsultaTasa;
  reloj?: () => Date;
  produccion?: boolean;
  limitador?: LimitadorIntentos;
}

export function crearContexto(opciones: OpcionesContexto): Contexto {
  const cifrado = new CifradoCedula(opciones.llaveCedula);
  const config = new ConfigService(opciones.repos.config);
  const tasas = new TasaService(opciones.repos.config, opciones.consultaTasa, opciones.reloj);
  const auth = new AuthService(opciones.repos.usuarios, cifrado, opciones.secretoJwt, opciones.limitador);
  const envios = new EnvioService(opciones.repos, cifrado, config, tasas, opciones.almacenamiento);
  const pagos = new PagoService(opciones.repos, tasas, config, opciones.almacenamiento, envios);
  const mensajes = new MensajeService(envios, config, opciones.urlApp);
  const publico = new PublicoService(config, tasas);
  return {
    repos: opciones.repos,
    almacenamiento: opciones.almacenamiento,
    cifrado,
    auth,
    config,
    tasas,
    envios,
    pagos,
    mensajes,
    publico,
    produccion: opciones.produccion ?? false,
  };
}

const LLAVE_DESARROLLO = 'b'.repeat(64);
const SECRETO_DESARROLLO = 'secreto-solo-para-desarrollo-local';

export async function crearContextoDesdeEntorno(): Promise<Contexto> {
  const produccion = process.env.NODE_ENV === 'production' || Boolean(process.env.NETLIFY);
  const secretoJwt = process.env.JWT_SECRET;
  const llaveCedula = process.env.CEDULA_KEY;
  if (produccion && (!secretoJwt || !llaveCedula)) {
    throw new Error('Faltan JWT_SECRET o CEDULA_KEY en las variables de entorno.');
  }

  let repos: Repositorios;
  if (process.env.DATABASE_URL) {
    const { crearRepositoriosPrisma } = await import('../repositories/prisma');
    repos = crearRepositoriosPrisma();
    logger.info('Usando base de datos Postgres');
  } else {
    if (produccion) throw new Error('Falta DATABASE_URL en producción.');
    repos = crearRepositoriosMemoria();
    logger.warn('Sin DATABASE_URL: se usan datos en memoria (se pierden al reiniciar)');
  }

  const almacenamiento: Almacenamiento = process.env.SUPABASE_URL
    ? new AlmacenamientoSupabase(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY ?? '', process.env.SUPABASE_BUCKET ?? '')
    : new AlmacenamientoMemoria();

  return crearContexto({
    repos,
    almacenamiento,
    llaveCedula: llaveCedula ?? LLAVE_DESARROLLO,
    secretoJwt: secretoJwt ?? SECRETO_DESARROLLO,
    urlApp: process.env.URL ?? process.env.APP_URL ?? 'http://localhost:5173',
    produccion,
  });
}
