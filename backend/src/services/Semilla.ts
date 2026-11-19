import { VALORES_INICIALES, CLAVES_CONFIG } from '../config/predeterminados';
import type { Contexto } from '../config/contexto';
import { logger } from '../utils/logger';

export interface DatosAdminInicial {
  nombre: string;
  cedula: string;
  telefono: string;
  contrasena: string;
}

export async function sembrarConfiguracion(contexto: Contexto): Promise<void> {
  for (const clave of CLAVES_CONFIG) {
    const existente = await contexto.repos.config.obtener(clave);
    if (existente === null) {
      await contexto.repos.config.guardar(clave, VALORES_INICIALES[clave]);
      logger.info('Configuración inicial cargada', { clave });
    }
  }
}

export async function sembrarAdministrador(contexto: Contexto, datos: DatosAdminInicial): Promise<boolean> {
  const huella = contexto.cifrado.huella(datos.cedula.replace(/\D/g, ''));
  const existente = (await contexto.repos.usuarios.porCedulaHuella(huella)) ?? null;
  if (existente) {
    logger.info('El administrador inicial ya existe');
    return false;
  }
  const creado = await contexto.auth.crearPersonal({ ...datos, rol: 'ADMIN' }, 'semilla');
  await contexto.repos.usuarios.actualizar(creado.id, { debeCambiarClave: false });
  logger.info('Administrador inicial creado');
  return true;
}

export function datosAdminDesdeEntorno(produccion: boolean): DatosAdminInicial | null {
  const contrasena = process.env.ADMIN_PASSWORD;
  if (!contrasena) {
    if (produccion) return null;
    return { nombre: 'Admin Desarrollo', cedula: '10000001', telefono: '573000000001', contrasena: 'AdminDev2026!' };
  }
  return {
    nombre: process.env.ADMIN_NOMBRE ?? 'Administrador Venvios',
    cedula: process.env.ADMIN_CEDULA ?? '10000001',
    telefono: process.env.ADMIN_TELEFONO ?? '573000000001',
    contrasena,
  };
}
