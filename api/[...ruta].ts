import type { Request, Response } from 'express';
import { crearContextoDesdeEntorno } from '../backend/src/config/contexto';
import { crearApp } from '../backend/src/http/app';
import { sembrarConfiguracion } from '../backend/src/services/Semilla';

let aplicacion: ReturnType<typeof crearApp> | null = null;

async function obtenerAplicacion(): Promise<ReturnType<typeof crearApp>> {
  if (aplicacion) return aplicacion;
  console.log('Iniciando API en Vercel');
  const contexto = await crearContextoDesdeEntorno();
  await sembrarConfiguracion(contexto);
  aplicacion = crearApp(contexto);
  console.log('API lista');
  return aplicacion;
}

export default async function manejarPeticion(peticion: Request, respuesta: Response): Promise<void> {
  const app = await obtenerAplicacion();
  app(peticion, respuesta);
}
