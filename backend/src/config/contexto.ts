import { createHmac } from 'node:crypto';
import { CifradoCedula } from '../domain/cifrado';
import { crearRepositoriosMemoria } from '../repositories/memoria';
import type { Repositorios } from '../repositories/tipos';
import { AlmacenamientoMemoria, AlmacenamientoSupabase, type Almacenamiento } from '../services/Almacenamiento';
import {
  AuthService,
  BLOQUEO_PERSONAL_MS,
  DURACION_SESION_CLIENTE_SEGUNDOS,
  DURACION_SESION_PERSONAL_SEGUNDOS,
  LimitadorIntentos,
  MAX_INTENTOS_PERSONAL,
} from '../services/AuthService';
import { CanalCodigoMemoria, CanalCodigoSupabase, type CanalCodigo } from '../services/CanalCodigo';
import { RecuperacionService } from '../services/RecuperacionService';
import { ConfigService } from '../services/ConfigService';
import { EnvioService } from '../services/EnvioService';
import { MensajeService } from '../services/MensajeService';
import { PagoService } from '../services/PagoService';
import { PerfilService } from '../services/PerfilService';
import { PublicoService } from '../services/PublicoService';
import { TasaService, type ConsultaTasa } from '../services/TasaService';
import { logger } from '../utils/logger';

export interface Contexto {
  repos: Repositorios;
  almacenamiento: Almacenamiento;
  cifrado: CifradoCedula;
  auth: AuthService;
  recuperacion: RecuperacionService;
  config: ConfigService;
  tasas: TasaService;
  envios: EnvioService;
  pagos: PagoService;
  perfil: PerfilService;
  mensajes: MensajeService;
  publico: PublicoService;
  produccion: boolean;
}

export interface OpcionesContexto {
  repos: Repositorios;
  almacenamiento: Almacenamiento;
  canalCodigo?: CanalCodigo;
  llaveCedula: string;
  secretoJwt: string;
  secretoJwtPersonal?: string;
  urlApp: string;
  consultaTasa?: ConsultaTasa;
  reloj?: () => Date;
  produccion?: boolean;
  limitador?: LimitadorIntentos;
  limitadorPersonal?: LimitadorIntentos;
}

export function derivarSecretoPersonal(secretoBase: string): string {
  return createHmac('sha256', secretoBase).update('venvios-sesion-personal').digest('hex');
}

export function crearContexto(opciones: OpcionesContexto): Contexto {
  const cifrado = new CifradoCedula(opciones.llaveCedula);
  const config = new ConfigService(opciones.repos.config);
  const tasas = new TasaService(opciones.repos.config, opciones.consultaTasa, opciones.reloj);
  const limitador = opciones.limitador ?? new LimitadorIntentos(opciones.repos.intentos);
  const limitadorPersonal = opciones.limitadorPersonal ?? new LimitadorIntentos(opciones.repos.intentos, undefined, MAX_INTENTOS_PERSONAL, BLOQUEO_PERSONAL_MS);
  const auth = new AuthService(opciones.repos.usuarios, cifrado, {
    CLIENTE: { secreto: opciones.secretoJwt, limitador, duracionSegundos: DURACION_SESION_CLIENTE_SEGUNDOS },
    PERSONAL: {
      secreto: opciones.secretoJwtPersonal ?? derivarSecretoPersonal(opciones.secretoJwt),
      limitador: limitadorPersonal,
      duracionSegundos: DURACION_SESION_PERSONAL_SEGUNDOS,
    },
  });
  const recuperacion = new RecuperacionService(opciones.repos.usuarios, opciones.repos.eventosCuenta, auth, opciones.canalCodigo ?? new CanalCodigoMemoria(), limitador, cifrado);
  const envios = new EnvioService(opciones.repos, cifrado, config, tasas, opciones.almacenamiento);
  const pagos = new PagoService(opciones.repos, tasas, config, opciones.almacenamiento, envios);
  const perfil = new PerfilService(opciones.repos.usuarios, opciones.repos.eventosCuenta, cifrado, auth);
  const mensajes = new MensajeService(envios, config, opciones.urlApp);
  const publico = new PublicoService(config, tasas);
  return {
    repos: opciones.repos,
    almacenamiento: opciones.almacenamiento,
    cifrado,
    auth,
    recuperacion,
    config,
    tasas,
    envios,
    pagos,
    perfil,
    mensajes,
    publico,
    produccion: opciones.produccion ?? false,
  };
}

