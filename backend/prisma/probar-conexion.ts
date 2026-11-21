import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const PRUEBAS = [
  { nombre: 'DATABASE_URL', url: process.env.DATABASE_URL },
  { nombre: 'DIRECT_URL', url: process.env.DIRECT_URL },
];

const TEXTO_PENDIENTE = 'YOUR-PASSWORD';

function ocultarDatosSensibles(texto: string): string {
  return texto.replace(/postgres(ql)?:\/\/\S+/gi, '[URL oculta]').replace(/`[^`]*`/g, '`[oculto]`');
}

function resumirError(error: unknown): string {
  if (!(error instanceof Error)) return 'error desconocido';
  const ultimasLineas = error.message.split('\n').filter((linea) => linea.trim() !== '').slice(-3).join(' ');
  return ocultarDatosSensibles(ultimasLineas);
}

async function probarConexion(nombre: string, url: string | undefined): Promise<boolean> {
  logger.info(`${nombre}: revisando la variable`);
  if (!url) {
    logger.error(`${nombre}: está vacía en backend/.env`);
    return false;
  }
  if (url.includes(TEXTO_PENDIENTE)) {
    logger.error(`${nombre}: todavía tiene [YOUR-PASSWORD], reemplázalo por tu contraseña`);
    return false;
  }
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    logger.error(`${nombre}: no empieza con postgresql://, probablemente pegaste otra URL`);
    return false;
  }

  logger.info(`${nombre}: intentando conectar`);
  const cliente = new PrismaClient({ datasourceUrl: url });
  try {
    await cliente.$queryRaw`SELECT 1`;
    logger.info(`${nombre}: CONECTADO a la base de datos`);
    return true;
  } catch (error) {
    logger.error(`${nombre}: NO conectó`, { detalle: resumirError(error) });
    return false;
  } finally {
    await cliente.$disconnect();
  }
}

async function ejecutarPruebas(): Promise<void> {
  logger.info('Probando conexiones con la base de datos');
  let todasBien = true;
  for (const prueba of PRUEBAS) {
    const conectoBien = await probarConexion(prueba.nombre, prueba.url);
    todasBien = todasBien && conectoBien;
  }
  if (todasBien) {
    logger.info('Listo: las dos conexiones funcionan');
    return;
  }
  logger.error('Hay conexiones que fallan, revisa backend/.env');
  process.exitCode = 1;
}

ejecutarPruebas();
