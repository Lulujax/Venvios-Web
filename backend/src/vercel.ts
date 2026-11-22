import type { Request, Response } from 'express';
import { crearContextoDesdeEntorno } from './config/contexto';
import { crearApp } from './http/app';
import { sembrarConfiguracion } from './services/Semilla';
import { logger } from './utils/logger';

let aplicacion: ReturnType<typeof crearApp> | null = null;

async function obtenerAplicacion(): Promise<ReturnType<typeof crearApp>> {
  if (aplicacion) return aplicacion;
  logger.info('Iniciando API en Vercel');
  const contexto = await crearContextoDesdeEntorno();
  await sembrarConfiguracion(contexto);
  aplicacion = crearApp(contexto);
  logger.info('API lista en Vercel');
  return aplicacion;
}

export default async function manejarPeticion(peticion: Request, respuesta: Response): Promise<void> {
  const app = await obtenerAplicacion();
  app(peticion, respuesta);
}
