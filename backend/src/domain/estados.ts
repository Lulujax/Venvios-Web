import { AppError } from '../utils/errors';

export const ESTADOS_ENVIO = [
  'PREALERTADO',
  'RECIBIDO_PARCIAL',
  'RECIBIDO_COMPLETO',
  'POR_CONFIRMAR',
  'PAGADO',
  'DESPACHADO',
  'CERRADO',
  'CANCELADO',
] as const;

export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

export const ETIQUETAS_ESTADO: Record<EstadoEnvio, string> = {
  PREALERTADO: 'Prealertado',
  RECIBIDO_PARCIAL: 'Recibido parcial',
  RECIBIDO_COMPLETO: 'Recibido completo',
  POR_CONFIRMAR: 'Pago por confirmar',
  PAGADO: 'Pagado',
  DESPACHADO: 'Despachado a Venezuela',
  CERRADO: 'Cerrado',
  CANCELADO: 'Cancelado',
};

export const TRANSICIONES: Record<EstadoEnvio, EstadoEnvio[]> = {
  PREALERTADO: ['RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO', 'CANCELADO'],
  RECIBIDO_PARCIAL: ['RECIBIDO_COMPLETO', 'CANCELADO'],
  RECIBIDO_COMPLETO: ['POR_CONFIRMAR', 'PAGADO', 'CANCELADO'],
  POR_CONFIRMAR: ['PAGADO', 'RECIBIDO_COMPLETO'],
  PAGADO: ['DESPACHADO'],
  DESPACHADO: ['CERRADO'],
  CERRADO: [],
  CANCELADO: [],
};

export function validarTransicion(actual: EstadoEnvio, nuevo: EstadoEnvio): void {
  if (!ESTADOS_ENVIO.includes(actual) || !ESTADOS_ENVIO.includes(nuevo)) {
    throw AppError.badRequest('Estado desconocido.');
  }
  if (!TRANSICIONES[actual].includes(nuevo)) {
    throw AppError.badRequest(
      `No se puede pasar de "${ETIQUETAS_ESTADO[actual]}" a "${ETIQUETAS_ESTADO[nuevo]}".`,
      'TRANSICION_INVALIDA',
    );
  }
}

export interface DatosEntrega {
  nombre?: string | null;
  cedula?: string | null;
  telefono?: string | null;
  agencia?: string | null;
  ciudad?: string | null;
  estado?: string | null;
}

export const CAMPOS_ENTREGA: Array<keyof DatosEntrega> = ['nombre', 'cedula', 'telefono', 'agencia', 'ciudad', 'estado'];

export function camposEntregaFaltantes(datos: DatosEntrega | null | undefined): string[] {
  return CAMPOS_ENTREGA.filter((campo) => !datos || !String(datos[campo] ?? '').trim());
}

export interface ContextoDespacho {
  estado: EstadoEnvio;
  pagoConfirmado: boolean;
  entrega: DatosEntrega | null | undefined;
}

export function faltantesParaDespachar(contexto: ContextoDespacho): string[] {
  const faltantes: string[] = [];
  if (!contexto.pagoConfirmado) faltantes.push('pago confirmado');
  for (const campo of camposEntregaFaltantes(contexto.entrega)) faltantes.push(`dato de entrega: ${campo}`);
  return faltantes;
}

export function validarDespacho(contexto: ContextoDespacho): void {
  if (contexto.estado !== 'PAGADO') {
    throw AppError.badRequest('Solo se puede despachar un envío pagado.', 'DESPACHO_SIN_PAGO');
  }
  const faltantes = faltantesParaDespachar(contexto);
  if (faltantes.length > 0) {
    throw AppError.badRequest(`Faltan datos para despachar: ${faltantes.join(', ')}.`, 'DESPACHO_INCOMPLETO');
  }
}
