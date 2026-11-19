import serverless from 'serverless-http';
import type { Handler } from '@netlify/functions';
import { crearContextoDesdeEntorno } from '../../backend/src/config/contexto';
import { crearApp } from '../../backend/src/http/app';
import { sembrarConfiguracion } from '../../backend/src/services/Semilla';

let manejador: ReturnType<typeof serverless> | null = null;

async function obtenerManejador(): Promise<ReturnType<typeof serverless>> {
  if (manejador) return manejador;
  const contexto = await crearContextoDesdeEntorno();
  await sembrarConfiguracion(contexto);
  manejador = serverless(crearApp(contexto), { basePath: '/.netlify/functions/api' });
  return manejador;
}

export const handler: Handler = async (evento, contexto) => {
  const atender = await obtenerManejador();
  return (await atender(evento, contexto)) as ReturnType<Handler> extends Promise<infer R> ? R : never;
};
