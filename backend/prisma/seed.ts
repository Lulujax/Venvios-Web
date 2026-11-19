import 'dotenv/config';
import { crearContextoDesdeEntorno } from '../src/config/contexto';
import { datosAdminDesdeEntorno, sembrarAdministrador, sembrarConfiguracion } from '../src/services/Semilla';
import { logger } from '../src/utils/logger';

async function sembrar(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('Define DATABASE_URL en .env antes de sembrar.');
  const contexto = await crearContextoDesdeEntorno();
  await sembrarConfiguracion(contexto);
  const admin = datosAdminDesdeEntorno(true);
  if (!admin) throw new Error('Define ADMIN_PASSWORD (y opcionalmente ADMIN_NOMBRE, ADMIN_CEDULA, ADMIN_TELEFONO) en .env.');
  await sembrarAdministrador(contexto, admin);
  logger.info('Semilla terminada');
  process.exit(0);
}

sembrar().catch((error) => {
  logger.error('Falló la semilla', { mensaje: error instanceof Error ? error.message : 'desconocido' });
  process.exit(1);
});