export function variableConValor(nombre: string): string | undefined {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    if (process.env[nombre] !== undefined) logger.warn('Variable de entorno vacía; se trata como no definida', { variable: nombre });
    return undefined;
  }
  return valor;
}

export function validarUrlBaseDatos(url: string): string {
  if (/^postgres(ql)?:\/\//i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) {
    throw new Error('DATABASE_URL tiene una dirección web (https://). Esa va en SUPABASE_URL. DATABASE_URL debe ser la cadena de conexión que empieza con postgresql:// (Supabase → Connect). Para probar en memoria, déjala vacía.');
  }
  throw new Error('DATABASE_URL debe empezar con postgresql:// o postgres://. Para probar en memoria, déjala vacía.');
}

const LLAVE_DESARROLLO = 'b'.repeat(64);
const SECRETO_DESARROLLO = 'secreto-solo-para-desarrollo-local';

export async function crearContextoDesdeEntorno(): Promise<Contexto> {
  const produccion = process.env.NODE_ENV === 'production' || Boolean(process.env.NETLIFY);
  const secretoJwt = variableConValor('JWT_SECRET');
  const secretoJwtPersonal = variableConValor('JWT_SECRET_PERSONAL');
  const llaveCedula = variableConValor('CEDULA_KEY');
  if (produccion && (!secretoJwt || !llaveCedula)) {
    throw new Error('Faltan JWT_SECRET o CEDULA_KEY en las variables de entorno.');
  }

  if (produccion && !secretoJwtPersonal) {
    logger.warn('Falta JWT_SECRET_PERSONAL: se deriva de JWT_SECRET. Conviene definir una llave propia para el personal.');
  }

  let repos: Repositorios;
  const urlBaseDatos = variableConValor('DATABASE_URL');
  if (urlBaseDatos) {
    validarUrlBaseDatos(urlBaseDatos);
    const { crearRepositoriosPrisma } = await import('../repositories/prisma');
    repos = crearRepositoriosPrisma();
    logger.info('Usando base de datos Postgres');
  } else {
    if (produccion) throw new Error('Falta DATABASE_URL en producción.');
    repos = crearRepositoriosMemoria();
    logger.warn('Sin DATABASE_URL: se usan datos en memoria (se pierden al reiniciar)');
  }

  const urlSupabase = variableConValor('SUPABASE_URL');
  if (produccion && !urlSupabase) {
    throw new Error('Falta SUPABASE_URL en producción: sin ella las fotos y comprobantes se perderían.');
  }
  const almacenamiento: Almacenamiento = urlSupabase
    ? new AlmacenamientoSupabase(urlSupabase, process.env.SUPABASE_SERVICE_KEY ?? '', process.env.SUPABASE_BUCKET ?? '')
    : new AlmacenamientoMemoria();

  const canalCodigo: CanalCodigo = urlSupabase ? new CanalCodigoSupabase(urlSupabase, process.env.SUPABASE_SERVICE_KEY ?? '') : new CanalCodigoMemoria();

  return crearContexto({
    repos,
    almacenamiento,
    canalCodigo,
    llaveCedula: llaveCedula ?? LLAVE_DESARROLLO,
    secretoJwt: secretoJwt ?? SECRETO_DESARROLLO,
    secretoJwtPersonal,
    urlApp: process.env.URL ?? process.env.APP_URL ?? 'http://localhost:5173',
    produccion,
  });
}
