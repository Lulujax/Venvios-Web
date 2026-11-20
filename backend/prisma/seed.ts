import 'dotenv/config';
import { crearContextoDesdeEntorno } from '../src/config/contexto';
import { datosAdminDesdeEntorno, sembrarConfiguracion, sembrarCuentasDePersonal } from '../src/services/Semilla';
import { logger } from '../src/utils/logger';

async function sembrar(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('Define DATABASE_URL en .env antes de sembrar.');
  if (!datosAdminDesdeEntorno()) throw new Error('Define ADMIN_PASSWORD en .env antes de sembrar.');
  const contexto = await crearContextoDesdeEntorno();
  await sembrarConfiguracion(contexto);
  await sembrarCuentasDePersonal(contexto);
  logger.info('Semilla terminada');
  process.exit(0);
}

sembrar().catch((error) => {
  logger.error('Falló la semilla', { mensaje: error instanceof Error ? error.message : 'desconocido' });
  process.exit(1);
});
