import type { ApiErrorPayload } from '../types';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

export class ApiError extends Error {
  public readonly status: number;
  public readonly codigo: string;
  public readonly detalles?: ApiErrorPayload['detalles'];

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = payload.codigo;
    this.detalles = payload.detalles;
  }

  get erroresPorCampo(): Record<string, string> {
    const resultado: Record<string, string> = {};
    if (Array.isArray(this.detalles)) {
      for (const detalle of this.detalles) {
        if (detalle && typeof detalle === 'object' && 'campo' in detalle) {
          resultado[String(detalle.campo)] = String(detalle.mensaje);
        }
      }
    }
    return resultado;
  }
}

function parsePayload(body: unknown): ApiErrorPayload {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: unknown }).error;
    if (error && typeof error === 'object' && 'mensaje' in error) {
      const payload = error as ApiErrorPayload;
      return {
        codigo: payload.codigo ?? 'ERROR',
        mensaje: payload.mensaje ?? 'Ocurrió un error.',
        detalles: payload.detalles,
      };
    }
  }
  return { codigo: 'ERROR', mensaje: 'Ocurrió un error inesperado.' };
}

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers,
      });
    } catch {
      throw new ApiError(0, {
        codigo: 'SIN_CONEXION',
        mensaje: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
      });
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, parsePayload(data));
    }

    return data as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  upload<T>(path: string, formData: FormData): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: formData });
  }
}

export const api = new ApiClient();
