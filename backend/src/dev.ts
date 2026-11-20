import 'dotenv/config';
import { crearContextoDesdeEntorno } from './config/contexto';
import { crearApp } from './http/app';
import { sembrarConfiguracion, sembrarCuentasDePersonal } from './services/Semilla';
import { logger } from './utils/logger';

async function iniciar(): Promise<void> {
  const contexto = await crearContextoDesdeEntorno();
  await sembrarConfiguracion(contexto);
  await sembrarCuentasDePersonal(contexto, { tolerante: true });
  const puerto = Number(process.env.PORT ?? 4000);
  crearApp(contexto).listen(puerto, () => logger.info(`API lista en http://localhost:${puerto}/api/salud`));
}

iniciar().catch((error) => {
  logger.error('No se pudo iniciar la API', { mensaje: error instanceof Error ? error.message : 'desconocido' });
  process.exit(1);
});
