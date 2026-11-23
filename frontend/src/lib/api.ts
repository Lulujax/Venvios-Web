import { CABECERA_AMBITO, ambitoActual } from './ambito';

export class ErrorApi extends Error {
  constructor(
    message: string,
    public readonly estado: number,
    public readonly codigo: string = 'ERROR',
    public readonly datos?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ErrorApi';
  }
}

async function solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const esFormulario = typeof FormData !== 'undefined' && cuerpo instanceof FormData;
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: { ...(cuerpo !== undefined && !esFormulario ? { 'Content-Type': 'application/json' } : {}), [CABECERA_AMBITO]: ambitoActual() },
      body: cuerpo === undefined ? undefined : esFormulario ? (cuerpo as FormData) : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.', 0, 'SIN_CONEXION');
  }

  const texto = await respuesta.text();
  let datos: unknown = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    const error = (datos as { error?: { mensaje?: string; codigo?: string; datos?: Record<string, unknown> } } | null)?.error;
    throw new ErrorApi(error?.mensaje ?? 'Algo salió mal. Intenta de nuevo.', respuesta.status, error?.codigo, error?.datos);
  }
  return datos as T;
}

export const api = {
  get: <T>(ruta: string) => solicitar<T>('GET', ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>('POST', ruta, cuerpo ?? {}),
  put: <T>(ruta: string, cuerpo: unknown) => solicitar<T>('PUT', ruta, cuerpo),
  patch: <T>(ruta: string, cuerpo: unknown) => solicitar<T>('PATCH', ruta, cuerpo),
};

export function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Algo salió mal. Intenta de nuevo.';
}

export function urlArchivo(ruta: string | null | undefined): string | null {
  return ruta ? `/api/archivos/${ruta}` : null;
}
