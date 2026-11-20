import { VALORES_INICIALES, CLAVES_CONFIG } from '../config/predeterminados';
import type { Contexto } from '../config/contexto';
import { logger } from '../utils/logger';

export interface DatosPersonalInicial {
  nombre: string;
  cedula: string;
  email: string;
  telefono: string;
  contrasena: string;
}

export type RolPersonal = 'OPERADOR' | 'ADMIN';

export async function sembrarConfiguracion(contexto: Contexto): Promise<void> {
  for (const clave of CLAVES_CONFIG) {
    const existente = await contexto.repos.config.obtener(clave);
    if (existente === null) {
      await contexto.repos.config.guardar(clave, VALORES_INICIALES[clave]);
      logger.info('Configuración inicial cargada', { clave });
    }
  }
}

export async function sembrarPersonal(contexto: Contexto, datos: DatosPersonalInicial, rol: RolPersonal): Promise<boolean> {
  const huella = contexto.cifrado.huella(datos.cedula.replace(/\D/g, ''));
  if (await contexto.repos.usuarios.porCedulaHuella(huella)) {
    logger.info('Cuenta de personal ya existente', { rol });
    return false;
  }
  const creado = await contexto.auth.crearPersonal({ ...datos, rol }, 'semilla');
  await contexto.repos.usuarios.actualizar(creado.id, { debeCambiarClave: false });
  logger.info('Cuenta de personal creada', { rol });
  return true;
}

export function datosAdminDesdeEntorno(): DatosPersonalInicial | null {
  const contrasena = process.env.ADMIN_PASSWORD;
  if (!contrasena) return null;
  return {
    nombre: process.env.ADMIN_NOMBRE ?? 'Administrador Venvios',
    cedula: process.env.ADMIN_CEDULA ?? '10000001',
    email: process.env.ADMIN_EMAIL ?? 'admin@venvios.local',
    telefono: process.env.ADMIN_TELEFONO ?? '573000000001',
    contrasena,
  };
}

export function datosOperadorDesdeEntorno(): DatosPersonalInicial | null {
  const contrasena = process.env.OPERADOR_PASSWORD;
  if (!contrasena) return null;
  return {
    nombre: process.env.OPERADOR_NOMBRE ?? 'Operador de prueba',
    cedula: process.env.OPERADOR_CEDULA ?? '10000002',
    email: process.env.OPERADOR_EMAIL ?? 'operador@venvios.local',
    telefono: process.env.OPERADOR_TELEFONO ?? '573000000002',
    contrasena,
  };
}

export async function sembrarCuentasDePersonal(contexto: Contexto): Promise<void> {
  const admin = datosAdminDesdeEntorno();
  if (admin) await sembrarPersonal(contexto, admin, 'ADMIN');
  else logger.warn('Sin ADMIN_PASSWORD en .env: no se creó la cuenta de administrador');
  const operador = datosOperadorDesdeEntorno();
  if (operador) await sembrarPersonal(contexto, operador, 'OPERADOR');
}
