import 'dotenv/config';
import { crearContextoDesdeEntorno } from './config/contexto';
import { crearApp } from './http/app';
import { datosAdminDesdeEntorno, sembrarAdministrador, sembrarConfiguracion } from './services/Semilla';
import { logger } from './utils/logger';

async function iniciar(): Promise<void> {
  const contexto = await crearContextoDesdeEntorno();
  await sembrarConfiguracion(contexto);
  const admin = datosAdminDesdeEntorno(contexto.produccion);
  if (admin) {
    const creado = await sembrarAdministrador(contexto, admin);
    if (creado && !process.env.ADMIN_PASSWORD) {
      logger.warn('Administrador de desarrollo creado: teléfono 573000000001, contraseña AdminDev2026!');
    }
  }
  const puerto = Number(process.env.PORT ?? 4000);
  crearApp(contexto).listen(puerto, () => logger.info(`API lista en http://localhost:${puerto}/api/salud`));
}

iniciar().catch((error) => {
  logger.error('No se pudo iniciar la API', { mensaje: error instanceof Error ? error.message : 'desconocido' });
  process.exit(1);
});
